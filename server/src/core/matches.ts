/** Creación de partidas (compartido por el servidor y el modo local). */
import type { GameDoc, MatchDoc, MatchPlayer, MatchSettings, PlayerDoc } from '../engine/types.js';
import { PLAYER_COLORS } from '../lib/constants.js';
import { HttpError } from './errors.js';
import { uuid } from './uuid.js';
import { int } from './validate.js';

/** Ajustes de partida por defecto según el juego y el nº de jugadores/equipos. */
export function settingsFor(game: GameDoc, seats: number): MatchSettings {
  const key = String(seats);
  return {
    mode: game.mode,
    win_condition: game.win_condition,
    end_type: game.mode === 'countdown' ? 'zero' : game.end_type,
    target_score: game.target_by_players?.[key] ?? game.target_score,
    rounds_count: game.rounds_count,
    start_score: game.start_scores?.[key] ?? game.start_score_default ?? 0,
    entry_mode: game.entry_mode,
    entry_label: game.entry_label || 'puntos',
    default_entry: game.default_entry,
    alert_margin: game.alert_margin ?? 0,
  };
}

export function applyOverrides(s: MatchSettings, o: Record<string, unknown> | undefined): MatchSettings {
  if (!o) return s;
  const out = { ...s };
  if (o.win_condition === 'high' || o.win_condition === 'low') out.win_condition = o.win_condition;
  if (out.mode !== 'countdown' && ['target', 'rounds', 'manual'].includes(String(o.end_type)))
    out.end_type = o.end_type as MatchSettings['end_type'];
  if (o.target_score !== undefined) out.target_score = int(o.target_score);
  if (o.rounds_count !== undefined) out.rounds_count = int(o.rounds_count);
  if (o.start_score !== undefined) out.start_score = int(o.start_score, out.start_score) ?? out.start_score;
  if (o.alert_margin !== undefined) out.alert_margin = int(o.alert_margin, 0) ?? 0;
  if (out.end_type === 'target' && (out.target_score == null || out.target_score <= 0))
    throw new HttpError(400, 'Indica la puntuación objetivo');
  if (out.end_type === 'rounds' && (out.rounds_count == null || out.rounds_count <= 0))
    throw new HttpError(400, 'Indica el número de rondas');
  return out;
}

export interface SeatInput {
  id: string;
  color?: string;
}

export function buildMatch(
  game: GameDoc,
  players: PlayerDoc[],
  seats: SeatInput[],
  teams: string[][] | null,
  overrides?: Record<string, unknown>,
): MatchDoc {
  if (!seats.length) throw new HttpError(400, 'Añade jugadores');
  const byId = new Map(players.map((p) => [p.id, p]));
  const usedColors = new Set<string>();
  const people: MatchPlayer[] = seats.map((s) => {
    const p = byId.get(s.id);
    if (!p) throw new HttpError(400, 'Jugador no encontrado');
    let color = (s.color || p.color).toUpperCase();
    if (usedColors.has(color)) color = (PLAYER_COLORS.find((c) => !usedColors.has(c.hex)) ?? PLAYER_COLORS[0]).hex;
    usedColors.add(color);
    return { id: p.id, name: p.name, avatar: p.avatar, color, member_ids: [], member_names: [] };
  });
  if (new Set(people.map((p) => p.id)).size !== people.length) throw new HttpError(400, 'Hay jugadores repetidos');

  let matchPlayers = people;
  if (game.teams && teams && teams.length) {
    const lookup = new Map(people.map((p) => [p.id, p]));
    matchPlayers = teams.map((ids) => {
      const members = ids.map((id) => lookup.get(id)).filter((m): m is MatchPlayer => Boolean(m));
      if (members.length < 1) throw new HttpError(400, 'Equipo vacío');
      return {
        id: `team-${uuid()}`,
        name: members.map((m) => m.name).join(' y '),
        avatar: members[0].avatar,
        color: members[0].color,
        member_ids: members.map((m) => m.id),
        member_names: members.map((m) => m.name),
      };
    });
  }

  if (seats.length < game.min_players) throw new HttpError(400, `Mínimo ${game.min_players} jugadores`);
  if (seats.length > game.max_players) throw new HttpError(400, `Máximo ${game.max_players} jugadores`);

  const settings = applyOverrides(settingsFor(game, seats.length), overrides);
  return {
    id: uuid(),
    game_id: game.id,
    game_name: game.name,
    game_emoji: game.emoji,
    game_color: game.color,
    settings,
    players: matchPlayers,
    rounds: [],
    turn_offset: 0,
    status: 'active',
    manually_finished: false,
    winner_ids: [],
    created_at: new Date().toISOString(),
    finished_at: null,
  };
}

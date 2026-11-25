import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Store } from '../db.js';
import {
  addRound,
  addScore,
  deleteRound,
  editRound,
  finishNow,
  reopen,
  settleStatus,
  skipTurn,
  undoLast,
  viewMatch,
} from '../engine/scoring.js';
import type { GameDoc, MatchDoc, MatchPlayer, MatchSettings, PlayerDoc } from '../engine/types.js';
import { PLAYER_COLORS } from '../lib/constants.js';
import { h, HttpError, int, notFound } from '../lib/http.js';

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

function applyOverrides(s: MatchSettings, o: Record<string, unknown> | undefined): MatchSettings {
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

interface SeatInput {
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
        id: `team-${randomUUID()}`,
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
    id: randomUUID(),
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

export function matchesRouter(store: Store) {
  const r = Router();
  const mustGet = (id: string) => {
    const m = store.get<MatchDoc>('matches', id);
    if (!m) throw notFound('Partida');
    return m;
  };
  /** Carga, muta, guarda y devuelve la vista calculada. */
  const mutate = (id: string, fn: (m: MatchDoc) => MatchDoc) => {
    const m = fn(mustGet(id));
    store.put('matches', m);
    return viewMatch(m);
  };

  r.get('/', h(() => store.all<MatchDoc>('matches').map(viewMatch)));
  r.get('/:id', h((req) => viewMatch(mustGet(req.params.id))));

  r.post(
    '/',
    h((req) => {
      const game = store.get<GameDoc>('games', String(req.body?.game_id ?? ''));
      if (!game) throw notFound('Juego');
      const seats: SeatInput[] = Array.isArray(req.body?.players)
        ? req.body.players.map((p: { id?: unknown; color?: unknown } | string) =>
            typeof p === 'string' ? { id: p } : { id: String(p.id ?? ''), color: p.color ? String(p.color) : undefined },
          )
        : [];
      const teams: string[][] | null = Array.isArray(req.body?.teams)
        ? req.body.teams.map((t: unknown) => (Array.isArray(t) ? t.map(String) : []))
        : null;
      const match = buildMatch(game, store.all<PlayerDoc>('players'), seats, teams, req.body?.settings);
      store.put('matches', match);
      return viewMatch(match);
    }),
  );

  r.delete(
    '/:id',
    h((req) => {
      if (!store.delete('matches', req.params.id)) throw notFound('Partida');
      return { ok: true };
    }),
  );

  r.post('/:id/scores', h((req) => mutate(req.params.id, (m) => addScore(m, String(req.body?.player_id ?? ''), req.body?.value))));
  r.post('/:id/skip', h((req) => mutate(req.params.id, skipTurn)));
  r.post('/:id/undo', h((req) => mutate(req.params.id, undoLast)));
  r.post('/:id/rounds', h((req) => mutate(req.params.id, (m) => addRound(m, req.body?.entries))));
  r.put('/:id/rounds/:rid', h((req) => mutate(req.params.id, (m) => editRound(m, req.params.rid, req.body?.entries))));
  r.delete('/:id/rounds/:rid', h((req) => mutate(req.params.id, (m) => deleteRound(m, req.params.rid))));
  r.post('/:id/finish', h((req) => mutate(req.params.id, (m) => finishNow(m))));
  r.post('/:id/reopen', h((req) => mutate(req.params.id, reopen)));

  /** Revancha: mismo juego, mismos jugadores/equipos y mismos ajustes. */
  r.post(
    '/:id/rematch',
    h((req) => {
      const old = mustGet(req.params.id);
      const match: MatchDoc = settleStatus({
        ...old,
        id: randomUUID(),
        players: old.players.map((p) => ({ ...p })),
        rounds: [],
        turn_offset: 0,
        status: 'active',
        manually_finished: false,
        winner_ids: [],
        created_at: new Date().toISOString(),
        finished_at: null,
      });
      store.put('matches', match);
      return viewMatch(match);
    }),
  );

  return r;
}

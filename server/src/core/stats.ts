import type { MatchDoc, PlayerDoc } from '../engine/types.js';
import { viewMatch } from '../engine/scoring.js';
import type { Repo } from './repo.js';

/**
 * Estadísticas del Dashboard.
 * "Reiniciar" fija `reset_at`: solo cuentan las partidas creadas desde entonces.
 * "Deshacer" recupera la fecha anterior.
 * En partidas por equipos, las victorias se acreditan a cada miembro.
 */
export function computeStats(store: Repo) {
  const resetAt = store.getSetting('stats_reset_at');
  const matches = store
    .all<MatchDoc>('matches')
    .filter((m) => !resetAt || m.created_at >= resetAt);
  const finished = matches.filter((m) => m.status === 'finished');
  const players = store.all<PlayerDoc>('players');

  type PG = { game_id: string; game_name: string; game_emoji: string; played: number; wins: number; best: number | null };
  const per = new Map<string, { played: number; wins: number; byGame: Map<string, PG> }>();
  for (const p of players) per.set(p.id, { played: 0, wins: 0, byGame: new Map() });

  const gameAgg = new Map<
    string,
    { game_id: string; game_name: string; game_emoji: string; game_color: string; played: number; wins: Map<string, number> }
  >();

  for (const m of finished) {
    const view = viewMatch(m);
    const ga =
      gameAgg.get(m.game_id) ??
      { game_id: m.game_id, game_name: m.game_name, game_emoji: m.game_emoji, game_color: m.game_color, played: 0, wins: new Map() };
    ga.played += 1;
    gameAgg.set(m.game_id, ga);
    for (const seat of m.players) {
      const ids = seat.member_ids.length ? seat.member_ids : [seat.id];
      const won = m.winner_ids.includes(seat.id);
      const total = view.totals[seat.id];
      for (const pid of ids) {
        const agg = per.get(pid);
        if (!agg) continue;
        agg.played += 1;
        if (won) {
          agg.wins += 1;
          ga.wins.set(pid, (ga.wins.get(pid) ?? 0) + 1);
        }
        const g =
          agg.byGame.get(m.game_id) ??
          { game_id: m.game_id, game_name: m.game_name, game_emoji: m.game_emoji, played: 0, wins: 0, best: null };
        g.played += 1;
        if (won) g.wins += 1;
        const better = m.settings.win_condition === 'low' ? Math.min : Math.max;
        g.best = g.best === null ? total : better(g.best, total);
        agg.byGame.set(m.game_id, g);
      }
    }
  }

  const playerStats = players
    .map((p) => {
      const a = per.get(p.id)!;
      return {
        player_id: p.id,
        name: p.name,
        avatar: p.avatar,
        color: p.color,
        played: a.played,
        wins: a.wins,
        win_rate: a.played ? Math.round((a.wins / a.played) * 100) : 0,
        by_game: [...a.byGame.values()],
      };
    })
    .sort((x, y) => y.wins - x.wins || x.name.localeCompare(y.name, 'es'));

  const games = [...gameAgg.values()]
    .map((g) => {
      let top: [string, number] | null = null;
      for (const entry of g.wins) if (!top || entry[1] > top[1]) top = entry;
      return {
        game_id: g.game_id,
        game_name: g.game_name,
        game_emoji: g.game_emoji,
        game_color: g.game_color,
        played: g.played,
        top_player_id: top?.[0] ?? null,
        top_player_wins: top?.[1] ?? 0,
      };
    })
    .sort((a, b) => b.played - a.played);

  const recent = [...finished]
    .sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    .slice(0, 10)
    .map((m) => ({
      id: m.id,
      game_name: m.game_name,
      game_emoji: m.game_emoji,
      game_color: m.game_color,
      finished_at: m.finished_at,
      winner_names: m.players.filter((p) => m.winner_ids.includes(p.id)).map((p) => p.name),
      rounds: m.rounds.length,
    }));

  return {
    reset_at: resetAt,
    can_undo_reset: store.getSetting('stats_prev_reset_at') !== null,
    total_matches: matches.length,
    finished_matches: finished.length,
    active_matches: matches.filter((m) => m.status === 'active').length,
    players: playerStats,
    games,
    recent,
  };
}

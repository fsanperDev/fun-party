/**
 * Todas las operaciones de Fun Party sobre un `Repo`.
 *
 * Lo usan tanto la API Express (SQLite) como el modo local del navegador
 * (IndexedDB, para GitHub Pages), de modo que la lógica es idéntica en ambos.
 * Las integraciones que necesitan secretos (IA, BoardGameGeek) quedan fuera:
 * solo existen en el servidor.
 */
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
import type { GameDoc, MatchDoc, PlayerDoc } from '../engine/types.js';
import { DEFAULT_AVATAR, PLAYER_COLORS } from '../lib/constants.js';
import { HttpError, notFound } from './errors.js';
import { applyGameFields, blankGame, sortGames } from './games.js';
import { buildMatch, type SeatInput } from './matches.js';
import type { Repo } from './repo.js';
import { computeStats } from './stats.js';
import { uuid } from './uuid.js';
import { str } from './validate.js';

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

/** Habituales primero (por su orden) y después el resto por fecha de alta. */
export function sortPlayers(players: PlayerDoc[]) {
  return [...players].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    if (a.favorite && b.favorite) return (a.favorite_order ?? 0) - (b.favorite_order ?? 0);
    return a.created_at.localeCompare(b.created_at);
  });
}

type Body = Record<string, unknown> | undefined;

export function createService(repo: Repo, seedGames: () => GameDoc[]) {
  const mustGame = (id: string) => repo.get<GameDoc>('games', id) ?? (() => { throw notFound('Juego'); })();
  const mustPlayer = (id: string) => repo.get<PlayerDoc>('players', id) ?? (() => { throw notFound('Jugador'); })();
  const mustMatch = (id: string) => repo.get<MatchDoc>('matches', id) ?? (() => { throw notFound('Partida'); })();
  const nextOrder = () => Math.max(-1, ...repo.all<GameDoc>('games').map((g) => g.sort_order)) + 1;

  const renumberFavorites = () =>
    sortPlayers(repo.all<PlayerDoc>('players'))
      .filter((p) => p.favorite)
      .forEach((p, i) => {
        if (p.favorite_order !== i) repo.put('players', { ...p, favorite_order: i });
      });

  const mutate = (id: string, fn: (m: MatchDoc) => MatchDoc) => {
    const m = fn(mustMatch(id));
    repo.put('matches', m);
    return viewMatch(m);
  };

  return {
    /** Inserta el catálogo oficial si la base de datos está vacía. */
    seedIfEmpty() {
      if (repo.all('games').length) return false;
      repo.transaction(() => seedGames().forEach((g) => repo.put('games', g)));
      return true;
    },

    games: {
      list: () => sortGames(repo.all<GameDoc>('games')),
      get: (id: string) => mustGame(id),
      create(body: Body) {
        const name = str(body?.name, 80);
        if (!name) throw new HttpError(400, 'El nombre es obligatorio');
        const g = applyGameFields(blankGame(uuid(), nextOrder()), body ?? {});
        g.name = name;
        repo.put('games', g);
        return g;
      },
      /** Ficha vacía en estado "pending" para que la IA la complete (solo servidor). */
      createPending(name: string) {
        const g = blankGame(uuid(), nextOrder());
        g.name = name;
        g.ai_status = 'pending';
        repo.put('games', g);
        return g;
      },
      update(id: string, body: Body) {
        const g = applyGameFields(mustGame(id), body ?? {});
        repo.put('games', g);
        return g;
      },
      reset(id: string) {
        const g = mustGame(id);
        const official = seedGames().find((s) => s.id === g.id);
        if (!official) throw new HttpError(400, 'Este juego no tiene valores oficiales que restablecer');
        const restored: GameDoc = { ...official, hidden: g.hidden, images: g.images, image_url: g.image_url };
        repo.put('games', restored);
        return restored;
      },
      remove(id: string) {
        const g = mustGame(id);
        if (!g.is_custom) throw new HttpError(400, 'Los juegos del catálogo no se borran: puedes ocultarlos');
        repo.delete('games', g.id);
        return { ok: true as const };
      },
    },

    players: {
      list: () => sortPlayers(repo.all<PlayerDoc>('players')),
      create(body: Body) {
        const name = str(body?.name, 40);
        if (!name) throw new HttpError(400, 'El nombre es obligatorio');
        const all = repo.all<PlayerDoc>('players');
        if (all.some((p) => norm(p.name) === norm(name))) throw new HttpError(400, 'Ya existe un jugador con ese nombre');
        const used = new Set(all.map((p) => p.color.toUpperCase()));
        const color =
          str(body?.color, 9) || (PLAYER_COLORS.find((c) => !used.has(c.hex.toUpperCase())) ?? PLAYER_COLORS[0]).hex;
        const favorite = Boolean(body?.favorite);
        const player: PlayerDoc = {
          id: uuid(),
          name,
          avatar: str(body?.avatar, 16) || DEFAULT_AVATAR,
          color,
          favorite,
          favorite_order: favorite ? all.filter((p) => p.favorite).length : null,
          created_at: new Date().toISOString(),
        };
        repo.put('players', player);
        return player;
      },
      update(id: string, body: Body) {
        const p = { ...mustPlayer(id) };
        const all = repo.all<PlayerDoc>('players');
        if (body?.name !== undefined) {
          const name = str(body.name, 40);
          if (!name) throw new HttpError(400, 'El nombre es obligatorio');
          if (all.some((o) => o.id !== p.id && norm(o.name) === norm(name)))
            throw new HttpError(400, 'Ya existe un jugador con ese nombre');
          p.name = name;
        }
        if (body?.avatar !== undefined) p.avatar = str(body.avatar, 16) || DEFAULT_AVATAR;
        if (body?.color !== undefined) p.color = str(body.color, 9) || p.color;
        if (body?.favorite !== undefined) {
          const fav = Boolean(body.favorite);
          if (fav && !p.favorite) p.favorite_order = all.filter((o) => o.favorite).length;
          if (!fav) p.favorite_order = null;
          p.favorite = fav;
        }
        repo.put('players', p);
        renumberFavorites();
        return mustPlayer(p.id);
      },
      /** Reordena los habituales con el orden de `ids`. */
      order(ids: unknown) {
        const list: string[] = Array.isArray(ids) ? ids.map(String) : [];
        repo.transaction(() =>
          list.forEach((id, i) => {
            const p = repo.get<PlayerDoc>('players', id);
            if (p?.favorite) repo.put('players', { ...p, favorite_order: i });
          }),
        );
        return sortPlayers(repo.all<PlayerDoc>('players'));
      },
      remove(id: string) {
        if (!repo.delete('players', id)) throw notFound('Jugador');
        renumberFavorites();
        return { ok: true as const };
      },
    },

    matches: {
      list: () => repo.all<MatchDoc>('matches').map(viewMatch),
      get: (id: string) => viewMatch(mustMatch(id)),
      create(body: Body) {
        const game = mustGame(String(body?.game_id ?? ''));
        const seats: SeatInput[] = Array.isArray(body?.players)
          ? (body.players as Array<{ id?: unknown; color?: unknown } | string>).map((p) =>
              typeof p === 'string' ? { id: p } : { id: String(p.id ?? ''), color: p.color ? String(p.color) : undefined },
            )
          : [];
        const teams: string[][] | null = Array.isArray(body?.teams)
          ? (body.teams as unknown[]).map((t) => (Array.isArray(t) ? t.map(String) : []))
          : null;
        const match = buildMatch(
          game,
          repo.all<PlayerDoc>('players'),
          seats,
          teams,
          body?.settings as Record<string, unknown> | undefined,
        );
        repo.put('matches', match);
        return viewMatch(match);
      },
      remove(id: string) {
        if (!repo.delete('matches', id)) throw notFound('Partida');
        return { ok: true as const };
      },
      score: (id: string, playerId: unknown, value: unknown) => mutate(id, (m) => addScore(m, String(playerId ?? ''), value)),
      skip: (id: string) => mutate(id, skipTurn),
      undo: (id: string) => mutate(id, undoLast),
      addRound: (id: string, entries: unknown) => mutate(id, (m) => addRound(m, entries)),
      editRound: (id: string, rid: string, entries: unknown) => mutate(id, (m) => editRound(m, rid, entries)),
      deleteRound: (id: string, rid: string) => mutate(id, (m) => deleteRound(m, rid)),
      finish: (id: string) => mutate(id, (m) => finishNow(m)),
      reopen: (id: string) => mutate(id, reopen),
      /** Revancha: mismo juego, mismos jugadores/equipos y mismos ajustes. */
      rematch(id: string) {
        const old = mustMatch(id);
        const match: MatchDoc = settleStatus({
          ...old,
          id: uuid(),
          players: old.players.map((p) => ({ ...p })),
          rounds: [],
          turn_offset: 0,
          status: 'active',
          manually_finished: false,
          winner_ids: [],
          created_at: new Date().toISOString(),
          finished_at: null,
        });
        repo.put('matches', match);
        return viewMatch(match);
      },
    },

    stats: {
      get: () => computeStats(repo),
      reset() {
        repo.setSetting('stats_prev_reset_at', repo.getSetting('stats_reset_at') ?? '');
        repo.setSetting('stats_reset_at', new Date().toISOString());
        return computeStats(repo);
      },
      undoReset() {
        const prev = repo.getSetting('stats_prev_reset_at');
        if (prev === null) throw new HttpError(400, 'No hay ningún reinicio que deshacer');
        repo.setSetting('stats_reset_at', prev || null);
        repo.deleteSetting('stats_prev_reset_at');
        return computeStats(repo);
      },
    },
  };
}

export type Service = ReturnType<typeof createService>;

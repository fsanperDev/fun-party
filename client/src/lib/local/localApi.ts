/**
 * Implementación de `api` sin servidor: ejecuta el mismo núcleo que la API
 * (server/src/core/service.ts) directamente en el navegador.
 */
import { createService } from '../../../../server/src/core/service';
import seedGames from '../../../../server/src/seed-games.json';
import type { GameDoc } from '../../../../server/src/engine/types';
import { ApiError, type Api } from '../api';
import type { Game, Match, NewMatchInput, Player, Stats } from '../types';
import { LocalRepo } from './localRepo';

const unavailable = (what: string) =>
  new ApiError(503, `${what} no está disponible en la versión web estática (GitHub Pages).`);

export async function createLocalApi(): Promise<Api & { backup: Backup }> {
  const repo = await LocalRepo.open();
  const svc = createService(repo, () => structuredClone(seedGames) as unknown as GameDoc[]);
  svc.seedIfEmpty();

  /** Convierte a promesa, copia el resultado y traduce los errores del núcleo. */
  const run = <T>(fn: () => unknown): Promise<T> => {
    try {
      return Promise.resolve(structuredClone(fn()) as T);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      return Promise.reject(new ApiError(err.status ?? 500, err.message ?? 'Error'));
    }
  };

  const backup: Backup = {
    persistent: repo.persistent,
    export: () => repo.exportAll(),
    import: async (data) => {
      repo.importAll(data as ReturnType<LocalRepo['exportAll']>);
      svc.seedIfEmpty();
      await repo.flush();
    },
  };

  return {
    backup,
    games: {
      list: () => run<Game[]>(() => svc.games.list()),
      get: (id) => run<Game>(() => svc.games.get(id)),
      integrations: () => Promise.resolve({ ai: false, bgg: false }),
      create: (body) => run<Game>(() => svc.games.create(body as Record<string, unknown>)),
      createWithAi: () => Promise.reject(unavailable('La creación con IA')),
      update: (id, body) => run<Game>(() => svc.games.update(id, body as Record<string, unknown>)),
      reset: (id) => run<Game>(() => svc.games.reset(id)),
      importBgg: () => Promise.reject(unavailable('Importar desde BoardGameGeek')),
      remove: (id) => run(() => svc.games.remove(id)),
    },
    players: {
      list: () => run<Player[]>(() => svc.players.list()),
      create: (body) => run<Player>(() => svc.players.create(body as Record<string, unknown>)),
      update: (id, body) => run<Player>(() => svc.players.update(id, body as Record<string, unknown>)),
      order: (ids) => run<Player[]>(() => svc.players.order(ids)),
      remove: (id) => run(() => svc.players.remove(id)),
    },
    matches: {
      list: () => run<Match[]>(() => svc.matches.list()),
      get: (id) => run<Match>(() => svc.matches.get(id)),
      create: (body: NewMatchInput) => run<Match>(() => svc.matches.create(body as unknown as Record<string, unknown>)),
      remove: (id) => run(() => svc.matches.remove(id)),
      score: (id, pid, value) => run<Match>(() => svc.matches.score(id, pid, value)),
      skip: (id) => run<Match>(() => svc.matches.skip(id)),
      undo: (id) => run<Match>(() => svc.matches.undo(id)),
      addRound: (id, entries) => run<Match>(() => svc.matches.addRound(id, entries)),
      editRound: (id, rid, entries) => run<Match>(() => svc.matches.editRound(id, rid, entries)),
      deleteRound: (id, rid) => run<Match>(() => svc.matches.deleteRound(id, rid)),
      finish: (id) => run<Match>(() => svc.matches.finish(id)),
      reopen: (id) => run<Match>(() => svc.matches.reopen(id)),
      rematch: (id) => run<Match>(() => svc.matches.rematch(id)),
    },
    stats: {
      get: () => run<Stats>(() => svc.stats.get()),
      reset: () => run<Stats>(() => svc.stats.reset()),
      undoReset: () => run<Stats>(() => svc.stats.undoReset()),
    },
  };
}

export interface Backup {
  persistent: boolean;
  export: () => unknown;
  import: (data: unknown) => Promise<void>;
}

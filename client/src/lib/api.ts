import type { Game, Match, NewMatchInput, Player, Stats } from './types';

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { detail?: string }).detail ?? `Error ${res.status}`);
  return data as T;
}

const remoteApi = {
  games: {
    list: () => req<Game[]>('GET', '/games'),
    get: (id: string) => req<Game>('GET', `/games/${id}`),
    integrations: () => req<{ ai: boolean; bgg: boolean }>('GET', '/games/integrations'),
    create: (body: Partial<Game>) => req<Game>('POST', '/games', body),
    createWithAi: (name: string) => req<Game>('POST', '/games/ai', { name }),
    update: (id: string, body: Partial<Game>) => req<Game>('PUT', `/games/${id}`, body),
    reset: (id: string) => req<Game>('POST', `/games/${id}/reset`),
    importBgg: (id: string, url: string) => req<Game>('POST', `/games/${id}/bgg`, { url }),
    remove: (id: string) => req<{ ok: true }>('DELETE', `/games/${id}`),
  },
  players: {
    list: () => req<Player[]>('GET', '/players'),
    create: (body: Partial<Player>) => req<Player>('POST', '/players', body),
    update: (id: string, body: Partial<Player>) => req<Player>('PUT', `/players/${id}`, body),
    order: (ids: string[]) => req<Player[]>('PUT', '/players/order', { ids }),
    remove: (id: string) => req<{ ok: true }>('DELETE', `/players/${id}`),
  },
  matches: {
    list: () => req<Match[]>('GET', '/matches'),
    get: (id: string) => req<Match>('GET', `/matches/${id}`),
    create: (body: NewMatchInput) => req<Match>('POST', '/matches', body),
    remove: (id: string) => req<{ ok: true }>('DELETE', `/matches/${id}`),
    score: (id: string, player_id: string, value: number) => req<Match>('POST', `/matches/${id}/scores`, { player_id, value }),
    skip: (id: string) => req<Match>('POST', `/matches/${id}/skip`),
    undo: (id: string) => req<Match>('POST', `/matches/${id}/undo`),
    addRound: (id: string, entries: { player_id: string; value: number | null }[]) =>
      req<Match>('POST', `/matches/${id}/rounds`, { entries }),
    editRound: (id: string, rid: string, entries: { player_id: string; value: number | null }[]) =>
      req<Match>('PUT', `/matches/${id}/rounds/${rid}`, { entries }),
    deleteRound: (id: string, rid: string) => req<Match>('DELETE', `/matches/${id}/rounds/${rid}`),
    finish: (id: string) => req<Match>('POST', `/matches/${id}/finish`),
    reopen: (id: string) => req<Match>('POST', `/matches/${id}/reopen`),
    rematch: (id: string) => req<Match>('POST', `/matches/${id}/rematch`),
  },
  stats: {
    get: () => req<Stats>('GET', '/stats'),
    reset: () => req<Stats>('POST', '/stats/reset'),
    undoReset: () => req<Stats>('POST', '/stats/reset/undo'),
  },
};

export type Api = typeof remoteApi;

/** true en la versión estática (GitHub Pages): los datos se guardan en el navegador. */
export const LOCAL_MODE = import.meta.env.VITE_STORAGE === 'local';

/**
 * Cliente activo. Es un enlace "vivo" de ES modules: en modo local se sustituye
 * al arrancar (ver main.tsx) antes de pintar la app.
 */
export let api: Api = remoteApi;
export function setApi(a: Api) {
  api = a;
}

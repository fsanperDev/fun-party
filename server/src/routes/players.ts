import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import type { Store } from '../db.js';
import type { PlayerDoc } from '../engine/types.js';
import { DEFAULT_AVATAR, PLAYER_COLORS } from '../lib/constants.js';
import { h, HttpError, notFound, str } from '../lib/http.js';

const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Habituales primero (por su orden) y después el resto por fecha de alta. */
export function sortPlayers(players: PlayerDoc[]) {
  return [...players].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
    if (a.favorite && b.favorite) return (a.favorite_order ?? 0) - (b.favorite_order ?? 0);
    return a.created_at.localeCompare(b.created_at);
  });
}

function renumberFavorites(store: Store, players: PlayerDoc[]) {
  sortPlayers(players)
    .filter((p) => p.favorite)
    .forEach((p, i) => {
      if (p.favorite_order !== i) {
        p.favorite_order = i;
        store.put('players', p);
      }
    });
}

export function playersRouter(store: Store) {
  const r = Router();

  r.get('/', h(() => sortPlayers(store.all<PlayerDoc>('players'))));

  r.post(
    '/',
    h((req) => {
      const name = str(req.body?.name, 40);
      if (!name) throw new HttpError(400, 'El nombre es obligatorio');
      const all = store.all<PlayerDoc>('players');
      if (all.some((p) => norm(p.name) === norm(name)))
        throw new HttpError(400, 'Ya existe un jugador con ese nombre');
      const used = new Set(all.map((p) => p.color.toUpperCase()));
      const color =
        str(req.body?.color, 9) ||
        (PLAYER_COLORS.find((c) => !used.has(c.hex.toUpperCase())) ?? PLAYER_COLORS[0]).hex;
      const favorite = Boolean(req.body?.favorite);
      const player: PlayerDoc = {
        id: randomUUID(),
        name,
        avatar: str(req.body?.avatar, 16) || DEFAULT_AVATAR,
        color,
        favorite,
        favorite_order: favorite ? all.filter((p) => p.favorite).length : null,
        created_at: new Date().toISOString(),
      };
      store.put('players', player);
      return player;
    }),
  );

  /** Reordenar habituales: { ids: [...] } en el orden deseado. */
  r.put(
    '/order',
    h((req) => {
      const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
      store.transaction(() => {
        ids.forEach((id, i) => {
          const p = store.get<PlayerDoc>('players', id);
          if (p && p.favorite) {
            p.favorite_order = i;
            store.put('players', p);
          }
        });
      });
      return sortPlayers(store.all<PlayerDoc>('players'));
    }),
  );

  r.put(
    '/:id',
    h((req) => {
      const p = store.get<PlayerDoc>('players', req.params.id);
      if (!p) throw notFound('Jugador');
      const all = store.all<PlayerDoc>('players');
      if (req.body?.name !== undefined) {
        const name = str(req.body.name, 40);
        if (!name) throw new HttpError(400, 'El nombre es obligatorio');
        if (all.some((o) => o.id !== p.id && norm(o.name) === norm(name)))
          throw new HttpError(400, 'Ya existe un jugador con ese nombre');
        p.name = name;
      }
      if (req.body?.avatar !== undefined) p.avatar = str(req.body.avatar, 16) || DEFAULT_AVATAR;
      if (req.body?.color !== undefined) p.color = str(req.body.color, 9) || p.color;
      if (req.body?.favorite !== undefined) {
        const fav = Boolean(req.body.favorite);
        if (fav && !p.favorite) p.favorite_order = all.filter((o) => o.favorite).length;
        if (!fav) p.favorite_order = null;
        p.favorite = fav;
      }
      store.put('players', p);
      renumberFavorites(store, store.all<PlayerDoc>('players'));
      return store.get<PlayerDoc>('players', p.id);
    }),
  );

  r.delete(
    '/:id',
    h((req) => {
      if (!store.delete('players', req.params.id)) throw notFound('Jugador');
      renumberFavorites(store, store.all<PlayerDoc>('players'));
      return { ok: true };
    }),
  );

  return r;
}

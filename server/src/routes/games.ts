import { Router } from 'express';
import { applyGameFields } from '../core/games.js';
import type { Repo } from '../core/repo.js';
import type { Service } from '../core/service.js';
import type { GameDoc } from '../engine/types.js';
import { h, HttpError, str } from '../lib/http.js';
import { bggIdFromUrl, bggSearch, bggThing, generateGameSheet, integrations } from '../lib/integrations.js';

export function gamesRouter(svc: Service, repo: Repo) {
  const r = Router();

  r.get('/', h(() => svc.games.list()));
  r.get('/integrations', h(() => ({ ai: integrations.aiEnabled(), bgg: integrations.bggEnabled() })));
  r.get('/:id', h((req) => svc.games.get(req.params.id)));
  /** Alta manual ("Prefiero rellenarlo yo"). */
  r.post('/', h((req) => svc.games.create(req.body)));

  /** "Crear ficha con IA": crea la ficha en estado pending y la completa en segundo plano. */
  r.post(
    '/ai',
    h((req) => {
      const name = str(req.body?.name, 80);
      if (!name) throw new HttpError(400, 'Escribe el nombre del juego');
      if (!integrations.aiEnabled())
        throw new HttpError(503, 'La creación con IA no está configurada (falta ANTHROPIC_API_KEY). Usa «Prefiero rellenarlo yo».');
      const g = svc.games.createPending(name);
      void (async () => {
        try {
          const sheet = await generateGameSheet(name);
          const current = repo.get<GameDoc>('games', g.id);
          if (!current) return;
          const filled = applyGameFields(current, sheet as unknown as Record<string, unknown>);
          filled.name = sheet.name || name;
          const bggId = await bggSearch(filled.name).catch(() => null);
          if (bggId) {
            const thing = await bggThing(bggId).catch(() => null);
            if (thing?.image) {
              filled.bgg_id = bggId;
              filled.image_url = thing.image;
              filled.images = [thing.image];
            }
          }
          filled.ai_status = 'ready';
          filled.ai_error = null;
          repo.put('games', filled);
        } catch (e) {
          const current = repo.get<GameDoc>('games', g.id);
          if (current) repo.put('games', { ...current, ai_status: 'error', ai_error: e instanceof Error ? e.message : String(e) });
        }
      })();
      return g;
    }),
  );

  r.put('/:id', h((req) => svc.games.update(req.params.id, req.body)));
  /** "Restablecer valores oficiales" (solo juegos del catálogo). */
  r.post('/:id/reset', h((req) => svc.games.reset(req.params.id)));

  /** Importar imágenes oficiales desde un enlace de BoardGameGeek. */
  r.post(
    '/:id/bgg',
    h(async (req) => {
      const g = svc.games.get(req.params.id);
      const id = bggIdFromUrl(str(req.body?.url, 500));
      if (!id) throw new HttpError(400, 'Pega un enlace de boardgamegeek.com/boardgame/…');
      const thing = await bggThing(id);
      const add = [thing.image].filter((x): x is string => Boolean(x) && !g.images.includes(x as string));
      const images = [...g.images, ...add];
      return svc.games.update(g.id, { images, image_url: g.image_url ?? images[0] ?? null, bgg_id: id });
    }),
  );

  r.delete('/:id', h((req) => svc.games.remove(req.params.id)));
  return r;
}

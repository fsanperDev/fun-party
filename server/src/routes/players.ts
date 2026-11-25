import { Router } from 'express';
import type { Service } from '../core/service.js';
import { h } from '../lib/http.js';

export function playersRouter(svc: Service) {
  const r = Router();
  r.get('/', h(() => svc.players.list()));
  r.post('/', h((req) => svc.players.create(req.body)));
  /** Reordenar habituales: { ids: [...] } en el orden deseado. */
  r.put('/order', h((req) => svc.players.order(req.body?.ids)));
  r.put('/:id', h((req) => svc.players.update(req.params.id, req.body)));
  r.delete('/:id', h((req) => svc.players.remove(req.params.id)));
  return r;
}

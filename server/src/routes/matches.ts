import { Router } from 'express';
import type { Service } from '../core/service.js';
import { h } from '../lib/http.js';

export function matchesRouter(svc: Service) {
  const r = Router();
  const m = svc.matches;
  r.get('/', h(() => m.list()));
  r.get('/:id', h((req) => m.get(req.params.id)));
  r.post('/', h((req) => m.create(req.body)));
  r.delete('/:id', h((req) => m.remove(req.params.id)));
  r.post('/:id/scores', h((req) => m.score(req.params.id, req.body?.player_id, req.body?.value)));
  r.post('/:id/skip', h((req) => m.skip(req.params.id)));
  r.post('/:id/undo', h((req) => m.undo(req.params.id)));
  r.post('/:id/rounds', h((req) => m.addRound(req.params.id, req.body?.entries)));
  r.put('/:id/rounds/:rid', h((req) => m.editRound(req.params.id, req.params.rid, req.body?.entries)));
  r.delete('/:id/rounds/:rid', h((req) => m.deleteRound(req.params.id, req.params.rid)));
  r.post('/:id/finish', h((req) => m.finish(req.params.id)));
  r.post('/:id/reopen', h((req) => m.reopen(req.params.id)));
  r.post('/:id/rematch', h((req) => m.rematch(req.params.id)));
  return r;
}

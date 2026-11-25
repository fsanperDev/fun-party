import { Router } from 'express';
import type { Service } from '../core/service.js';
import { h } from '../lib/http.js';

export function statsRouter(svc: Service) {
  const r = Router();
  r.get('/', h(() => svc.stats.get()));
  r.post('/reset', h(() => svc.stats.reset()));
  r.post('/reset/undo', h(() => svc.stats.undoReset()));
  return r;
}

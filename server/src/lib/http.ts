import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { EngineError } from '../engine/scoring.js';

export { HttpError, notFound } from '../core/errors.js';
import { HttpError } from '../core/errors.js';

/** Envuelve handlers async para enviar los errores al middleware. */
type Req = Request<Record<string, string>>;

export const h =
  (fn: (req: Req, res: Response) => unknown | Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req as unknown as Req, res))
      .then((out) => {
        if (!res.headersSent) res.json(out ?? { ok: true });
      })
      .catch(next);
  };

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError || err instanceof EngineError) {
    res.status(err.status).json({ detail: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ detail: 'Error interno del servidor' });
}

export { int, str, strList } from '../core/validate.js';

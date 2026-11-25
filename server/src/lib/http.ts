import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { EngineError } from '../engine/scoring.js';

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} no encontrado`);

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

export const str = (v: unknown, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
export const int = (v: unknown, fallback: number | null = null): number | null => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
};
export const strList = (v: unknown, maxItems = 40): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, 1000)).filter(Boolean).slice(0, maxItems) : [];

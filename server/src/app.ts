import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createService } from './core/service.js';
import { loadSeedGames, Store } from './db.js';
import { errorHandler } from './lib/http.js';
import { gamesRouter } from './routes/games.js';
import { matchesRouter } from './routes/matches.js';
import { playersRouter } from './routes/players.js';
import { statsRouter } from './routes/stats.js';

export interface AppOptions {
  dbFile: string;
  /** Carpeta con el build del frontend para servirlo en producción. */
  staticDir?: string;
}

export function createApp({ dbFile, staticDir }: AppOptions) {
  const store = new Store(dbFile);
  const svc = createService(store, loadSeedGames);
  svc.seedIfEmpty();

  const app = express();
  app.disable('x-powered-by');
  app.use(cors());
  // Las fotos subidas se guardan como data URL dentro de la ficha del juego.
  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/games', gamesRouter(svc, store));
  app.use('/api/players', playersRouter(svc));
  app.use('/api/matches', matchesRouter(svc));
  app.use('/api/stats', statsRouter(svc));
  app.use('/api', (_req, res) => res.status(404).json({ detail: 'Ruta no encontrada' }));

  if (staticDir && fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  }

  app.use(errorHandler);
  return { app, store };
}

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const PORT = Number(process.env.PORT) || 8001;
const DB_FILE = process.env.DB_FILE || path.join(root, 'data', 'fun-party.db');
const STATIC_DIR = process.env.STATIC_DIR || path.resolve(root, '..', 'client', 'dist');

const { app } = createApp({ dbFile: DB_FILE, staticDir: STATIC_DIR });

app.listen(PORT, () => {
  console.log(`Fun Party API escuchando en http://localhost:${PORT}`);
  console.log(`Base de datos: ${DB_FILE}`);
});

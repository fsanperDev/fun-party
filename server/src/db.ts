/**
 * Persistencia en SQLite (better-sqlite3).
 * Cada colección es una tabla con (id, data JSON, orden/fecha) para mantener
 * el mismo modelo de documentos que expone la API.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GameDoc, MatchDoc, PlayerDoc } from './engine/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export type Collection = 'games' | 'players' | 'matches';

export class Store {
  db: Database.Database;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new Database(file);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.migrate();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS games   (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, data TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE INDEX IF NOT EXISTS matches_created ON matches(created_at);
    `);
  }

  all<T>(table: Collection): T[] {
    const order = table === 'matches' ? 'ORDER BY created_at DESC' : '';
    return this.db
      .prepare(`SELECT data FROM ${table} ${order}`)
      .all()
      .map((r) => JSON.parse((r as { data: string }).data) as T);
  }

  get<T>(table: Collection, id: string): T | null {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id = ?`).get(id) as
      | { data: string }
      | undefined;
    return row ? (JSON.parse(row.data) as T) : null;
  }

  put(table: Collection, doc: { id: string; created_at?: string }) {
    if (table === 'matches') {
      this.db
        .prepare(
          `INSERT INTO matches (id, data, created_at) VALUES (@id, @data, @created_at)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        )
        .run({ id: doc.id, data: JSON.stringify(doc), created_at: doc.created_at ?? new Date().toISOString() });
    } else {
      this.db
        .prepare(
          `INSERT INTO ${table} (id, data) VALUES (@id, @data)
           ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
        )
        .run({ id: doc.id, data: JSON.stringify(doc) });
    }
  }

  delete(table: Collection, id: string): boolean {
    return this.db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id).changes > 0;
  }

  getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string | null }
      | undefined;
    return row?.value ?? null;
  }

  setSetting(key: string, value: string | null) {
    this.db
      .prepare(
        'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      )
      .run(key, value);
  }

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}

/** Catálogo oficial de juegos (extraído de la app original). */
export function loadSeedGames(): GameDoc[] {
  const file = path.join(here, 'seed-games.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as GameDoc[];
}

/** Inserta el catálogo de juegos la primera vez que arranca la base de datos. */
export function seedIfEmpty(store: Store) {
  const count = store.db.prepare('SELECT COUNT(*) AS n FROM games').get() as { n: number };
  if (count.n > 0) return false;
  store.transaction(() => {
    for (const g of loadSeedGames()) store.put('games', g);
  });
  return true;
}

export type { GameDoc, MatchDoc, PlayerDoc };

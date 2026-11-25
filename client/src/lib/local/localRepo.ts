/**
 * Repo del modo local (GitHub Pages): los datos viven en memoria para que las
 * operaciones sean síncronas (igual que SQLite en el servidor) y cada cambio se
 * guarda en IndexedDB. Al arrancar se carga todo desde IndexedDB.
 */
import type { Collection, Repo } from '../../../../server/src/core/repo';

const DB_NAME = 'fun-party';
const STORES = ['games', 'players', 'matches', 'settings'] as const;
type StoreName = (typeof STORES)[number];

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function readAll(db: IDBDatabase, store: StoreName): Promise<Map<string, string>> {
  return new Promise((resolve, reject) => {
    const map = new Map<string, string>();
    const req = db.transaction(store, 'readonly').objectStore(store).openCursor();
    req.onsuccess = () => {
      const cur = req.result;
      if (!cur) return resolve(map);
      map.set(String(cur.key), cur.value as string);
      cur.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

export class LocalRepo implements Repo {
  private data: Record<StoreName, Map<string, string>> = {
    games: new Map(),
    players: new Map(),
    matches: new Map(),
    settings: new Map(),
  };
  private db: IDBDatabase | null = null;
  private pending = new Set<Promise<void>>();
  /** false si el navegador no permite IndexedDB (los datos se perderían al cerrar). */
  persistent = false;

  static async open(): Promise<LocalRepo> {
    const repo = new LocalRepo();
    try {
      repo.db = await openDb();
      for (const s of STORES) repo.data[s] = await readAll(repo.db, s);
      repo.persistent = true;
    } catch (e) {
      console.warn('IndexedDB no disponible; los datos no se guardarán', e);
    }
    return repo;
  }

  private write(store: StoreName, key: string, value: string | null) {
    if (!this.db) return;
    try {
      const tx = this.db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      if (value === null) os.delete(key);
      else os.put(value, key);
      const done: Promise<void> = new Promise((resolve) => {
        tx.oncomplete = tx.onerror = tx.onabort = () => resolve();
      });
      this.pending.add(done);
      void done.then(() => this.pending.delete(done));
    } catch (e) {
      console.error('No se pudo guardar en IndexedDB', e);
    }
  }

  all<T>(table: Collection): T[] {
    const docs = [...this.data[table].values()].map((v) => JSON.parse(v) as T);
    if (table === 'matches')
      (docs as unknown as { created_at: string }[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return docs;
  }

  get<T>(table: Collection, id: string): T | null {
    const v = this.data[table].get(id);
    return v ? (JSON.parse(v) as T) : null;
  }

  put<T extends { id: string; created_at?: string }>(table: Collection, doc: T) {
    const v = JSON.stringify(doc);
    this.data[table].set(doc.id, v);
    this.write(table, doc.id, v);
  }

  delete(table: Collection, id: string) {
    const had = this.data[table].delete(id);
    if (had) this.write(table, id, null);
    return had;
  }

  getSetting(key: string) {
    const v = this.data.settings.get(key);
    return v === undefined ? null : (JSON.parse(v) as string | null);
  }

  setSetting(key: string, value: string | null) {
    const v = JSON.stringify(value);
    this.data.settings.set(key, v);
    this.write('settings', key, v);
  }

  deleteSetting(key: string) {
    this.data.settings.delete(key);
    this.write('settings', key, null);
  }

  /** Espera a que todas las escrituras pendientes queden guardadas en IndexedDB. */
  async flush() {
    await Promise.all([...this.pending]);
  }

  transaction<T>(fn: () => T): T {
    return fn();
  }

  /** Copia de seguridad completa en JSON. */
  exportAll() {
    const parse = (m: Map<string, string>) => [...m.values()].map((v) => JSON.parse(v));
    return {
      app: 'fun-party',
      version: 1,
      exported_at: new Date().toISOString(),
      games: parse(this.data.games),
      players: parse(this.data.players),
      matches: parse(this.data.matches),
      settings: Object.fromEntries([...this.data.settings].map(([k, v]) => [k, JSON.parse(v)])),
    };
  }

  /** Sustituye todos los datos por los de una copia de seguridad. */
  importAll(backup: ReturnType<LocalRepo['exportAll']>) {
    if (backup?.app !== 'fun-party' || !Array.isArray(backup.games)) throw new Error('El archivo no es una copia de Fun Party');
    for (const s of STORES) {
      for (const k of [...this.data[s].keys()]) this.write(s, k, null);
      this.data[s].clear();
    }
    for (const g of backup.games) this.put('games', g);
    for (const p of backup.players ?? []) this.put('players', p);
    for (const m of backup.matches ?? []) this.put('matches', m);
    for (const [k, v] of Object.entries(backup.settings ?? {})) this.setSetting(k, v as string | null);
  }
}

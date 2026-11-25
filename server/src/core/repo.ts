/** Almacenamiento abstracto: SQLite en el servidor, IndexedDB en el navegador (modo local). */
export type Collection = 'games' | 'players' | 'matches';

export interface Repo {
  all<T>(table: Collection): T[];
  get<T>(table: Collection, id: string): T | null;
  put<T extends { id: string; created_at?: string }>(table: Collection, doc: T): void;
  delete(table: Collection, id: string): boolean;
  getSetting(key: string): string | null;
  setSetting(key: string, value: string | null): void;
  deleteSetting(key: string): void;
  transaction<T>(fn: () => T): T;
}

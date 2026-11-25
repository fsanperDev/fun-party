import type { Backup } from './localApi';

/** Acceso a la copia de seguridad del modo local (null cuando hay servidor). */
let current: Backup | null = null;
export const setBackup = (b: Backup) => {
  current = b;
};
export const getBackup = () => current;

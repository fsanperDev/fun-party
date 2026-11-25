import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Game, Match, MatchSettings } from './types';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/** Normaliza para comparar nombres sin tildes ni mayúsculas. */
export const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

type RuleInput = Pick<MatchSettings, 'mode' | 'win_condition' | 'end_type' | 'target_score' | 'rounds_count' | 'entry_label'> & {
  start: number;
};

/** Frase que resume cómo termina y quién gana (tal cual la redacta la app original). */
export function ruleText(s: RuleInput): string {
  const who = `Gana quien tenga ${s.win_condition === 'high' ? 'MÁS' : 'MENOS'}.`;
  if (s.mode === 'countdown' || s.end_type === 'zero')
    return `Cada uno empieza con ${s.start} ${s.entry_label}. Fin cuando alguien llega a 0. ${who}`;
  if (s.end_type === 'rounds') return `Se juegan ${s.rounds_count ?? '?'} rondas. ${who}`;
  if (s.end_type === 'manual') return `Sin límite: termina cuando decidáis. ${who}`;
  return `Fin al llegar a ${s.target_score ?? '?'} ${s.entry_label}. ${who}`;
}

export const gameRule = (g: Game) =>
  ruleText({ ...g, end_type: g.mode === 'countdown' ? 'zero' : g.end_type, start: g.start_score_default });

export const matchRule = (m: Pick<Match, 'settings'>) => ruleText({ ...m.settings, start: m.settings.start_score });

/**
 * Botones rápidos (+N) del teclado. En la original se observaron:
 * objetivo 100 → +1 +5 +10 · objetivo 500 → +5 +10 +20 +50 · presupuesto 900 → +10 +50 +100 +200.
 */
export function quickSteps(s: MatchSettings): number[] {
  const scale = s.mode === 'countdown' ? s.start_score : s.end_type === 'target' ? s.target_score ?? 100 : 100;
  if (scale >= 800) return [10, 50, 100, 200];
  if (scale >= 300) return [5, 10, 20, 50];
  return [1, 5, 10];
}

/** "14 nov, 20:16" */
export function shortDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  const day = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  const time = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return `${day}, ${time}`;
}

/** "Alejandro", "Alejandro y Fran", "A, B y C" */
export function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

/** Color con transparencia a partir de un hex (#RRGGBB). */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

export const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));

/** Lee un archivo de imagen como data URL reducida (máx. 1024 px) para guardarla en la ficha. */
export function imageFileToDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = url;
  });
}

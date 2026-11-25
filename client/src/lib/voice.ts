/**
 * Intérprete de comandos de voz (o escritos) en español.
 * Cubre la gramática documentada en Ajustes › Voz de la app original:
 *   anotar ("Skyjo, Mariló, menos 3 puntos"), anotar en la partida abierta ("Diego, 12 puntos"),
 *   crear partida, finalizar, deshacer, siguiente jugador, ¿quién gana?, resumen y normas.
 */
import type { Game } from './types';
import { norm } from './utils';

export type VoiceCommand =
  | { type: 'undo' }
  | { type: 'skip' }
  | { type: 'finish' }
  | { type: 'who' }
  | { type: 'summary' }
  | { type: 'rules' }
  | { type: 'create'; game: Game | null; gameText: string; count: number | null; favorites: boolean }
  | { type: 'score'; game: Game | null; playerText: string; value: number }
  | { type: 'unknown'; text: string };

const UNITS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9,
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18,
  diecinueve: 19, veinte: 20, veintiuno: 21, veintiun: 21, veintidos: 22, veintitres: 23, veinticuatro: 24,
  veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29, treinta: 30, cuarenta: 40,
  cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200,
  trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800,
  novecientos: 900, mil: 1000,
};

/** Convierte "treinta y cinco", "ciento veinte" o "1.000" en número. */
export function parseNumberWords(text: string): number | null {
  const digits = text.replace(/(\d)[.](\d{3})\b/g, '$1$2').match(/-?\d+(?:,\d+)?/);
  if (digits) return Number(digits[0].replace(',', '.'));
  const t = norm(text);
  let total = 0;
  let current = 0;
  let found = false;
  for (const w of t.split(' ')) {
    if (w === 'y') continue;
    const v = UNITS[w];
    if (v === undefined) {
      if (found) break;
      continue;
    }
    found = true;
    if (v === 1000) {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
    } else current += v;
  }
  return found ? total + current : null;
}

const NUMBER_WORD = Object.keys(UNITS).join('|');
const NUM_RE = new RegExp(`(?:\\d+(?:[.,]\\d+)?|(?:\\b(?:${NUMBER_WORD})\\b(?:\\s+y)?\\s*)+)`);
const UNIT_RE = /\b(puntos?|pts|euros?|€|victorias?|fichas?|manos?|pilis?|cabezas?)\b/g;

/** Busca el juego cuyo nombre o alias aparece en el texto (el más largo gana). */
export function findGame(text: string, games: Game[]): { game: Game; matched: string } | null {
  const t = ` ${norm(text)} `;
  let best: { game: Game; matched: string } | null = null;
  for (const g of games) {
    for (const cand of [g.name, ...(g.aliases ?? [])]) {
      const c = norm(cand);
      if (!c) continue;
      if (t.includes(` ${c} `) && (!best || c.length > best.matched.length)) best = { game: g, matched: c };
    }
  }
  return best;
}

export function parseCommand(raw: string, games: Game[]): VoiceCommand {
  let t = norm(raw).replace(/^(oye |hey )?fun ?party\s*/, '').trim();
  if (!t) return { type: 'unknown', text: raw };

  if (/^(deshac|deshaz|borra (la )?ultima)/.test(t)) return { type: 'undo' };
  if (/^(siguiente( jugador)?|pasa(r)? (el )?turno|salta(r)?( turno)?)$/.test(t)) return { type: 'skip' };
  if (/^(finaliza|termina|acaba|cierra)(r)?( la)? partida/.test(t)) return { type: 'finish' };
  if (/quien (gana|va ganando|va primero|lidera)/.test(t)) return { type: 'who' };
  if (/^(resumen|clasificacion|marcador)$/.test(t)) return { type: 'summary' };
  if (/^(normas|reglas|reglamento)$/.test(t)) return { type: 'rules' };

  const create = t.match(
    /^(?:crea(?:me|r)?|nueva|empieza|empezar|inicia(?:r)?|vamos a jugar|juguemos)(?: una)?(?: nueva)?(?: partida)?(?: de| a| al)? (.+)$/,
  );
  if (create) {
    let rest = create[1];
    const fav = /con (los )?(jugadores )?habituales/.test(rest);
    rest = rest.replace(/con (los )?(jugadores )?habituales/, ' ');
    let count: number | null = null;
    const cm = rest.match(/para (.+?) jugador(es)?/);
    if (cm) {
      count = parseNumberWords(cm[1]);
      rest = rest.replace(cm[0], ' ');
    }
    const found = findGame(rest, games);
    return { type: 'create', game: found?.game ?? null, gameText: rest.trim(), count, favorites: fav };
  }

  // Anotar: necesita un número.
  const numMatch = t.match(new RegExp(`(menos\\s+|-\\s*)?(${NUM_RE.source})\\s*${UNIT_RE.source.slice(0, -2)}?`));
  if (numMatch) {
    const value = parseNumberWords(numMatch[2]);
    if (value !== null) {
      const negative = Boolean(numMatch[1]) || numMatch[2].trim().startsWith('-');
      let rest = (t.slice(0, numMatch.index) + ' ' + t.slice((numMatch.index ?? 0) + numMatch[0].length))
        .replace(UNIT_RE, ' ')
        .replace(/\b(anota(r)?|suma(r)?|para|a|le|al)\b/g, ' ');
      const found = findGame(rest, games);
      if (found) rest = ` ${rest} `.replace(` ${found.matched} `, ' ');
      const playerText = rest.replace(/\s+/g, ' ').trim();
      if (playerText) return { type: 'score', game: found?.game ?? null, playerText, value: negative ? -Math.abs(value) : value };
    }
  }
  return { type: 'unknown', text: raw };
}

/** Busca un jugador por nombre aproximado (sin tildes; también por prefijo). */
export function matchName<T extends { name: string }>(text: string, items: T[]): T | null {
  const t = norm(text);
  if (!t) return null;
  return (
    items.find((i) => norm(i.name) === t) ??
    items.find((i) => t.includes(norm(i.name)) || norm(i.name).includes(t)) ??
    items.find((i) => norm(i.name).split(' ').some((part) => part && t.split(' ').includes(part))) ??
    null
  );
}

import { describe, expect, it } from 'vitest';
import type { Game } from './types';
import { matchName, parseCommand, parseNumberWords } from './voice';

const g = (id: string, name: string, aliases: string[] = []) => ({ id, name, aliases }) as unknown as Game;
const games = [g('skyjo', 'Skyjo', ['sky jo', 'esquiyo']), g('la-cuenta', 'La Cuenta'), g('uno', 'UNO'), g('virus', 'Virus!')];

describe('parseCommand', () => {
  it('anota con juego, jugador y puntos', () => {
    expect(parseCommand('La Cuenta, Pablo, 100 puntos', games)).toMatchObject({ type: 'score', game: { id: 'la-cuenta' }, playerText: 'pablo', value: 100 });
    expect(parseCommand('Skyjo, Mariló, menos 3 puntos', games)).toMatchObject({ type: 'score', game: { id: 'skyjo' }, playerText: 'marilo', value: -3 });
    expect(parseCommand('esquiyo alejandro cincuenta puntos', games)).toMatchObject({ type: 'score', game: { id: 'skyjo' }, value: 50 });
  });

  it('anota en la partida abierta', () => {
    expect(parseCommand('Diego, 12 puntos', games)).toMatchObject({ type: 'score', game: null, playerText: 'diego', value: 12 });
    expect(parseCommand('Mariló, 7 puntos', games)).toMatchObject({ type: 'score', playerText: 'marilo', value: 7 });
  });

  it('crea partidas', () => {
    expect(parseCommand('Créame una partida de Skyjo con los jugadores habituales', games)).toMatchObject({ type: 'create', game: { id: 'skyjo' }, favorites: true, count: null });
    expect(parseCommand('Nueva partida de La Cuenta para 4 jugadores', games)).toMatchObject({ type: 'create', game: { id: 'la-cuenta' }, count: 4 });
    expect(parseCommand('Fun Party, vamos a jugar a UNO', games)).toMatchObject({ type: 'create', game: { id: 'uno' } });
    expect(parseCommand('nueva partida de virus para tres jugadores', games)).toMatchObject({ type: 'create', game: { id: 'virus' }, count: 3 });
  });

  it('órdenes simples', () => {
    expect(parseCommand('Finalizar partida', games).type).toBe('finish');
    expect(parseCommand('Terminar la partida', games).type).toBe('finish');
    expect(parseCommand('Deshacer', games).type).toBe('undo');
    expect(parseCommand('Siguiente jugador', games).type).toBe('skip');
    expect(parseCommand('¿Quién va ganando?', games).type).toBe('who');
    expect(parseCommand('Resumen', games).type).toBe('summary');
    expect(parseCommand('Normas', games).type).toBe('rules');
    expect(parseCommand('hola', games).type).toBe('unknown');
  });
});

describe('números en palabras', () => {
  it.each([
    ['treinta y cinco', 35],
    ['ciento veinte', 120],
    ['mil', 1000],
    ['dos mil quinientos', 2500],
    ['1.000', 1000],
  ])('%s → %d', (t, n) => expect(parseNumberWords(t)).toBe(n));
});

describe('matchName', () => {
  it('ignora tildes y mayúsculas', () => {
    expect(matchName('marilo', [{ name: 'Mariló' }, { name: 'Pablo' }])?.name).toBe('Mariló');
  });
});

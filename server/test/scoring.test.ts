/**
 * Tests del motor: cada caso reproduce una secuencia observada en la app original
 * durante la auditoría (ver docs/AUDITORIA.md).
 */
import { describe, expect, it } from 'vitest';
import {
  addRound,
  addScore,
  editRound,
  finishNow,
  reopen,
  skipTurn,
  undoLast,
  viewMatch,
} from '../src/engine/scoring.js';
import type { MatchDoc, MatchSettings } from '../src/engine/types.js';

const A = 'alejandro';
const F = 'fran';
const M = 'marilo';

function match(settings: Partial<MatchSettings>, ids = [A, F, M]): MatchDoc {
  return {
    id: 'm1',
    game_id: 'g',
    game_name: 'Juego',
    game_emoji: '🃏',
    game_color: '#06B6D4',
    settings: {
      mode: 'points',
      win_condition: 'high',
      end_type: 'target',
      target_score: 100,
      rounds_count: null,
      start_score: 0,
      entry_mode: 'round',
      entry_label: 'puntos',
      default_entry: null,
      alert_margin: 15,
      ...settings,
    },
    players: ids.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1), avatar: '🃏', color: '#000', member_ids: [], member_names: [] })),
    rounds: [],
    turn_offset: 0,
    status: 'active',
    manually_finished: false,
    winner_ids: [],
    created_at: new Date().toISOString(),
    finished_at: null,
  };
}

describe('Skyjo (todos puntúan cada ronda, gana el que menos, fin a 100)', () => {
  const skyjo = () => match({ win_condition: 'low', alert_margin: 15 });

  it('rota el turno dentro de la ronda y abre la siguiente', () => {
    const m = skyjo();
    addScore(m, A, 12);
    let v = viewMatch(m);
    expect(v.current_player_id).toBe(F);
    expect(v.current_round).toBe(1);
    expect(v.round_complete).toBe(false);
    addScore(m, F, -2);
    skipTurn(m); // Mariló: Saltar anota 0 en modo ronda
    v = viewMatch(m);
    expect(m.rounds[0].entries.map((e) => e.value)).toEqual([12, -2, 0]);
    expect(v.current_round).toBe(2);
    expect(v.current_player_id).toBe(A);
    expect(v.round_complete).toBe(true);
    expect(v.ranking.map((r) => [r.player_id, r.position])).toEqual([
      [F, 1],
      [M, 2],
      [A, 3],
    ]);
  });

  it('anotar fuera de turno y deshacer borra la última anotación', () => {
    const m = skyjo();
    addRound(m, [
      { player_id: A, value: 12 },
      { player_id: F, value: -2 },
      { player_id: M, value: 0 },
    ]);
    addScore(m, M, 15);
    expect(viewMatch(m).current_player_id).toBe(A);
    undoLast(m);
    expect(m.rounds).toHaveLength(1);
  });

  it('avisa cuando alguien se acerca y termina al cerrar la ronda', () => {
    const m = skyjo();
    addRound(m, [{ player_id: A, value: 13 }, { player_id: F, value: -2 }, { player_id: M, value: 0 }]);
    addRound(m, [{ player_id: A, value: 50 }, { player_id: F, value: 30 }, { player_id: M, value: 45 }]);
    addRound(m, [{ player_id: A, value: 25 }, { player_id: F, value: 10 }, { player_id: M, value: 10 }]);
    expect(viewMatch(m).alerts).toEqual(['⚠️ Alejandro está a 12 puntos de llegar a 100 y cerrar la partida']);
    addScore(m, A, 20); // ronda abierta: aún no termina
    expect(m.status).toBe('active');
    addScore(m, F, 5);
    addScore(m, M, 5);
    const v = viewMatch(m);
    expect(m.status).toBe('finished');
    expect(m.winner_ids).toEqual([F]);
    expect(v.ranking.map((r) => `${r.player_id}:${r.total}@${r.position}`)).toEqual([
      'fran:43@1',
      'marilo:60@2',
      'alejandro:108@3',
    ]);
    expect(v.alerts).toEqual([]);
  });

  it('no deja reabrir si se cumple la condición de fin, pero sí tras corregir', () => {
    const m = skyjo();
    addRound(m, [{ player_id: A, value: 120 }, { player_id: F, value: 1 }, { player_id: M, value: 2 }]);
    expect(m.status).toBe('finished');
    expect(() => reopen(m)).toThrow('La partida ya ha alcanzado su condición de fin');
    editRound(m, m.rounds[0].id, [{ player_id: A, value: 20 }, { player_id: F, value: 1 }, { player_id: M, value: 2 }]);
    expect(m.status).toBe('active');
  });
});

describe('Terminar partida ahora', () => {
  it('declara empate en la victoria y permite reabrir', () => {
    const m = match({ win_condition: 'low' });
    addScore(m, A, 2);
    finishNow(m);
    const v = viewMatch(m);
    expect(m.status).toBe('finished');
    expect(m.manually_finished).toBe(true);
    expect(m.winner_ids).toEqual([F, M]);
    expect(v.ranking.map((r) => r.position)).toEqual([1, 1, 3]);
    reopen(m);
    expect(m.status).toBe('active');
    expect(viewMatch(m).current_player_id).toBe(F);
  });
});

describe('UNO (solo uno por anotación, gana el que más, fin a 500)', () => {
  const uno = () => match({ entry_mode: 'free', target_score: 500, alert_margin: 100 }, [A, F]);

  it('cada anotación es una ronda y Saltar desplaza el turno', () => {
    const m = uno();
    addScore(m, A, 20);
    let v = viewMatch(m);
    expect(v.current_round).toBe(2);
    expect(v.current_player_id).toBe(F);
    skipTurn(m);
    v = viewMatch(m);
    expect(m.turn_offset).toBe(1);
    expect(v.current_player_id).toBe(A);
    addScore(m, A, 400);
    v = viewMatch(m);
    expect(v.alerts).toEqual(['🔥 Alejandro está a 80 puntos de ganar la partida']);
    expect(v.current_player_id).toBe(F);
    undoLast(m);
    expect(m.turn_offset).toBe(1);
    expect(viewMatch(m).current_player_id).toBe(A);
  });

  it('termina en cuanto alguien alcanza el objetivo', () => {
    const m = uno();
    addScore(m, A, 510);
    expect(m.status).toBe('finished');
    expect(m.winner_ids).toEqual([A]);
  });
});

describe('La Cuenta (presupuesto que se gasta)', () => {
  it('resta lo pagado, avisa y termina al llegar a 0', () => {
    const m = match({ mode: 'countdown', end_type: 'zero', target_score: null, start_score: 900, entry_mode: 'free', entry_label: '€', alert_margin: 200 });
    addScore(m, A, 850);
    let v = viewMatch(m);
    expect(v.totals[A]).toBe(50);
    expect(v.alerts).toEqual(['💸 Alejandro solo tiene 50 €: ¡a punto de arruinarse!']);
    expect(v.current_player_id).toBe(F);
    addScore(m, F, 100);
    addScore(m, M, 100);
    addScore(m, A, 60);
    v = viewMatch(m);
    expect(m.status).toBe('finished');
    expect(m.winner_ids).toEqual([F, M]);
    expect(v.totals[A]).toBe(-10);
  });
});

describe('Fin por número de rondas', () => {
  it('termina al completar la última ronda', () => {
    const m = match({ end_type: 'rounds', target_score: null, rounds_count: 2 }, [A, F]);
    addRound(m, [{ player_id: A, value: 5 }, { player_id: F, value: 3 }]);
    expect(m.status).toBe('active');
    addRound(m, [{ player_id: A, value: 1 }, { player_id: F, value: 9 }]);
    expect(m.status).toBe('finished');
    expect(m.winner_ids).toEqual([F]);
  });
});

describe('Gráfico de evolución', () => {
  it('incluye la ronda 0 y los acumulados', () => {
    const m = match({}, [A, F]);
    addRound(m, [{ player_id: A, value: 5 }, { player_id: F, value: 3 }]);
    addRound(m, [{ player_id: A, value: 1 }, { player_id: F, value: 9 }]);
    expect(viewMatch(m).chart).toEqual([
      { round: 0, totals: { [A]: 0, [F]: 0 } },
      { round: 1, totals: { [A]: 5, [F]: 3 } },
      { round: 2, totals: { [A]: 6, [F]: 12 } },
    ]);
  });
});

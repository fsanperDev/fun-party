/**
 * Motor de puntuación de Fun Party.
 *
 * Reproduce el comportamiento observado en la aplicación original:
 * - Totales: modo "points" suma; modo "countdown" (presupuesto) resta del saldo inicial.
 * - Ranking con empates compartidos (1, 1, 3).
 * - Turnos: en modo "round" le toca al primer jugador sin anotación en la ronda abierta;
 *   en modo "free" el turno rota según el nº de anotaciones + turn_offset (Saltar lo incrementa).
 * - Fin automático: objetivo (al completar ronda en modo round), nº de rondas, o saldo a 0.
 * - Avisos al acercarse al fin, con los textos exactos de la app original.
 */
import { uuid as randomUUID } from '../core/uuid.js';
import type {
  ChartPoint,
  Entry,
  MatchDoc,
  MatchView,
  RankingRow,
  Round,
} from './types.js';

export class EngineError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const sign = (v: number) => (v === 0 ? 0 : v);

/** Total de un jugador a partir de una lista de rondas. */
export function playerTotal(match: MatchDoc, playerId: string, rounds: Round[] = match.rounds): number {
  let sum = 0;
  for (const r of rounds) for (const e of r.entries) if (e.player_id === playerId) sum += e.value;
  return match.settings.mode === 'countdown'
    ? match.settings.start_score - sum
    : match.settings.start_score + sum;
}

export function computeTotals(match: MatchDoc, rounds: Round[] = match.rounds): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const p of match.players) totals[p.id] = sign(playerTotal(match, p.id, rounds));
  return totals;
}

/** Ranking de competición: empates comparten puesto y el siguiente salta (1, 1, 3). */
export function computeRanking(match: MatchDoc, totals = computeTotals(match)): RankingRow[] {
  const high = match.settings.win_condition === 'high';
  const order = match.players.map((p, i) => ({ id: p.id, i, total: totals[p.id] }));
  order.sort((a, b) => (high ? b.total - a.total : a.total - b.total) || a.i - b.i);
  const rows: RankingRow[] = [];
  order.forEach((o, idx) => {
    const prev = rows[idx - 1];
    const position = prev && prev.total === o.total ? prev.position : idx + 1;
    rows.push({ player_id: o.id, total: o.total, position });
  });
  return rows;
}

function roundIsComplete(match: MatchDoc, round: Round): boolean {
  if (match.settings.entry_mode === 'free') return round.entries.length > 0;
  return match.players.every((p) => round.entries.some((e) => e.player_id === p.id));
}

export function completedRounds(match: MatchDoc): number {
  return match.rounds.filter((r) => roundIsComplete(match, r)).length;
}

/** Ronda abierta (incompleta) en modo round, si existe. */
export function openRound(match: MatchDoc): Round | null {
  if (match.settings.entry_mode !== 'round') return null;
  const last = match.rounds[match.rounds.length - 1];
  return last && !roundIsComplete(match, last) ? last : null;
}

function rotatedPlayers(match: MatchDoc) {
  const n = match.players.length;
  if (!n) return [];
  const off = ((match.turn_offset % n) + n) % n;
  return [...match.players.slice(off), ...match.players.slice(0, off)];
}

export function currentPlayerId(match: MatchDoc): string | null {
  const n = match.players.length;
  if (!n) return null;
  if (match.settings.entry_mode === 'free') {
    const idx = (((match.rounds.length + match.turn_offset) % n) + n) % n;
    return match.players[idx].id;
  }
  const open = openRound(match);
  const order = rotatedPlayers(match);
  if (!open) return order[0].id;
  const next = order.find((p) => !open.entries.some((e) => e.player_id === p.id));
  return (next ?? order[0]).id;
}

export function currentRoundNumber(match: MatchDoc): number {
  if (match.settings.entry_mode === 'round' && openRound(match)) return match.rounds.length;
  return match.rounds.length + 1;
}

/** ¿Se cumple la condición de fin de partida? */
export function endConditionMet(match: MatchDoc): boolean {
  const s = match.settings;
  const totals = computeTotals(match);
  const values = Object.values(totals);
  if (!values.length || !match.rounds.length) return false;
  switch (s.end_type) {
    case 'target': {
      if (s.target_score == null) return false;
      // En modo "todos puntúan cada ronda" el fin se comprueba al cerrar la ronda.
      if (s.entry_mode === 'round' && openRound(match)) return false;
      return values.some((v) => v >= (s.target_score as number));
    }
    case 'rounds':
      return s.rounds_count != null && completedRounds(match) >= s.rounds_count;
    case 'zero':
      if (s.entry_mode === 'round' && openRound(match)) return false;
      return values.some((v) => v <= 0);
    case 'manual':
    default:
      return false;
  }
}

function winnersOf(match: MatchDoc): string[] {
  return computeRanking(match)
    .filter((r) => r.position === 1)
    .map((r) => r.player_id);
}

/** Recalcula el estado (terminada/activa) tras cualquier cambio de puntuaciones. */
export function settleStatus(match: MatchDoc, now = new Date()): MatchDoc {
  if (match.manually_finished) {
    match.status = 'finished';
    match.winner_ids = winnersOf(match);
    return match;
  }
  if (endConditionMet(match)) {
    if (match.status !== 'finished') match.finished_at = now.toISOString();
    match.status = 'finished';
    match.winner_ids = winnersOf(match);
  } else {
    match.status = 'active';
    match.winner_ids = [];
    match.finished_at = null;
  }
  return match;
}

/** Avisos al acercarse al final (textos tal cual en la app original). */
export function computeAlerts(match: MatchDoc, totals = computeTotals(match)): string[] {
  const s = match.settings;
  if (match.status !== 'active' || !s.alert_margin || s.alert_margin <= 0) return [];
  const alerts: string[] = [];
  for (const p of match.players) {
    const t = totals[p.id];
    if (s.end_type === 'target' && s.target_score != null) {
      const left = s.target_score - t;
      if (left > 0 && left <= s.alert_margin) {
        alerts.push(
          s.win_condition === 'high'
            ? `🔥 ${p.name} está a ${left} ${s.entry_label} de ganar la partida`
            : `⚠️ ${p.name} está a ${left} ${s.entry_label} de llegar a ${s.target_score} y cerrar la partida`,
        );
      }
    } else if (s.end_type === 'zero') {
      if (t > 0 && t <= s.alert_margin) {
        alerts.push(`💸 ${p.name} solo tiene ${t} ${s.entry_label}: ¡a punto de arruinarse!`);
      }
    }
  }
  return alerts;
}

export function computeChart(match: MatchDoc): ChartPoint[] {
  const points: ChartPoint[] = [{ round: 0, totals: computeTotals(match, []) }];
  match.rounds.forEach((_, i) => {
    points.push({ round: i + 1, totals: computeTotals(match, match.rounds.slice(0, i + 1)) });
  });
  return points;
}

/** Vista completa con todos los campos derivados que consume el frontend. */
export function viewMatch(match: MatchDoc): MatchView {
  const totals = computeTotals(match);
  const open = openRound(match);
  return {
    ...match,
    totals,
    ranking: computeRanking(match, totals),
    current_round: currentRoundNumber(match),
    current_player_id: currentPlayerId(match),
    round_complete: !open,
    alerts: computeAlerts(match, totals),
    chart: computeChart(match),
  };
}

// ---------------------------------------------------------------------------
// Mutaciones
// ---------------------------------------------------------------------------

function assertActive(match: MatchDoc) {
  if (match.status !== 'active') throw new EngineError('La partida ya ha terminado. Reábrela para seguir anotando.');
}

function assertPlayer(match: MatchDoc, playerId: string) {
  if (!match.players.some((p) => p.id === playerId)) throw new EngineError('Ese jugador no está en la partida.');
}

function assertNumber(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new EngineError('Puntuación no válida.');
  return Math.round(n * 100) / 100;
}

/**
 * Anota una puntuación a un jugador.
 * - Modo free: cada anotación es una ronda nueva con una sola entrada.
 * - Modo round: se añade a la ronda abierta; si el jugador ya había anotado en ella,
 *   el valor se acumula sobre su entrada (decisión documentada en el README).
 */
export function addScore(match: MatchDoc, playerId: string, value: unknown): MatchDoc {
  assertActive(match);
  assertPlayer(match, playerId);
  const v = assertNumber(value);
  if (match.settings.entry_mode === 'free') {
    match.rounds.push({ id: randomUUID(), entries: [{ player_id: playerId, value: v }] });
  } else {
    const open = openRound(match);
    if (open) {
      const existing = open.entries.find((e) => e.player_id === playerId);
      if (existing) existing.value = assertNumber(existing.value + v);
      else open.entries.push({ player_id: playerId, value: v });
    } else {
      match.rounds.push({ id: randomUUID(), entries: [{ player_id: playerId, value: v }] });
    }
  }
  return settleStatus(match);
}

/** Saltar turno: en modo round anota 0 al jugador actual; en modo free pasa el turno. */
export function skipTurn(match: MatchDoc): MatchDoc {
  assertActive(match);
  if (match.settings.entry_mode === 'free') {
    match.turn_offset += 1;
    return match;
  }
  const pid = currentPlayerId(match);
  if (!pid) throw new EngineError('No hay jugadores.');
  return addScore(match, pid, 0);
}

/** Deshacer: borra la última anotación registrada. */
export function undoLast(match: MatchDoc): MatchDoc {
  assertActive(match);
  const last = match.rounds[match.rounds.length - 1];
  if (!last) throw new EngineError('No hay nada que deshacer.');
  last.entries.pop();
  if (!last.entries.length) match.rounds.pop();
  return settleStatus(match);
}

function cleanEntries(match: MatchDoc, entries: unknown): Entry[] {
  if (!Array.isArray(entries)) throw new EngineError('Formato de ronda no válido.');
  const seen = new Set<string>();
  const out: Entry[] = [];
  for (const raw of entries as Array<Record<string, unknown>>) {
    const pid = String(raw?.player_id ?? '');
    if (raw?.value === null || raw?.value === undefined || raw?.value === '') continue;
    assertPlayer(match, pid);
    if (seen.has(pid)) continue;
    seen.add(pid);
    out.push({ player_id: pid, value: assertNumber(raw.value) });
  }
  // Mantener el orden de los jugadores de la partida.
  out.sort(
    (a, b) =>
      match.players.findIndex((p) => p.id === a.player_id) -
      match.players.findIndex((p) => p.id === b.player_id),
  );
  return out;
}

/** "Ronda completa": anota a todos a la vez. Si hay una ronda abierta la completa. */
export function addRound(match: MatchDoc, entries: unknown): MatchDoc {
  assertActive(match);
  const clean = cleanEntries(match, entries);
  if (!clean.length) throw new EngineError('Introduce al menos una puntuación.');
  const open = openRound(match);
  if (open) open.entries = clean;
  else match.rounds.push({ id: randomUUID(), entries: clean });
  return settleStatus(match);
}

/** Corregir una ronda existente (también en partidas terminadas). Vacía = se elimina. */
export function editRound(match: MatchDoc, roundId: string, entries: unknown): MatchDoc {
  const idx = match.rounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new EngineError('Ronda no encontrada.', 404);
  const clean = cleanEntries(match, entries);
  if (!clean.length) match.rounds.splice(idx, 1);
  else match.rounds[idx].entries = clean;
  return settleStatus(match);
}

export function deleteRound(match: MatchDoc, roundId: string): MatchDoc {
  const idx = match.rounds.findIndex((r) => r.id === roundId);
  if (idx < 0) throw new EngineError('Ronda no encontrada.', 404);
  match.rounds.splice(idx, 1);
  return settleStatus(match);
}

/** Terminar partida ahora (gana quien vaya primero en ese momento). */
export function finishNow(match: MatchDoc, now = new Date()): MatchDoc {
  if (match.status === 'finished') return match;
  match.manually_finished = true;
  match.finished_at = now.toISOString();
  return settleStatus(match, now);
}

/** Reabrir: solo si la condición de fin ya no se cumple (o se terminó a mano). */
export function reopen(match: MatchDoc): MatchDoc {
  if (match.status !== 'finished') return match;
  if (endConditionMet(match)) {
    throw new EngineError(
      'La partida ya ha alcanzado su condición de fin. Edita las puntuaciones para continuar.',
    );
  }
  match.manually_finished = false;
  return settleStatus(match);
}

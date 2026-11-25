/** Lógica pura de fichas de juego (compartida por el servidor y el modo local del navegador). */
import type { GameDoc } from '../engine/types.js';
import { int, str, strList } from './validate.js';

const MODES = ['points', 'countdown'] as const;
const WINS = ['high', 'low'] as const;
const ENDS = ['target', 'rounds', 'manual', 'zero'] as const;
const ENTRIES = ['round', 'free'] as const;

const pickEnum = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;

function numMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (v && typeof v === 'object') {
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      const n = int(val);
      if (n !== null && /^\d+$/.test(k)) out[k] = n;
    }
  }
  return out;
}

/** Aplica sobre `base` los campos editables recibidos (whitelist + validación). */
export function applyGameFields(base: GameDoc, body: Record<string, unknown>): GameDoc {
  const g: GameDoc = { ...base };
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k);
  if (has('name')) g.name = str(body.name, 80) || g.name;
  if (has('emoji')) g.emoji = str(body.emoji, 16) || g.emoji;
  if (has('color')) g.color = str(body.color, 9) || g.color;
  for (const k of ['category', 'description', 'manufacturer', 'objective', 'rules_url'] as const)
    if (has(k)) g[k] = str(body[k], 2000);
  if (has('entry_label')) g.entry_label = str(body.entry_label, 24) || 'puntos';
  for (const k of ['rules', 'setup', 'scoring_notes', 'aliases'] as const) if (has(k)) g[k] = strList(body[k]);
  if (has('mode')) g.mode = pickEnum(body.mode, MODES, g.mode);
  if (has('win_condition')) g.win_condition = pickEnum(body.win_condition, WINS, g.win_condition);
  if (has('end_type')) g.end_type = pickEnum(body.end_type, ENDS, g.end_type);
  if (has('entry_mode')) g.entry_mode = pickEnum(body.entry_mode, ENTRIES, g.entry_mode);
  if (has('target_score')) g.target_score = int(body.target_score);
  if (has('rounds_count')) g.rounds_count = int(body.rounds_count);
  if (has('start_score_default')) g.start_score_default = int(body.start_score_default, 0) ?? 0;
  if (has('default_entry')) g.default_entry = int(body.default_entry);
  if (has('alert_margin')) g.alert_margin = int(body.alert_margin, 0) ?? 0;
  if (has('min_players')) g.min_players = Math.max(1, int(body.min_players, 2) ?? 2);
  if (has('max_players')) g.max_players = Math.max(g.min_players, int(body.max_players, 8) ?? 8);
  if (has('target_by_players')) g.target_by_players = numMap(body.target_by_players);
  if (has('start_scores')) g.start_scores = numMap(body.start_scores);
  if (has('teams')) g.teams = Boolean(body.teams);
  if (has('hidden')) g.hidden = Boolean(body.hidden);
  if (has('images')) g.images = strList(body.images, 60);
  if (has('image_url')) g.image_url = str(body.image_url, 3_000_000) || null;
  if (has('bgg_id')) g.bgg_id = int(body.bgg_id);
  // El presupuesto siempre termina al llegar a 0.
  if (g.mode === 'countdown') g.end_type = 'zero';
  else if (g.end_type === 'zero') g.end_type = 'target';
  return g;
}

export function blankGame(id: string, sortOrder: number): GameDoc {
  return {
    id,
    name: '',
    emoji: '🎴',
    color: '#8B5CF6',
    category: '',
    description: '',
    rules: [],
    mode: 'points',
    win_condition: 'high',
    end_type: 'target',
    target_score: 100,
    target_by_players: {},
    rounds_count: null,
    start_scores: {},
    start_score_default: 0,
    entry_mode: 'round',
    entry_label: 'puntos',
    default_entry: null,
    alert_margin: 10,
    min_players: 2,
    max_players: 8,
    aliases: [],
    manufacturer: '',
    objective: '',
    setup: [],
    scoring_notes: [],
    rules_url: '',
    image_url: null,
    images: [],
    bgg_id: null,
    teams: false,
    is_custom: true,
    sort_order: sortOrder,
    hidden: false,
    ai_status: null,
    ai_error: null,
  };
}

export const sortGames = (games: GameDoc[]) => [...games].sort((a, b) => a.sort_order - b.sort_order);

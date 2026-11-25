/** Tipos de dominio compartidos por el motor de puntuación y la API. */

export type ScoreMode = 'points' | 'countdown';
export type WinCondition = 'high' | 'low';
export type EndType = 'target' | 'rounds' | 'manual' | 'zero';
export type EntryMode = 'round' | 'free';

export interface MatchSettings {
  mode: ScoreMode;
  win_condition: WinCondition;
  end_type: EndType;
  target_score: number | null;
  rounds_count: number | null;
  start_score: number;
  entry_mode: EntryMode;
  entry_label: string;
  default_entry: number | null;
  alert_margin: number;
}

export interface MatchPlayer {
  id: string;
  name: string;
  avatar: string;
  color: string;
  member_ids: string[];
  member_names: string[];
}

export interface Entry {
  player_id: string;
  value: number;
}

export interface Round {
  id: string;
  entries: Entry[];
}

export type MatchStatus = 'active' | 'finished';

/** Documento persistido de una partida. */
export interface MatchDoc {
  id: string;
  game_id: string;
  game_name: string;
  game_emoji: string;
  game_color: string;
  settings: MatchSettings;
  players: MatchPlayer[];
  rounds: Round[];
  turn_offset: number;
  status: MatchStatus;
  manually_finished: boolean;
  winner_ids: string[];
  created_at: string;
  finished_at: string | null;
}

export interface RankingRow {
  player_id: string;
  total: number;
  position: number;
}

export interface ChartPoint {
  round: number;
  totals: Record<string, number>;
}

/** Partida con los campos derivados que calcula el servidor. */
export interface MatchView extends MatchDoc {
  totals: Record<string, number>;
  ranking: RankingRow[];
  current_round: number;
  current_player_id: string | null;
  round_complete: boolean;
  alerts: string[];
  chart: ChartPoint[];
}

export interface GameDoc {
  id: string;
  name: string;
  emoji: string;
  color: string;
  category: string;
  description: string;
  rules: string[];
  mode: ScoreMode;
  win_condition: WinCondition;
  end_type: EndType;
  target_score: number | null;
  target_by_players: Record<string, number>;
  rounds_count: number | null;
  start_scores: Record<string, number>;
  start_score_default: number;
  entry_mode: EntryMode;
  entry_label: string;
  default_entry: number | null;
  alert_margin: number;
  min_players: number;
  max_players: number;
  aliases: string[];
  manufacturer: string;
  objective: string;
  setup: string[];
  scoring_notes: string[];
  rules_url: string;
  image_url: string | null;
  images: string[];
  bgg_id: number | null;
  teams: boolean;
  is_custom: boolean;
  sort_order: number;
  hidden: boolean;
  ai_status: 'pending' | 'ready' | 'error' | null;
  ai_error: string | null;
}

export interface PlayerDoc {
  id: string;
  name: string;
  avatar: string;
  color: string;
  favorite: boolean;
  favorite_order: number | null;
  created_at: string;
}

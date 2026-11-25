export type ScoreMode = 'points' | 'countdown';
export type WinCondition = 'high' | 'low';
export type EndType = 'target' | 'rounds' | 'manual' | 'zero';
export type EntryMode = 'round' | 'free';

export interface Game {
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

export interface Player {
  id: string;
  name: string;
  avatar: string;
  color: string;
  favorite: boolean;
  favorite_order: number | null;
  created_at: string;
}

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

export interface Round {
  id: string;
  entries: { player_id: string; value: number }[];
}

export interface Match {
  id: string;
  game_id: string;
  game_name: string;
  game_emoji: string;
  game_color: string;
  settings: MatchSettings;
  players: MatchPlayer[];
  rounds: Round[];
  turn_offset: number;
  status: 'active' | 'finished';
  manually_finished: boolean;
  winner_ids: string[];
  created_at: string;
  finished_at: string | null;
  totals: Record<string, number>;
  ranking: { player_id: string; total: number; position: number }[];
  current_round: number;
  current_player_id: string | null;
  round_complete: boolean;
  alerts: string[];
  chart: { round: number; totals: Record<string, number> }[];
}

export interface Stats {
  reset_at: string | null;
  can_undo_reset: boolean;
  total_matches: number;
  finished_matches: number;
  active_matches: number;
  players: {
    player_id: string;
    name: string;
    avatar: string;
    color: string;
    played: number;
    wins: number;
    win_rate: number;
    by_game: { game_id: string; game_name: string; game_emoji: string; played: number; wins: number; best: number | null }[];
  }[];
  games: {
    game_id: string;
    game_name: string;
    game_emoji: string;
    game_color: string;
    played: number;
    top_player_id: string | null;
    top_player_wins: number;
  }[];
  recent: {
    id: string;
    game_name: string;
    game_emoji: string;
    game_color: string;
    finished_at: string | null;
    winner_names: string[];
    rounds: number;
  }[];
}

export interface NewMatchInput {
  game_id: string;
  players: { id: string; color?: string }[];
  teams?: string[][];
  settings?: Partial<Pick<MatchSettings, 'win_condition' | 'end_type' | 'target_score' | 'rounds_count' | 'start_score' | 'alert_margin'>>;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Match } from '../lib/types';

export const keys = {
  games: ['games'] as const,
  game: (id: string) => ['games', id] as const,
  players: ['players'] as const,
  matches: ['matches'] as const,
  match: (id: string) => ['matches', id] as const,
  stats: ['stats'] as const,
};

export const useGames = () => useQuery({ queryKey: keys.games, queryFn: api.games.list });
export const useGame = (id: string) =>
  useQuery({
    queryKey: keys.game(id),
    queryFn: () => api.games.get(id),
    // Mientras la IA prepara la ficha, se refresca cada pocos segundos.
    refetchInterval: (q) => (q.state.data?.ai_status === 'pending' ? 2500 : false),
  });
export const usePlayers = () => useQuery({ queryKey: keys.players, queryFn: api.players.list });
export const useMatches = () => useQuery({ queryKey: keys.matches, queryFn: api.matches.list });
export const useMatch = (id: string) => useQuery({ queryKey: keys.match(id), queryFn: () => api.matches.get(id) });
export const useStats = () => useQuery({ queryKey: keys.stats, queryFn: api.stats.get });

/** Tras mutar una partida se actualiza su caché y se invalidan las listas. */
export function useMatchMutation<V>(fn: (v: V) => Promise<Match>, opts?: { onSuccess?: (m: Match, v: V) => void }) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (m, v) => {
      qc.setQueryData(keys.match(m.id), m);
      qc.invalidateQueries({ queryKey: keys.matches, exact: true });
      qc.invalidateQueries({ queryKey: keys.stats });
      opts?.onSuccess?.(m, v);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...ks: (readonly unknown[])[]) => Promise.all(ks.map((k) => qc.invalidateQueries({ queryKey: k })));
}

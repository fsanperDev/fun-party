import { ChevronRight, Library, Mic, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GameIcon } from '../components/GameIcon';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { useGames, useMatches } from '../hooks/queries';
import { joinNames } from '../lib/utils';

export default function Home() {
  const { data: matches = [], isSuccess } = useMatches();
  const { data: games = [] } = useGames();
  const active = matches.filter((m) => m.status === 'active');

  return (
    <div>
      <header className="mt-2 mb-5">
        <p className="eyebrow">Marcador de cartas</p>
        <h1 className="mt-1 text-5xl font-extrabold tracking-[-0.025em] text-zinc-50">
          Fun Party<span className="text-violet-500">.</span>
        </h1>
        <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-400">
          Junta a la peña y deja que la app lleve las cuentas. Puedes hablarle con el micro.
        </p>
      </header>

      <div className="flex gap-2">
        <Link
          to="/nueva"
          className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[18px] bg-violet-600 font-bold text-white transition-colors hover:bg-violet-500"
        >
          <Plus className="size-5" /> Nueva partida
        </Link>
        <Link
          to="/juegos"
          className="flex h-14 items-center justify-center gap-2 rounded-[18px] border border-line-strong bg-surface-3/30 px-5 font-medium text-zinc-100 hover:bg-surface-3"
        >
          <Library className="size-4" /> Juegos
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-bold">Partidas en curso</h2>
          <span className="font-mono text-sm text-zinc-500">{active.length}</span>
        </div>
        {!isSuccess ? (
          <div className="h-24 animate-pulse rounded-[18px] bg-surface/60" />
        ) : active.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-line-strong/70 px-4 py-5 text-sm text-zinc-500">
            No hay partidas en curso. Crea una o pulsa el micro y di «Crea una partida de Skyjo con los jugadores habituales».
          </div>
        ) : (
          <ul className="space-y-2.5">
            {active.map((m) => {
              const game = games.find((g) => g.id === m.game_id);
              const turn = m.players.find((p) => p.id === m.current_player_id);
              const leaders = m.ranking.filter((r) => r.position === 1).map((r) => m.players.find((p) => p.id === r.player_id)?.name ?? '');
              return (
                <li key={m.id}>
                  <Link
                    to={`/partida/${m.id}`}
                    className="card flex items-center gap-3 border-l-4 p-3.5 transition-colors hover:bg-surface-2"
                    style={{ borderLeftColor: m.game_color }}
                  >
                    <GameIcon game={game} alt="" emoji={m.game_emoji} color={m.game_color} className="size-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold">{m.game_name}</p>
                      <p className="truncate text-[13px] text-zinc-400">
                        Ronda {m.current_round} · Turno de {turn?.name ?? '—'} · Lidera {joinNames(leaders)}
                      </p>
                      <div className="mt-1.5 flex -space-x-1.5">
                        {m.players.map((p) => (
                          <PlayerAvatar key={p.id} avatar={p.avatar} color={p.color} size="sm" />
                        ))}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-zinc-500" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <Link
        to="/ajustes?tab=voz"
        className="mt-6 flex items-center gap-3 rounded-[18px] border border-violet-500/30 bg-violet-500/10 px-4 py-4 text-sm text-violet-100 hover:bg-violet-500/15"
      >
        <Mic className="size-4 text-violet-300" />
        <span className="flex-1">¿Qué le puedo decir al micro? Mira todos los comandos de voz.</span>
        <ChevronRight className="size-4" />
      </Link>
    </div>
  );
}

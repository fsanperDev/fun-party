import { Crown, Gamepad2, Medal, RotateCcw, Trophy, Undo2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import { PageHeader } from '../components/AppShell';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { useConfirm } from '../components/ui/Confirm';
import { keys, useInvalidate, useStats } from '../hooks/queries';
import { api } from '../lib/api';
import { alpha, cn, joinNames, shortDate } from '../lib/utils';

export default function Dashboard() {
  const { data: stats } = useStats();
  const [gameFilter, setGameFilter] = useState<string>('all');
  const invalidate = useInvalidate();
  const confirm = useConfirm();

  const players = useMemo(() => (stats?.players ?? []).filter((p) => p.played > 0), [stats]);
  const podium = players.slice(0, 3);
  const chartData = useMemo(
    () =>
      players
        .map((p) => ({
          name: p.name,
          color: p.color,
          wins: gameFilter === 'all' ? p.wins : p.by_game.find((g) => g.game_id === gameFilter)?.wins ?? 0,
        }))
        .sort((a, b) => b.wins - a.wins),
    [players, gameFilter],
  );

  if (!stats) return null;

  async function reset() {
    const ok = await confirm({
      title: '¿Reiniciar estadísticas?',
      description: 'Las partidas no se borran: el Dashboard empezará a contar desde ahora. Podrás deshacerlo.',
      confirmLabel: 'Reiniciar',
    });
    if (!ok) return;
    await api.stats.reset();
    await invalidate(keys.stats);
    toast.success('Estadísticas reiniciadas');
  }
  async function undoReset() {
    await api.stats.undoReset();
    await invalidate(keys.stats);
    toast('Reinicio deshecho');
  }

  const gamesPlayed = stats.games.length;
  // Podio con el primero en el centro (2º · 1º · 3º).
  const podiumOrder = podium.length === 3 ? [podium[1], podium[0], podium[2]] : podium;

  return (
    <div>
      <PageHeader
        eyebrow="Estadísticas"
        title="Dashboard"
        action={
          <button onClick={reset} className="mt-1 inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-sm text-rose-300">
            <RotateCcw className="size-4" /> Reiniciar
          </button>
        }
      />

      {stats.reset_at && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-zinc-300">
          <span>Contando desde el {shortDate(stats.reset_at)}</span>
          {stats.can_undo_reset && (
            <button onClick={undoReset} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300">
              <Undo2 className="size-3.5" /> Deshacer
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            [Gamepad2, stats.finished_matches, 'Jugadas'],
            [Medal, stats.active_matches, 'En curso'],
            [Trophy, gamesPlayed, 'Juegos'],
          ] as const
        ).map(([Icon, n, l]) => (
          <div key={l} className="card p-3">
            <Icon className="size-4 text-violet-400" />
            <p className="mt-1 font-mono text-3xl font-bold">{n}</p>
            <p className="text-xs text-zinc-500">{l}</p>
          </div>
        ))}
      </div>

      {players.length === 0 ? (
        <div className="mt-8 rounded-[18px] border border-dashed border-line-strong p-6 text-center text-sm text-zinc-500">
          Aún no hay partidas terminadas. <Link to="/nueva" className="text-violet-300">Empieza una</Link> y aquí verás el podio.
        </div>
      ) : (
        <>
          <h2 className="mt-8 mb-3 text-lg font-bold">Podio de victorias</h2>
          <div className="grid grid-cols-3 items-end gap-2">
            {podiumOrder.map((p) => {
              const first = p === podium[0];
              return (
                <div
                  key={p.player_id}
                  className={cn('card flex flex-col items-center px-2 text-center', first ? 'border-amber-500/40 bg-violet-950/60 pt-3 pb-4' : 'py-4')}
                >
                  {first && <Crown className="mb-1 size-5 text-amber-400" />}
                  <PlayerAvatar avatar={p.avatar} color={p.color} size={first ? 'lg' : 'md'} />
                  <p className="mt-2 w-full truncate text-sm font-bold">{p.name}</p>
                  <p className="font-mono text-2xl font-bold" style={{ color: p.color }}>
                    {p.wins}
                  </p>
                  <p className="text-[10px] tracking-wider text-zinc-500 uppercase">Victorias</p>
                </div>
              );
            })}
          </div>

          <h2 className="mt-8 mb-3 text-lg font-bold">Victorias</h2>
          <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
            <button
              onClick={() => setGameFilter('all')}
              className={cn('h-8 shrink-0 rounded-full border px-3 text-sm', gameFilter === 'all' ? 'border-violet-500/60 bg-violet-500/15' : 'border-line')}
            >
              🎲 Todos
            </button>
            {stats.games.map((g) => (
              <button
                key={g.game_id}
                onClick={() => setGameFilter(g.game_id)}
                className={cn('h-8 shrink-0 rounded-full border px-3 text-sm', gameFilter === g.game_id ? 'border-violet-500/60 bg-violet-500/15' : 'border-line')}
              >
                {g.game_emoji} {g.game_name}
              </button>
            ))}
          </div>
          <div className="card h-56 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
                <CartesianGrid stroke="#1e2235" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#71717a" fontSize={11} tickLine={false} />
                <YAxis allowDecimals={false} stroke="#71717a" fontSize={11} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  contentStyle={{ background: '#11131d', border: '1px solid #2e3650', borderRadius: 12, fontSize: 12 }}
                  formatter={(v) => [v, 'Victorias']}
                />
                <Bar dataKey="wins" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                  {chartData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <h2 className="mt-8 mb-3 text-lg font-bold">Jugadores</h2>
          <ul className="space-y-2">
            {players.map((p) => (
              <li key={p.player_id} className="card flex items-center gap-3 px-3 py-2.5">
                <PlayerAvatar avatar={p.avatar} color={p.color} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{p.name}</p>
                  <p className="text-xs text-zinc-500">
                    {p.played} partidas · {p.win_rate}% victorias
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-xl font-bold" style={{ color: p.color }}>
                    {p.wins}
                  </p>
                  <p className="text-[10px] tracking-wider text-zinc-500 uppercase">Wins</p>
                </div>
              </li>
            ))}
          </ul>

          <h2 className="mt-8 mb-3 text-lg font-bold">Por juego</h2>
          <div className="grid grid-cols-2 gap-2">
            {stats.games.map((g) => {
              const top = stats.players.find((p) => p.player_id === g.top_player_id);
              return (
                <div key={g.game_id} className="card border-t-2 p-3" style={{ borderTopColor: g.game_color }}>
                  <p className="font-bold">
                    {g.game_emoji} {g.game_name}
                  </p>
                  <p className="text-xs text-zinc-500">{g.played} partidas</p>
                  {top && (
                    <p className="mt-2 text-sm">
                      👑 {top.name} <span className="text-zinc-500">({g.top_player_wins})</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {stats.recent.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-lg font-bold">Últimas partidas</h2>
          <ul className="space-y-2">
            {stats.recent.map((r) => (
              <li key={r.id}>
                <Link to={`/partida/${r.id}`} className="card flex items-center gap-3 px-3 py-2.5 hover:bg-surface-2">
                  <span className="flex size-8 items-center justify-center rounded-lg text-lg" style={{ background: alpha(r.game_color, 0.2) }}>
                    {r.game_emoji}
                  </span>
                  <span className="flex-1 text-sm">
                    <b>{r.game_name}</b> <span className="text-zinc-500">· {r.rounds} rondas</span>
                  </span>
                  <span className="text-sm text-amber-300">🏆 {joinNames(r.winner_names)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

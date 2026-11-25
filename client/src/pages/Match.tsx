import { AlertTriangle, ArrowLeft, BookOpen, Flag, ListOrdered, Loader2, MoreHorizontal, Pencil, RotateCcw, Trash2, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { GameIcon } from '../components/GameIcon';
import { PlayerAvatar } from '../components/PlayerAvatar';
import { RoundDialog } from '../components/RoundDialog';
import { ScoreChart } from '../components/ScoreChart';
import { ScoreKeypad } from '../components/ScoreKeypad';
import { WinnerOverlay } from '../components/WinnerOverlay';
import { useConfirm } from '../components/ui/Confirm';
import { Sheet } from '../components/ui/Dialog';
import { Tabs } from '../components/ui/Segmented';
import { keys, useGames, useInvalidate, useMatch, useMatchMutation } from '../hooks/queries';
import { api } from '../lib/api';
import { VOICE_EVENT } from '../lib/speech';
import type { Match, Round } from '../lib/types';
import { alpha, cn, fmt, joinNames, matchRule } from '../lib/utils';
import { GameRules } from './GameDetail';

function summaryLine(m: Match, total: number): string {
  const s = m.settings;
  if (s.end_type === 'target' && s.target_score != null) {
    return total >= s.target_score ? 'Límite alcanzado' : `Faltan ${fmt(s.target_score - total)} ${s.entry_label}`;
  }
  if (s.end_type === 'zero') return total <= 0 ? 'Sin saldo' : `Le quedan ${fmt(total)} ${s.entry_label}`;
  if (s.end_type === 'rounds') return `${m.rounds.length} de ${s.rounds_count} rondas`;
  return '';
}

export default function MatchPage() {
  const { id = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const invalidate = useInvalidate();
  const { data: match, isLoading, error } = useMatch(id);
  const { data: games = [] } = useGames();

  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'table' | 'chart'>('table');
  const [panel, setPanel] = useState<'summary' | 'rules' | 'options' | null>(null);
  const [roundEdit, setRoundEdit] = useState<{ round: Round | null; number: number; edit: boolean } | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const prevStatus = useRef<string | null>(null);

  const after = (m: Match) => {
    setSelected(null);
    if (m.status === 'finished' && prevStatus.current === 'active') setCelebrate(true);
  };
  const score = useMatchMutation((v: { pid: string; value: number }) => api.matches.score(id, v.pid, v.value), {
    onSuccess: (m, v) => {
      const p = m.players.find((x) => x.id === v.pid);
      if (p)
        toast.success(
          m.settings.mode === 'countdown' ? `${p.name} paga ${fmt(v.value)} ${m.settings.entry_label}` : `${p.name}: ${v.value > 0 ? '+' : ''}${fmt(v.value)} ${m.settings.entry_label}`,
          { description: `Total: ${fmt(m.totals[p.id])}` },
        );
      after(m);
    },
  });
  const skip = useMatchMutation(() => api.matches.skip(id), { onSuccess: after });
  const undo = useMatchMutation(() => api.matches.undo(id), { onSuccess: (m) => (toast('Deshecho'), after(m)) });
  const saveRound = useMatchMutation(
    (v: { rid: string | null; entries: { player_id: string; value: number | null }[] }) =>
      v.rid ? api.matches.editRound(id, v.rid, v.entries) : api.matches.addRound(id, v.entries),
    { onSuccess: (m, v) => (toast.success(v.rid ? 'Ronda corregida' : 'Ronda anotada'), setRoundEdit(null), after(m)) },
  );
  const removeRound = useMatchMutation((rid: string) => api.matches.deleteRound(id, rid), {
    onSuccess: (m) => (toast('Ronda eliminada'), setRoundEdit(null), after(m)),
  });
  const finish = useMatchMutation(() => api.matches.finish(id), { onSuccess: () => (setPanel(null), setCelebrate(true)) });
  const reopen = useMatchMutation(() => api.matches.reopen(id), { onSuccess: () => (setPanel(null), toast.success('Partida reabierta')) });

  // Estado previo para detectar el paso a "terminada".
  useEffect(() => {
    if (!match) return;
    if (prevStatus.current === null && match.status === 'finished') setCelebrate(true);
    prevStatus.current = match.status;
  }, [match]);

  // ?ver=resumen|normas (desde la voz) y eventos del micro.
  useEffect(() => {
    const v = params.get('ver');
    if (v === 'resumen') setPanel('summary');
    if (v === 'normas') setPanel('rules');
    if (v) setParams({}, { replace: true });
  }, [params, setParams]);
  useEffect(() => {
    const fn = (e: Event) => setPanel((e as CustomEvent<'summary' | 'rules'>).detail);
    window.addEventListener(VOICE_EVENT, fn);
    return () => window.removeEventListener(VOICE_EVENT, fn);
  }, []);

  if (isLoading)
    return (
      <div className="mt-20 flex justify-center text-zinc-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (error || !match) return <p className="mt-10 text-center text-zinc-400">Partida no encontrada.</p>;

  const m = match;
  const game = games.find((g) => g.id === m.game_id);
  const active = m.status === 'active';
  const turn = m.players.find((p) => p.id === m.current_player_id) ?? m.players[0];
  const target = m.players.find((p) => p.id === selected) ?? turn;
  const leaders = new Set(m.rounds.length ? m.ranking.filter((r) => r.position === 1).map((r) => r.player_id) : []);
  const winners = m.players.filter((p) => m.winner_ids.includes(p.id));
  const busy = score.isPending || skip.isPending || undo.isPending;
  const openRound = m.settings.entry_mode === 'round' && !m.round_complete ? m.rounds[m.rounds.length - 1] : null;

  async function rematch() {
    try {
      const r = await api.matches.rematch(m.id);
      await invalidate(keys.matches, keys.stats);
      setCelebrate(false);
      navigate(`/partida/${r.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove() {
    const ok = await confirm({ title: '¿Eliminar la partida?', description: 'Se borrarán todas sus puntuaciones. No se puede deshacer.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await api.matches.remove(m.id);
    await invalidate(keys.matches, keys.stats);
    toast('Partida eliminada');
    navigate('/');
  }

  return (
    <div className="-mx-4 -mt-4">
      <header className="px-4 pt-4 pb-4" style={{ background: `linear-gradient(180deg, ${alpha(m.game_color, 0.16)}, transparent)` }}>
        <div className="flex items-start gap-2">
          <button aria-label="Volver" onClick={() => navigate(-1)} className="mt-3 rounded-lg p-1.5 text-zinc-300 hover:bg-white/5">
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className={cn('text-[11px] font-bold tracking-[0.2em] uppercase')} style={{ color: active ? m.game_color : '#f59e0b' }}>
              {active ? `Ronda ${m.current_round}` : 'Partida terminada'}
            </p>
            <div className="flex items-center gap-2">
              <GameIcon game={game} emoji={m.game_emoji} color={m.game_color} className="size-8 rounded-lg" />
              <h1 className="truncate text-2xl font-extrabold">{m.game_name}</h1>
            </div>
            <p className="mt-1 text-xs text-zinc-400">{matchRule(m)}</p>
          </div>
          <div className="flex gap-1.5">
            {(
              [
                ['summary', 'Resumen', ListOrdered],
                ['rules', 'Normas', BookOpen],
                ['options', 'Más opciones', MoreHorizontal],
              ] as const
            ).map(([k, label, Icon]) => (
              <button key={k} aria-label={label} onClick={() => setPanel(k)} className="flex size-9 items-center justify-center rounded-xl border border-line-strong bg-surface/70 hover:bg-surface-2">
                <Icon className="size-4" />
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4">
        {m.alerts.map((a) => (
          <div key={a} className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <AlertTriangle className="size-4 shrink-0" /> {a}
          </div>
        ))}

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {m.players.map((p) => {
            const isTarget = active && p.id === target.id;
            const isTurn = active && p.id === turn.id;
            return (
              <button
                key={p.id}
                disabled={!active}
                onClick={() => setSelected(p.id === turn.id ? null : p.id)}
                aria-label={`${p.avatar} ${p.name} ${fmt(m.totals[p.id])}`}
                className={cn('relative flex w-[66px] shrink-0 flex-col items-center rounded-2xl border bg-surface px-1 pt-2 pb-2', isTarget ? 'border-2' : 'border-line')}
                style={isTarget ? { borderColor: p.color, background: alpha(p.color, 0.1) } : undefined}
              >
                {leaders.has(p.id) && <Trophy className="absolute top-1 right-1 size-3 text-amber-400" />}
                <PlayerAvatar avatar={p.avatar} color={p.color} size="sm" />
                <span className="mt-1 w-full truncate text-center text-[11px] font-semibold">{p.name}</span>
                <span className="font-mono text-sm font-bold" style={{ color: p.color }}>
                  {fmt(m.totals[p.id])}
                </span>
                {isTurn && <span className="absolute -bottom-px h-1 w-6 rounded-full" style={{ background: p.color }} />}
              </button>
            );
          })}
        </div>

        {active ? (
          <ScoreKeypad
            match={m}
            target={target}
            isTurn={target.id === turn.id}
            turnName={turn.name}
            busy={busy}
            canUndo={m.rounds.length > 0}
            onSubmit={(value) => score.mutate({ pid: target.id, value })}
            onUndo={() => undo.mutate(undefined)}
            onSkip={() => skip.mutate(undefined)}
            onThird={() =>
              m.settings.entry_mode === 'round'
                ? setRoundEdit({ round: openRound, number: m.current_round, edit: false })
                : setPanel('summary')
            }
          />
        ) : (
          <div className="rounded-[18px] border border-violet-500/30 bg-violet-500/10 p-4 text-center">
            <Trophy className="mx-auto size-7 text-amber-400" />
            <p className="mt-1 text-lg font-bold">
              {winners.length > 1 ? `Empate: ${joinNames(winners.map((w) => w.name))}` : `Ganador: ${winners[0]?.name ?? '—'}`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setCelebrate(true)} className="h-11 rounded-xl border border-line-strong bg-surface-2 text-sm">
                Ver celebración
              </button>
              <button onClick={rematch} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white">
                <RotateCcw className="size-4" /> Revancha
              </button>
            </div>
          </div>
        )}

        <Tabs
          value={tab}
          onChange={setTab}
          options={[
            { value: 'table', label: 'Marcador' },
            { value: 'chart', label: 'Evolución' },
          ]}
        />
        {tab === 'chart' ? (
          <ScoreChart match={m} />
        ) : (
          <div>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-[11px]">
                    <th className="px-3 py-2 text-left font-semibold text-zinc-500">R</th>
                    {m.players.map((p) => (
                      <th key={p.id} className="px-1 py-2 text-center font-semibold whitespace-nowrap" style={{ color: p.color }}>
                        {p.avatar} {p.name}
                      </th>
                    ))}
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {m.rounds.length === 0 ? (
                    <tr>
                      <td colSpan={m.players.length + 2} className="py-5 text-center text-zinc-500">
                        Aún no hay puntuaciones
                      </td>
                    </tr>
                  ) : (
                    m.rounds.map((r, i) => (
                      <tr
                        key={r.id}
                        onClick={() => setRoundEdit({ round: r, number: i + 1, edit: true })}
                        className="cursor-pointer border-b border-line/60 hover:bg-surface-2"
                      >
                        <td className="px-3 py-2 font-mono text-xs text-zinc-500">{i + 1}</td>
                        {m.players.map((p) => {
                          const e = r.entries.find((x) => x.player_id === p.id);
                          return (
                            <td key={p.id} className={cn('py-2 text-center font-mono', !e && 'text-zinc-600')}>
                              {e ? fmt(e.value) : '—'}
                            </td>
                          );
                        })}
                        <td className="pr-3 text-right">
                          <Pencil className="ml-auto size-3.5 text-zinc-500" />
                        </td>
                      </tr>
                    ))
                  )}
                  <tr>
                    <td className="px-3 py-2.5 text-xs font-semibold text-zinc-400">Total</td>
                    {m.players.map((p) => (
                      <td key={p.id} className="py-2.5 text-center font-mono text-base font-bold" style={{ color: p.color }}>
                        {fmt(m.totals[p.id])}
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-zinc-500">Toca una ronda para corregir sus puntuaciones.</p>
          </div>
        )}
      </div>

      <Sheet open={panel === 'summary'} onClose={() => setPanel(null)} title={`Resumen · ${m.game_name}`} description={matchRule(m)}>
        <ol className="space-y-2">
          {m.ranking.map((r) => {
            const p = m.players.find((x) => x.id === r.player_id)!;
            return (
              <li key={r.player_id} className="flex items-center gap-3 rounded-xl bg-surface px-3 py-2.5">
                <span className={cn('w-7 font-mono text-sm font-bold', r.position === 1 ? 'text-amber-400' : 'text-zinc-500')}>{r.position}º</span>
                <PlayerAvatar avatar={p.avatar} color={p.color} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{p.name}</p>
                  <p className="text-xs text-zinc-500">{summaryLine(m, r.total)}</p>
                </div>
                <span className="font-mono text-xl font-bold" style={{ color: p.color }}>
                  {fmt(r.total)}
                </span>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-center text-xs text-zinc-500">{m.rounds.length} rondas jugadas</p>
      </Sheet>

      <Sheet open={panel === 'rules'} onClose={() => setPanel(null)} title={`Normas · ${m.game_name}`}>
        {game ? <GameRules game={game} /> : <p className="text-sm text-zinc-400">No hay normas guardadas para este juego.</p>}
      </Sheet>

      <Sheet open={panel === 'options'} onClose={() => setPanel(null)} title="Opciones de la partida">
        <div className="space-y-2">
          {active ? (
            <button onClick={() => (setPanel(null), finish.mutate(undefined))} className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm">
              <Flag className="size-4" /> Terminar partida ahora
            </button>
          ) : (
            <button onClick={() => (setPanel(null), reopen.mutate(undefined))} className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm">
              <RotateCcw className="size-4" /> Reabrir partida
            </button>
          )}
          <button onClick={() => navigate(`/nueva?desde=${m.id}`)} className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm">
            <RotateCcw className="size-4" /> Nueva partida con los mismos jugadores
          </button>
          <button onClick={remove} className="flex h-11 w-full items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm text-rose-300">
            <Trash2 className="size-4" /> Eliminar partida
          </button>
        </div>
      </Sheet>

      {roundEdit && (
        <RoundDialog
          open
          onClose={() => setRoundEdit(null)}
          match={m}
          round={roundEdit.round}
          roundNumber={roundEdit.number}
          onSave={(entries) => saveRound.mutate({ rid: roundEdit.edit ? roundEdit.round!.id : null, entries })}
          onDelete={roundEdit.edit ? () => removeRound.mutate(roundEdit.round!.id) : undefined}
        />
      )}

      <WinnerOverlay match={m} open={celebrate && m.status === 'finished'} onClose={() => setCelebrate(false)} onRematch={rematch} />
    </div>
  );
}

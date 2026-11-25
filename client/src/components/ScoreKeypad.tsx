import { Delete, ListOrdered, Plus, SkipForward, Trophy, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Match, MatchPlayer } from '../lib/types';
import { alpha, cn, fmt, quickSteps } from '../lib/utils';
import { PlayerAvatar } from './PlayerAvatar';

interface Props {
  match: Match;
  target: MatchPlayer;
  isTurn: boolean;
  turnName: string;
  busy: boolean;
  canUndo: boolean;
  onSubmit: (value: number) => void;
  onUndo: () => void;
  onSkip: () => void;
  onThird: () => void;
}

/** Panel de anotación: jugador al que se anota, teclado, atajos +N y acciones. */
export function ScoreKeypad({ match, target, isTurn, turnName, busy, canUndo, onSubmit, onUndo, onSkip, onThird }: Props) {
  const s = match.settings;
  const [raw, setRaw] = useState('');
  const [negative, setNegative] = useState(false);
  const countdown = s.mode === 'countdown';

  useEffect(() => {
    setRaw('');
    setNegative(false);
  }, [target.id, match.rounds.length]);

  const value = (negative ? -1 : 1) * (Number(raw) || 0);
  const total = match.totals[target.id] ?? 0;
  const left =
    s.end_type === 'zero' || countdown
      ? total
      : s.end_type === 'target' && s.target_score != null
        ? s.target_score - total
        : null;

  const press = (d: string) => setRaw((r) => (r === '0' ? d : (r + d).slice(0, 6)));
  const add = (n: number) => setRaw((r) => String(Math.min(999999, (Number(r) || 0) + n)));
  const submit = () => value !== 0 && !busy && onSubmit(value);
  const roundMode = s.entry_mode === 'round';

  const header = (
    <div className="flex items-center gap-3">
      <PlayerAvatar avatar={target.avatar} color={target.color} size="lg" className="ring-2 ring-offset-2 ring-offset-[#13131f]" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold tracking-[0.18em] text-zinc-500 uppercase">
          {isTurn ? 'Le toca a' : `Anotando a (turno de ${turnName})`}
        </p>
        <p className="truncate text-2xl font-extrabold">{target.name}</p>
        <p className="text-[13px] text-zinc-400">
          Total <b className="font-mono text-zinc-200">{fmt(total)}</b> {s.entry_label}
          {left !== null && <> · faltan {fmt(Math.max(0, left))}</>}
        </p>
      </div>
      {s.default_entry == null && (
        <div className="text-right">
          <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">{countdown ? 'Paga' : 'Ronda'}</p>
          <p className="font-mono text-4xl font-extrabold" style={{ color: target.color }}>
            {negative && raw ? '-' : ''}
            {raw || '0'}
          </p>
        </div>
      )}
    </div>
  );

  const actions = (
    <div className="grid grid-cols-3 gap-2">
      <button onClick={onUndo} disabled={!canUndo || busy} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2/60 text-sm disabled:opacity-40">
        <Undo2 className="size-4" /> Deshacer
      </button>
      <button onClick={onSkip} disabled={busy} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2/60 text-sm disabled:opacity-40">
        <SkipForward className="size-4" /> Saltar
      </button>
      <button onClick={onThird} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface-2/60 text-sm">
        <ListOrdered className="size-4" /> {roundMode ? 'Ronda' : 'Resumen'}
      </button>
    </div>
  );

  // Juegos de victorias (Virus!, Trio…): un botón directo.
  if (s.default_entry != null) {
    return (
      <div className="card space-y-3 p-3.5">
        {header}
        <button
          onClick={() => onSubmit(s.default_entry!)}
          disabled={busy}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white disabled:opacity-60"
          style={{ background: target.color }}
        >
          <Trophy className="size-5" /> {target.name} gana la ronda (+{s.default_entry} {s.entry_label})
        </button>
        <p className="text-center text-xs text-zinc-500">Toca otro jugador arriba para dar la victoria a otra persona.</p>
        {actions}
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-3.5">
      {header}
      <div className="flex flex-wrap gap-1.5">
        {quickSteps(s).map((n) => (
          <button key={n} onClick={() => add(n)} className="h-8 rounded-full border border-line px-3 font-mono text-xs text-zinc-300 hover:bg-surface-2">
            +{n}
          </button>
        ))}
        <button onClick={() => (setRaw(''), setNegative(false))} className="h-8 rounded-full border border-line px-3 text-xs text-zinc-300 hover:bg-surface-2">
          Borrar
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} onClick={() => press(d)} className="h-12 rounded-xl bg-surface-2 font-mono text-xl font-semibold hover:bg-surface-3 active:scale-95">
            {d}
          </button>
        ))}
        <button
          aria-label="Cambiar signo"
          onClick={() => setNegative((n) => !n)}
          disabled={countdown}
          className={cn('h-12 rounded-xl bg-surface-2 font-mono text-xl hover:bg-surface-3 disabled:opacity-40', negative && 'bg-rose-500/20 text-rose-300')}
        >
          ±
        </button>
        <button onClick={() => press('0')} className="h-12 rounded-xl bg-surface-2 font-mono text-xl font-semibold hover:bg-surface-3 active:scale-95">
          0
        </button>
        <button aria-label="Borrar dígito" onClick={() => setRaw((r) => r.slice(0, -1))} className="flex h-12 items-center justify-center rounded-xl bg-surface-2 hover:bg-surface-3">
          <Delete className="size-5" />
        </button>
      </div>
      <button
        onClick={submit}
        disabled={value === 0 || busy}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-white transition-opacity disabled:opacity-45"
        style={{ background: value === 0 ? alpha(target.color, 0.55) : target.color }}
      >
        <Plus className="size-4" />
        {countdown ? `${target.name} paga ${fmt(value)} ${s.entry_label}` : `Anotar ${fmt(value)} a ${target.name}`}
      </button>
      {actions}
    </div>
  );
}

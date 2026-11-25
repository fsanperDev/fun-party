import { RotateCcw, Table } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { createPortal } from 'react-dom';
import { CONFETTI } from '../lib/constants';
import type { Match } from '../lib/types';
import { fmt, joinNames } from '../lib/utils';
import { PlayerAvatar } from './PlayerAvatar';

/** Celebración de fin de partida: confeti de emojis, ganador(es) y podio. */
export function WinnerOverlay({
  match,
  open,
  onClose,
  onRematch,
}: {
  match: Match;
  open: boolean;
  onClose: () => void;
  onRematch: () => void;
}) {
  // Los avisos no deben tapar la celebración.
  useEffect(() => {
    if (open) toast.dismiss();
  }, [open]);
  const winners = match.players.filter((p) => match.winner_ids.includes(p.id));
  const podium = match.ranking.slice(0, 3);
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        e: CONFETTI[i % CONFETTI.length],
        left: Math.random() * 100,
        delay: Math.random() * 1.5,
        dur: 3 + Math.random() * 3,
        rot: Math.random() * 360,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [open],
  );

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/85 p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            {pieces.map((p, i) => (
              <motion.span
                key={i}
                className="absolute text-2xl"
                style={{ left: `${p.left}%`, top: -40 }}
                initial={{ y: -40, rotate: 0 }}
                animate={{ y: '110vh', rotate: p.rot + 360 }}
                transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: 'linear' }}
              >
                {p.e}
              </motion.span>
            ))}
          </div>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', damping: 18 }}
            className="relative w-full max-w-sm rounded-3xl border border-violet-500/40 bg-[#171427] p-5 text-center shadow-[0_0_80px_-10px_rgba(139,92,246,0.6)]"
          >
            <p className="text-[11px] font-bold tracking-[0.2em] text-violet-300 uppercase">
              {match.game_emoji} {match.game_name} · Fin de partida
            </p>
            <div className="mt-3 text-4xl">👑</div>
            <div className="mt-2 flex justify-center gap-2">
              {winners.map((w) => (
                <PlayerAvatar key={w.id} avatar={w.avatar} color={w.color} size="xl" />
              ))}
            </div>
            <h2 className="mt-3 text-3xl font-extrabold">{joinNames(winners.map((w) => w.name))}</h2>
            <p className="text-sm text-zinc-300">{winners.length > 1 ? '¡Empate en la victoria!' : '¡Gana la partida!'}</p>
            <ol className="mt-4 space-y-1.5 text-left">
              {podium.map((r) => {
                const p = match.players.find((x) => x.id === r.player_id)!;
                return (
                  <li key={r.player_id} className="flex items-center gap-2.5 rounded-xl bg-black/25 px-3 py-2">
                    <span className="w-6 font-mono text-sm font-bold text-amber-300">{r.position}º</span>
                    <PlayerAvatar avatar={p.avatar} color={p.color} size="sm" />
                    <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
                    <span className="font-mono font-bold">{fmt(r.total)}</span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={onClose} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface-2 text-sm">
                <Table className="size-4" /> Marcador
              </button>
              <button onClick={onRematch} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-violet-600 text-sm font-semibold text-white">
                <RotateCcw className="size-4" /> Revancha
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

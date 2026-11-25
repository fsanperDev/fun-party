import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Match, Round } from '../lib/types';
import { PlayerAvatar } from './PlayerAvatar';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

/**
 * "Ronda N completa" (anotar a todos a la vez) y "Editar ronda N" (corregir).
 * Una casilla vacía quita esa puntuación.
 */
export function RoundDialog({
  open,
  onClose,
  match,
  round,
  roundNumber,
  onSave,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  match: Match;
  round: Round | null;
  roundNumber: number;
  onSave: (entries: { player_id: string; value: number | null }[]) => void;
  onDelete?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const editing = round && round.entries.length > 0 && !!onDelete;

  useEffect(() => {
    if (!open) return;
    const v: Record<string, string> = {};
    for (const p of match.players) {
      const e = round?.entries.find((x) => x.player_id === p.id);
      v[p.id] = e ? String(e.value) : '';
    }
    setValues(v);
  }, [open, round, match.players]);

  const save = () =>
    onSave(
      match.players.map((p) => {
        const t = (values[p.id] ?? '').trim().replace(',', '.');
        return { player_id: p.id, value: t === '' || t === '-' ? null : Number(t) };
      }),
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? `Editar ronda ${roundNumber}` : `Ronda ${roundNumber} completa`}
      description={editing ? 'Corrige cualquier error de puntuación.' : 'Introduce los puntos de todos a la vez.'}
    >
      <form
        className="space-y-2 pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {match.players.map((p, i) => (
          <label key={p.id} className="flex items-center gap-2.5 rounded-xl bg-surface-2/60 px-2 py-1.5">
            <PlayerAvatar avatar={p.avatar} color={p.color} size="sm" />
            <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
            <input
              inputMode="decimal"
              autoFocus={i === 0}
              aria-label={`${p.avatar} ${p.name} ${match.settings.entry_label}`}
              placeholder="—"
              value={values[p.id] ?? ''}
              onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value.replace(/[^\d,.-]/g, '') }))}
              className="h-10 w-20 rounded-lg border border-line bg-[#0d0e16] px-2 text-right font-mono text-lg outline-none focus:border-violet-500"
            />
            <span className="w-12 text-xs text-zinc-500">{match.settings.entry_label}</span>
          </label>
        ))}
        <p className="text-xs text-zinc-500">Deja una casilla vacía para quitar esa puntuación. Usa «-» para valores negativos.</p>
        <div className="flex gap-2 pt-2">
          {editing && (
            <Button variant="danger" onClick={onDelete}>
              <Trash2 className="size-4" /> Eliminar
            </Button>
          )}
          <Button type="submit" className="h-11 flex-1">
            Guardar
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

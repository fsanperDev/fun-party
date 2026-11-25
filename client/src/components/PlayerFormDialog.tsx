import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { keys, useInvalidate, usePlayers } from '../hooks/queries';
import { api } from '../lib/api';
import { PLAYER_AVATARS, PLAYER_COLORS } from '../lib/constants';
import type { Player } from '../lib/types';
import { alpha, cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

/** "Nuevo jugador" / "Editar jugador": nombre, avatar, color y habitual. */
export function PlayerFormDialog({
  open,
  onClose,
  player,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  player?: Player | null;
  onSaved?: (p: Player) => void;
}) {
  const { data: players = [] } = usePlayers();
  const others = players.filter((p) => p.id !== player?.id);
  const usedColors = new Set(others.map((p) => p.color.toUpperCase()));
  const firstFree = PLAYER_COLORS.find((c) => !usedColors.has(c.hex))?.hex ?? PLAYER_COLORS[0].hex;
  const usedAvatars = new Set(others.map((p) => p.avatar));
  const freeAvatar = PLAYER_AVATARS.find((a) => !usedAvatars.has(a)) ?? PLAYER_AVATARS[0];

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState(PLAYER_AVATARS[0]);
  const [color, setColor] = useState(firstFree);
  const [favorite, setFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();

  useEffect(() => {
    if (!open) return;
    setName(player?.name ?? '');
    setAvatar(player?.avatar ?? freeAvatar);
    setColor(player?.color?.toUpperCase() ?? firstFree);
    setFavorite(player?.favorite ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, player]);

  async function save() {
    if (!name.trim()) return toast.error('Escribe un nombre');
    setSaving(true);
    try {
      const body = { name: name.trim(), avatar, color, favorite };
      const saved = player ? await api.players.update(player.id, body) : await api.players.create(body);
      await invalidate(keys.players, keys.stats);
      onSaved?.(saved);
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={player ? 'Editar jugador' : 'Nuevo jugador'}>
      <div className="space-y-4 pt-1">
        <div className="flex items-end gap-3">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl border-2 text-3xl"
            style={{ borderColor: color, background: alpha(color, 0.15) }}
          >
            {avatar}
          </span>
          <div className="flex-1">
            <label className="label" htmlFor="player-name">
              Nombre
            </label>
            <input
              id="player-name"
              className="field"
              placeholder="Ej. Pablo"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              autoFocus
            />
          </div>
        </div>
        <div>
          <p className="label">Avatar</p>
          <div className="grid grid-cols-8 gap-1.5">
            {PLAYER_AVATARS.map((a) => (
              <button
                key={a}
                aria-label={`Avatar ${a}`}
                onClick={() => setAvatar(a)}
                className={cn('aspect-square rounded-xl text-xl', avatar === a ? 'bg-violet-500/25 ring-2 ring-violet-500' : 'bg-surface-2 hover:bg-surface-3')}
              >
                {a}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="label">Color</p>
          <div className="grid grid-cols-8 gap-2">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c.hex}
                aria-label={`Color ${c.name}`}
                onClick={() => setColor(c.hex)}
                className={cn(
                  'aspect-square rounded-full transition-opacity',
                  color === c.hex && 'ring-2 ring-white ring-offset-2 ring-offset-[#11131d]',
                  usedColors.has(c.hex) && color !== c.hex && 'opacity-35',
                )}
                style={{ background: c.hex }}
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Los colores atenuados ya los usa otro jugador.</p>
        </div>
        <button
          onClick={() => setFavorite((v) => !v)}
          aria-pressed={favorite}
          className={cn(
            'flex h-11 w-full items-center gap-2 rounded-xl border px-3 text-sm font-semibold',
            favorite ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-line text-zinc-300',
          )}
        >
          <Star className={cn('size-4', favorite && 'fill-amber-400 text-amber-400')} /> Jugador habitual
        </button>
        <Button size="md" className="h-11 w-full" onClick={save} disabled={saving}>
          {player ? 'Guardar cambios' : 'Crear jugador'}
        </Button>
      </div>
    </Dialog>
  );
}

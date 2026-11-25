import { Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { keys, useInvalidate } from '../hooks/queries';
import { api } from '../lib/api';
import { GAME_EMOJIS, PLAYER_COLORS } from '../lib/constants';
import type { EndType, EntryMode, Game, ScoreMode, WinCondition } from '../lib/types';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { useConfirm } from './ui/Confirm';
import { Dialog } from './ui/Dialog';
import { Segmented } from './ui/Segmented';

interface FormState {
  name: string;
  entry_label: string;
  emoji: string;
  color: string;
  mode: ScoreMode;
  win_condition: WinCondition;
  end_type: EndType;
  target_score: string;
  rounds_count: string;
  start_scores: Record<string, string>;
  start_score_default: string;
  entry_mode: EntryMode;
  min_players: string;
  max_players: string;
  alert_margin: string;
  default_entry: string;
  teams: boolean;
  manufacturer: string;
  rules_url: string;
  description: string;
  objective: string;
  setup: string;
  rules: string;
  scoring_notes: string;
  aliases: string;
}

const toForm = (g?: Partial<Game>, name = ''): FormState => ({
  name: g?.name ?? name,
  entry_label: g?.entry_label ?? 'puntos',
  emoji: g?.emoji ?? '🎴',
  color: g?.color ?? '#8B5CF6',
  mode: g?.mode ?? 'points',
  win_condition: g?.win_condition ?? 'high',
  end_type: g?.end_type === 'zero' ? 'target' : g?.end_type ?? 'target',
  target_score: g?.target_score != null ? String(g.target_score) : g ? '' : '100',
  rounds_count: g?.rounds_count != null ? String(g.rounds_count) : '',
  start_scores: Object.fromEntries(Object.entries(g?.start_scores ?? {}).map(([k, v]) => [k, String(v)])),
  start_score_default: String(g?.start_score_default ?? 0),
  entry_mode: g?.entry_mode ?? 'round',
  min_players: String(g?.min_players ?? 2),
  max_players: String(g?.max_players ?? 8),
  alert_margin: String(g?.alert_margin ?? 10),
  default_entry: g?.default_entry != null ? String(g.default_entry) : '',
  teams: g?.teams ?? false,
  manufacturer: g?.manufacturer ?? '',
  rules_url: g?.rules_url ?? '',
  description: g?.description ?? '',
  objective: g?.objective ?? '',
  setup: (g?.setup ?? []).join('\n'),
  rules: (g?.rules ?? []).join('\n'),
  scoring_notes: (g?.scoring_notes ?? []).join('\n'),
  aliases: (g?.aliases ?? []).join(', '),
});

const lines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);
const num = (s: string) => (s.trim() === '' ? null : Number(s));

function toPayload(f: FormState): Partial<Game> {
  return {
    name: f.name.trim(),
    entry_label: f.entry_label.trim() || 'puntos',
    emoji: f.emoji,
    color: f.color,
    mode: f.mode,
    win_condition: f.win_condition,
    end_type: f.mode === 'countdown' ? 'zero' : f.end_type,
    target_score: num(f.target_score),
    rounds_count: num(f.rounds_count),
    start_scores: Object.fromEntries(
      Object.entries(f.start_scores)
        .filter(([, v]) => v.trim() !== '')
        .map(([k, v]) => [k, Number(v)]),
    ),
    start_score_default: num(f.start_score_default) ?? 0,
    entry_mode: f.entry_mode,
    min_players: num(f.min_players) ?? 2,
    max_players: num(f.max_players) ?? 8,
    alert_margin: num(f.alert_margin) ?? 0,
    default_entry: num(f.default_entry),
    teams: f.teams,
    manufacturer: f.manufacturer.trim(),
    rules_url: f.rules_url.trim(),
    description: f.description.trim(),
    objective: f.objective.trim(),
    setup: lines(f.setup),
    rules: lines(f.rules),
    scoring_notes: lines(f.scoring_notes),
    aliases: f.aliases.split(',').map((a) => a.trim()).filter(Boolean),
  };
}

/** "Configurar <juego>" / "Nuevo juego": todos los parámetros del marcador y la ficha. */
export function GameFormDialog({
  open,
  onClose,
  game,
  initialName = '',
}: {
  open: boolean;
  onClose: () => void;
  game?: Game;
  initialName?: string;
}) {
  const [f, setF] = useState<FormState>(() => toForm(game, initialName));
  const [saving, setSaving] = useState(false);
  const invalidate = useInvalidate();
  const navigate = useNavigate();
  const confirm = useConfirm();

  useEffect(() => {
    if (open) setF(toForm(game, initialName));
  }, [open, game, initialName]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  async function save() {
    if (!f.name.trim()) return toast.error('El nombre es obligatorio');
    if (f.mode !== 'countdown' && f.end_type === 'target' && !(Number(f.target_score) > 0))
      return toast.error('Indica la puntuación objetivo');
    if (f.mode !== 'countdown' && f.end_type === 'rounds' && !(Number(f.rounds_count) > 0))
      return toast.error('Indica el número de rondas');
    setSaving(true);
    try {
      const saved = game ? await api.games.update(game.id, toPayload(f)) : await api.games.create(toPayload(f));
      await invalidate(keys.games, keys.game(saved.id));
      toast.success(game ? 'Parámetros guardados' : 'Juego creado');
      onClose();
      if (!game) navigate(`/juegos/${saved.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!game) return;
    const g = await api.games.reset(game.id);
    await invalidate(keys.games, keys.game(g.id));
    setF(toForm(g));
    toast.success('Valores oficiales restablecidos');
  }

  async function remove() {
    if (!game) return;
    const ok = await confirm({ title: `¿Eliminar ${game.name}?`, description: 'Las partidas ya jugadas se conservan.', confirmLabel: 'Eliminar', danger: true });
    if (!ok) return;
    await api.games.remove(game.id);
    await invalidate(keys.games);
    onClose();
    navigate('/juegos');
  }

  const counts = [2, 3, 4, 5, 6, 7, 8];

  return (
    <Dialog open={open} onClose={onClose} title={game ? `Configurar ${game.name}` : 'Nuevo juego'} className="max-w-md">
      <div className="space-y-4 pt-1">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">Nombre</label>
            <input className="field" placeholder="Ej. Dobble" value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          </div>
          <div className="w-28">
            <label className="label">Etiqueta</label>
            <input className="field" value={f.entry_label} onChange={(e) => set('entry_label', e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Icono y color</label>
          <div className="flex flex-wrap gap-1.5">
            {GAME_EMOJIS.map((e) => (
              <button
                key={e}
                aria-label={e}
                onClick={() => set('emoji', e)}
                className={cn('size-8 rounded-lg text-lg', f.emoji === e ? 'bg-violet-500/25 ring-2 ring-violet-500' : 'bg-surface-2')}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {PLAYER_COLORS.map((c) => (
              <button
                key={c.hex}
                aria-label={c.name}
                onClick={() => set('color', c.hex)}
                className={cn('size-7 rounded-full', f.color === c.hex && 'ring-2 ring-white ring-offset-2 ring-offset-[#11131d]')}
                style={{ background: c.hex }}
              />
            ))}
          </div>
        </div>

        <div>
          <label className="label">Tipo de marcador</label>
          <Segmented
            value={f.mode}
            onChange={(v) => set('mode', v)}
            options={[
              { value: 'points', label: 'Sumar puntos' },
              { value: 'countdown', label: 'Presupuesto que se gasta' },
            ]}
          />
        </div>

        <div>
          <label className="label">¿Quién gana?</label>
          <Segmented
            value={f.win_condition}
            onChange={(v) => set('win_condition', v)}
            options={[
              { value: 'high', label: 'Más puntos' },
              { value: 'low', label: 'Menos puntos' },
            ]}
          />
        </div>

        {f.mode === 'countdown' ? (
          <div>
            <label className="label">Presupuesto inicial por nº de jugadores</label>
            <div className="grid grid-cols-3 gap-2">
              {counts.map((n) => (
                <div key={n} className="flex items-center gap-1 rounded-xl border border-line bg-surface-2/50 pl-2">
                  <span className="text-xs text-zinc-500">{n}j</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label={`Presupuesto con ${n} jugadores`}
                    className="h-9 w-full rounded-lg bg-transparent px-2 text-sm outline-none"
                    value={f.start_scores[String(n)] ?? ''}
                    onChange={(e) => set('start_scores', { ...f.start_scores, [String(n)]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <input
              type="number"
              inputMode="numeric"
              aria-label="Presupuesto por defecto"
              className="field mt-2"
              value={f.start_score_default}
              onChange={(e) => set('start_score_default', e.target.value)}
            />
          </div>
        ) : (
          <div>
            <label className="label">Fin de la partida</label>
            <Segmented
              value={f.end_type}
              onChange={(v) => set('end_type', v)}
              options={[
                { value: 'target', label: 'Puntuación' },
                { value: 'rounds', label: 'Nº rondas' },
                { value: 'manual', label: 'Manual' },
              ]}
            />
            {f.end_type === 'target' && (
              <input
                type="number"
                inputMode="numeric"
                className="field mt-2"
                placeholder="Puntuación objetivo"
                aria-label="Puntuación objetivo"
                value={f.target_score}
                onChange={(e) => set('target_score', e.target.value)}
              />
            )}
            {f.end_type === 'rounds' && (
              <input
                type="number"
                inputMode="numeric"
                className="field mt-2"
                placeholder="Número de rondas"
                aria-label="Número de rondas"
                value={f.rounds_count}
                onChange={(e) => set('rounds_count', e.target.value)}
              />
            )}
          </div>
        )}

        <div>
          <label className="label">Cómo se anota</label>
          <Segmented
            value={f.entry_mode}
            onChange={(v) => set('entry_mode', v)}
            options={[
              { value: 'round', label: 'Todos puntúan cada ronda' },
              { value: 'free', label: 'Solo uno por anotación' },
            ]}
          />
        </div>

        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['min_players', 'Mín. jug.'],
              ['max_players', 'Máx. jug.'],
              ['alert_margin', 'Margen alerta'],
            ] as const
          ).map(([k, l]) => (
            <div key={k}>
              <label className="label text-xs">{l}</label>
              <input type="number" inputMode="numeric" className="field" aria-label={l} value={f[k]} onChange={(e) => set(k, e.target.value)} />
            </div>
          ))}
        </div>

        <div>
          <label className="label">Valor rápido (ej. 1 para «victorias»)</label>
          <input
            type="number"
            inputMode="numeric"
            className="field"
            placeholder="Vacío = teclado numérico"
            value={f.default_entry}
            onChange={(e) => set('default_entry', e.target.value)}
          />
        </div>

        <button
          onClick={() => set('teams', !f.teams)}
          className="flex h-12 w-full items-center justify-between rounded-2xl border border-line px-4 text-sm"
          aria-pressed={f.teams}
        >
          <span>Se juega por parejas / equipos</span>
          <span className={cn('font-semibold', f.teams ? 'text-violet-300' : 'text-zinc-400')}>{f.teams ? 'Sí' : 'No'}</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Fabricante</label>
            <input className="field" value={f.manufacturer} onChange={(e) => set('manufacturer', e.target.value)} />
          </div>
          <div>
            <label className="label">Reglamento (enlace)</label>
            <input className="field" placeholder="https://…" value={f.rules_url} onChange={(e) => set('rules_url', e.target.value)} />
          </div>
        </div>

        {(
          [
            ['description', 'Descripción', 2],
            ['objective', 'Objetivo', 2],
            ['setup', 'Preparación (un paso por línea)', 4],
            ['rules', 'Cómo se juega (un paso por línea)', 5],
            ['scoring_notes', 'Puntuación (una nota por línea)', 4],
          ] as const
        ).map(([k, l, rows]) => (
          <div key={k}>
            <label className="label">{l}</label>
            <textarea className="textarea" rows={rows} value={f[k]} onChange={(e) => set(k, e.target.value)} />
          </div>
        ))}

        <div>
          <label className="label">Nombres para la voz (separados por coma)</label>
          <input className="field" value={f.aliases} onChange={(e) => set('aliases', e.target.value)} />
        </div>

        <Button className="w-full" size="lg" onClick={save} disabled={saving}>
          {game ? 'Guardar parámetros' : 'Crear juego'}
        </Button>
        {game && !game.is_custom && (
          <Button variant="ghost" className="w-full" onClick={reset}>
            Restablecer valores oficiales
          </Button>
        )}
        {game?.is_custom && (
          <Button variant="danger" className="w-full" onClick={remove}>
            <Trash2 className="size-4" /> Eliminar juego
          </Button>
        )}
      </div>
    </Dialog>
  );
}

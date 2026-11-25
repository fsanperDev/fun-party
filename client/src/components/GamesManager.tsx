import { useQuery } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2, Pencil, Plus, Search, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { keys, useGames, useInvalidate } from '../hooks/queries';
import { api, LOCAL_MODE } from '../lib/api';
import type { Game } from '../lib/types';
import { cn, gameRule, norm } from '../lib/utils';
import { GameFormDialog } from './GameFormDialog';
import { Button } from './ui/Button';
import { Dialog } from './ui/Dialog';

function GameCover({ game }: { game: Game }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  return (
    <div className="relative flex h-full w-full items-center justify-center text-6xl" style={{ background: `${game.color}33` }}>
      <span aria-hidden className={state === 'ok' ? 'opacity-0' : ''}>
        {game.emoji}
      </span>
      {game.image_url && state !== 'error' && (
        <img
          src={game.image_url}
          alt={game.name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${state === 'ok' ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
}

/** "Añadir juego": con IA (si está configurada) o rellenándolo a mano. */
function AddGameDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: integrations } = useQuery({ queryKey: ['integrations'], queryFn: api.games.integrations });
  const invalidate = useInvalidate();
  const navigate = useNavigate();

  async function withAi() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const g = await api.games.createWithAi(name.trim());
      await invalidate(keys.games);
      toast.success('Preparando la ficha con IA…');
      onClose();
      setName('');
      navigate(`/juegos/${g.id}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Dialog
        open={open && !manual}
        onClose={onClose}
        title="Añadir juego"
        description="Escribe el nombre y la IA preparará automáticamente sus normas oficiales, la puntuación y las imágenes."
      >
        <form
          className="space-y-2.5 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            void withAi();
          }}
        >
          <input
            className="field"
            placeholder="Ej. Dobble, Coup, The Mind…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <Button type="submit" size="md" className="h-11 w-full" disabled={!name.trim() || busy || integrations?.ai === false}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Crear ficha con IA
          </Button>
          {integrations?.ai === false && (
            <p className="text-xs text-zinc-500">
              {LOCAL_MODE
                ? 'La creación con IA necesita el servidor; en la versión web estática rellena la ficha tú.'
                : 'La IA no está configurada en este servidor (ANTHROPIC_API_KEY). Puedes rellenarlo tú.'}
            </p>
          )}
          <Button variant="outline" className="w-full" onClick={() => setManual(true)}>
            <Pencil className="size-4" /> Prefiero rellenarlo yo
          </Button>
        </form>
      </Dialog>
      <GameFormDialog
        open={open && manual}
        initialName={name}
        onClose={() => {
          setManual(false);
          onClose();
        }}
      />
    </>
  );
}

/** Rejilla de juegos con buscador, alta de juegos y juegos ocultos (Juegos y Ajustes › Juegos). */
export function GamesManager() {
  const { data: games = [], isLoading } = useGames();
  const [q, setQ] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [adding, setAdding] = useState(false);
  const invalidate = useInvalidate();
  const navigate = useNavigate();

  const hiddenCount = games.filter((g) => g.hidden).length;
  const list = useMemo(() => {
    const t = norm(q);
    return games
      .filter((g) => g.hidden === showHidden)
      .filter((g) => !t || norm(`${g.name} ${g.manufacturer} ${g.category}`).includes(t));
  }, [games, q, showHidden]);

  async function unhide(g: Game) {
    await api.games.update(g.id, { hidden: false });
    await invalidate(keys.games, keys.game(g.id));
    toast.success(`${g.name} vuelve a tus juegos`);
  }

  return (
    <div>
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-zinc-500" />
          <input className="field pl-10" placeholder="Buscar juego o editorial..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <Button className="h-12 rounded-2xl" onClick={() => setAdding(true)}>
          <Plus className="size-4" /> Añadir
        </Button>
      </div>

      {(hiddenCount > 0 || showHidden) && (
        <button
          onClick={() => setShowHidden((v) => !v)}
          className={cn(
            'mt-3 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
            showHidden ? 'border-amber-500/40 bg-amber-500/10 text-amber-200' : 'border-line-strong text-zinc-300',
          )}
        >
          {showHidden ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          {showHidden ? 'Volver a mis juegos' : `Juegos ocultos (${hiddenCount})`}
        </button>
      )}

      {isLoading ? (
        <div className="mt-10 flex justify-center text-zinc-500">
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : list.length === 0 ? (
        <p className="mt-8 text-center text-sm text-zinc-500">{showHidden ? 'No hay juegos ocultos.' : 'No hay juegos que coincidan.'}</p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {list.map((g) => (
            <div key={g.id} className="relative">
              <button
                onClick={() => navigate(`/juegos/${g.id}`)}
                className="card block w-full overflow-hidden text-left transition-transform active:scale-[0.99]"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b-[3px]" style={{ borderBottomColor: g.color }}>
                  <GameCover game={g} />
                </div>
                <div className="p-2.5 pb-3">
                  <p className="truncate font-bold">{g.name}</p>
                  <p className="truncate text-xs text-zinc-500">{g.manufacturer || g.category}</p>
                  <p className="mt-1.5 text-[11px] leading-snug text-zinc-400">
                    {g.ai_status === 'pending' ? 'Preparando la ficha con IA…' : g.ai_status === 'error' ? 'La IA no pudo preparar la ficha' : gameRule(g)}
                  </p>
                </div>
              </button>
              {g.hidden && (
                <button
                  onClick={() => unhide(g)}
                  className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-xs text-white backdrop-blur"
                >
                  <Eye className="size-3.5" /> Mostrar
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <AddGameDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

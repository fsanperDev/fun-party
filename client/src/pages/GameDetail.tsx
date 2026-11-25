import { ArrowLeft, ExternalLink, Eye, EyeOff, ImageIcon, Loader2, Play, SlidersHorizontal, Star, Users, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { GameFormDialog } from '../components/GameFormDialog';
import { GameIcon } from '../components/GameIcon';
import { ImagesDialog } from '../components/ImagesDialog';
import { keys, useGame, useInvalidate } from '../hooks/queries';
import { api } from '../lib/api';
import type { Game } from '../lib/types';
import { alpha, gameRule } from '../lib/utils';

/** Contenido de normas reutilizado en la ficha y en el panel "Normas" de la partida. */
export function GameRules({ game }: { game: Game }) {
  return (
    <div className="space-y-6">
      {game.objective && (
        <div className="rounded-2xl border px-4 py-3" style={{ borderColor: alpha(game.color, 0.35), background: alpha(game.color, 0.08) }}>
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: game.color }}>
            Objetivo
          </p>
          <p className="mt-1 text-[15px] text-zinc-100">{game.objective}</p>
        </div>
      )}
      {(
        [
          ['Preparación', game.setup],
          ['Cómo se juega, paso a paso', game.rules],
        ] as const
      ).map(
        ([title, steps]) =>
          steps.length > 0 && (
            <section key={title}>
              <h3 className="mb-3 text-lg font-bold">{title}</h3>
              <ol className="space-y-3">
                {steps.map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-zinc-300">
                    <span
                      className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold"
                      style={{ background: alpha(game.color, 0.15), color: game.color }}
                    >
                      {i + 1}
                    </span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          ),
      )}
      {game.scoring_notes.length > 0 && (
        <section>
          <h3 className="mb-3 text-lg font-bold">Puntuación</h3>
          <ul className="space-y-2">
            {game.scoring_notes.map((s, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-300">
                <Star className="mt-0.5 size-4 shrink-0" style={{ color: game.color }} />
                <span>{s}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-zinc-300">
            <span className="text-[11px] font-bold tracking-wider text-violet-400 uppercase">En Fun Party</span> · {gameRule(game)}
          </p>
        </section>
      )}
      {game.rules_url && (
        <a
          href={game.rules_url}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface text-sm font-medium hover:bg-surface-2"
        >
          <ExternalLink className="size-4" /> Reglamento oficial del fabricante
        </a>
      )}
    </div>
  );
}

export default function GameDetail() {
  const { id = '' } = useParams();
  const { data: game, isLoading, error } = useGame(id);
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [viewer, setViewer] = useState<string | null>(null);
  const invalidate = useInvalidate();
  const navigate = useNavigate();

  if (isLoading)
    return (
      <div className="mt-20 flex justify-center text-zinc-500">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  if (error || !game) return <p className="mt-10 text-center text-zinc-400">Juego no encontrado.</p>;

  async function toggleHidden() {
    if (!game) return;
    await api.games.update(game.id, { hidden: !game.hidden });
    await invalidate(keys.games, keys.game(game.id));
    toast.success(game.hidden ? `${game.name} vuelve a tus juegos` : `${game.name} oculto`);
    if (!game.hidden) navigate('/juegos');
  }

  return (
    <div className="-mx-4 -mt-4">
      <div className="px-4 pt-4 pb-5" style={{ background: `linear-gradient(180deg, ${alpha(game.color, 0.18)}, transparent)` }}>
        <Link to="/juegos" aria-label="Volver" className="inline-flex size-9 items-center justify-center rounded-xl bg-black/30 text-zinc-200 hover:bg-black/50">
          <ArrowLeft className="size-4" />
        </Link>
        <div className="mt-3 flex items-center gap-4">
          <button onClick={() => game.image_url && setViewer(game.image_url)} aria-label={game.name}>
            <GameIcon game={game} className="h-32 w-26 rounded-2xl text-5xl" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: game.color }}>
              {game.category}
            </p>
            <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight">{game.name}</h1>
            {game.manufacturer && <p className="text-sm text-zinc-400">{game.manufacturer}</p>}
            <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-xs text-zinc-300">
              <Users className="size-3.5" /> {game.min_players}–{game.max_players} jugadores
            </span>
          </div>
        </div>
        {game.ai_status === 'pending' && (
          <p className="mt-4 flex items-center gap-2 text-sm text-violet-300">
            <Loader2 className="size-4 animate-spin" /> La IA está preparando las normas y la puntuación…
          </p>
        )}
        {game.ai_status === 'error' && <p className="mt-4 text-sm text-rose-300">La IA no pudo preparar la ficha: {game.ai_error}</p>}
        {game.description && <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">{game.description}</p>}
      </div>

      <div className="space-y-6 px-4">
        <div className="flex gap-2">
          <Link
            to={`/nueva?juego=${encodeURIComponent(game.id)}`}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold text-white"
            style={{ background: game.color }}
          >
            <Play className="size-4 fill-current" /> Jugar
          </Link>
          <button aria-label="Editar parámetros" onClick={() => setEditing(true)} className="flex size-12 items-center justify-center rounded-2xl border border-line-strong bg-surface hover:bg-surface-2">
            <SlidersHorizontal className="size-4" />
          </button>
          <button
            aria-label={game.hidden ? 'Mostrar juego' : 'Ocultar juego'}
            onClick={toggleHidden}
            className="flex size-12 items-center justify-center rounded-2xl border border-line-strong bg-surface hover:bg-surface-2"
          >
            {game.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </button>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold">Imágenes</h2>
            <button onClick={() => setManaging(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line-strong px-2 py-1 text-xs text-zinc-300 hover:bg-surface-2">
              <ImageIcon className="size-3.5" /> Gestionar
            </button>
          </div>
          {game.images.length ? (
            <div className="no-scrollbar -mx-4 flex snap-x gap-2.5 overflow-x-auto px-4">
              {game.images.map((src, i) => (
                <button
                  key={i}
                  aria-label={`${game.name} ${i + 1}`}
                  onClick={() => setViewer(src)}
                  className="relative flex h-36 w-48 shrink-0 snap-start items-center justify-center overflow-hidden rounded-2xl text-4xl"
                  style={{ background: alpha(game.color, 0.15) }}
                >
                  <span aria-hidden>{game.emoji}</span>
                  <img
                    src={src}
                    alt={`${game.name} ${i + 1}`}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : (
            <button onClick={() => setManaging(true)} className="w-full rounded-2xl border border-dashed border-line-strong py-6 text-sm text-zinc-500">
              Sin imágenes todavía. Añade una foto o impórtalas de BoardGameGeek.
            </button>
          )}
        </section>

        <GameRules game={game} />
      </div>

      <GameFormDialog open={editing} onClose={() => setEditing(false)} game={game} />
      <ImagesDialog open={managing} onClose={() => setManaging(false)} game={game} />
      {createPortal(
        <AnimatePresence>
          {viewer && (
            <motion.div
              className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewer(null)}
            >
              <button aria-label="Cerrar" className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white">
                <X className="size-5" />
              </button>
              <img src={viewer} alt="" referrerPolicy="no-referrer" className="max-h-full max-w-full rounded-xl object-contain" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  );
}

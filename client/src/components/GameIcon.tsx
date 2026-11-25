import { useState } from 'react';
import type { Game } from '../lib/types';
import { alpha, cn } from '../lib/utils';

/** Icono del juego: la imagen marcada con ★ o, si no hay, su emoji sobre su color. */
export function GameIcon({
  game,
  emoji,
  color,
  className,
  alt,
}: {
  game?: Pick<Game, 'image_url' | 'emoji' | 'color' | 'name'> | null;
  emoji?: string;
  color?: string;
  className?: string;
  /** Texto alternativo; usa "" si el icono va junto al nombre del juego. */
  alt?: string;
}) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const img = game?.image_url;
  const c = game?.color ?? color ?? '#8B5CF6';
  return (
    <span
      className={cn('relative inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl text-xl', className)}
      style={{ background: alpha(c, 0.2) }}
    >
      <span aria-hidden className={state === 'ok' ? 'opacity-0' : ''}>
        {game?.emoji ?? emoji ?? '🎴'}
      </span>
      {img && state !== 'error' && (
        <img
          src={img}
          alt={alt ?? game?.name ?? ''}
          onLoad={() => setState('ok')}
          onError={() => setState('error')}
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity', state === 'ok' ? 'opacity-100' : 'opacity-0')}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      )}
    </span>
  );
}

import { alpha, cn } from '../lib/utils';

const sizes = {
  xs: 'size-6 text-xs rounded-full border',
  sm: 'size-7 text-sm rounded-full border-2',
  md: 'size-9 text-lg rounded-xl border-2',
  lg: 'size-14 text-3xl rounded-2xl border-2',
  xl: 'size-20 text-5xl rounded-2xl border-2',
};

/** Avatar emoji con anillo del color del jugador. */
export function PlayerAvatar({
  avatar,
  color,
  size = 'md',
  className,
}: {
  avatar: string;
  color: string;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center leading-none', sizes[size], className)}
      style={{ borderColor: color, background: alpha(color, 0.15) }}
    >
      {avatar}
    </span>
  );
}

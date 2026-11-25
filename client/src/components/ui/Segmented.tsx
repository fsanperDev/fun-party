import { cn } from '../../lib/utils';

interface Option<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/** Selector segmentado (Sumar puntos / Presupuesto, Más / Menos, A puntos / A rondas / Libre…). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={cn('flex gap-1 rounded-2xl border border-line bg-surface-2/60 p-1', className)} role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
          className={cn(
            'flex-1 rounded-xl px-2 font-semibold transition-colors',
            size === 'md' ? 'h-9 text-[13px]' : 'h-8 text-xs',
            value === o.value ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200',
            o.disabled && 'opacity-40',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Pestañas tipo "Marcador / Evolución" y "Jugadores / Juegos / Voz / Partidas". */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-xl bg-surface-2/50 p-[3px]', className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'h-8 flex-1 rounded-lg border text-sm transition-colors',
            value === o.value ? 'border-line-strong bg-surface-3 text-zinc-100' : 'border-transparent text-zinc-400 hover:text-zinc-200',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

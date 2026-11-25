import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary: 'bg-violet-600 text-white hover:bg-violet-500 disabled:bg-violet-600/50 disabled:text-white/60',
  secondary: 'border border-line-strong bg-surface-3/30 text-zinc-100 hover:bg-surface-3',
  outline: 'border border-line bg-transparent text-zinc-200 hover:bg-surface-2',
  ghost: 'bg-transparent text-zinc-300 hover:bg-surface-2',
  danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 rounded-xl px-3 text-sm',
  md: 'h-11 rounded-2xl px-4 text-sm font-semibold',
  lg: 'h-14 rounded-[18px] px-5 text-base font-bold',
  icon: 'size-11 rounded-2xl',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 transition-colors duration-150 active:scale-[0.98] disabled:active:scale-100',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
});

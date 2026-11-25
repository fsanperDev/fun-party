import { X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const fn = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', fn);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/** Modal centrado con fondo difuminado (equivalente al Dialog de la app original). */
export function Dialog({ open, onClose, title, description, children, footer, className }: DialogProps) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.16 }}
            className={cn(
              'relative flex max-h-[92dvh] w-full max-w-sm flex-col overflow-hidden rounded-2xl border border-line bg-[#11131d] shadow-2xl',
              className,
            )}
          >
            {(title || description) && (
              <div className="px-4 pt-4 pb-2 pr-10">
                {title && <h2 className="text-base font-semibold text-zinc-100">{title}</h2>}
                {description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}
              </div>
            )}
            <button
              aria-label="Cerrar"
              onClick={onClose}
              className="absolute top-3 right-3 rounded-lg p-1 text-zinc-400 hover:bg-surface-2 hover:text-zinc-100"
            >
              <X className="size-4" />
            </button>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
            {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Panel inferior (Resumen, Normas, Opciones de la partida). */
export function Sheet({ open, onClose, title, description, children, className }: DialogProps) {
  useEscape(open, onClose);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className={cn(
              'safe-bottom absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-line bg-[#11131d]',
              className,
            )}
          >
            <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
              <div>
                {title && <h2 className="text-base font-semibold text-zinc-100">{title}</h2>}
                {description && <p className="mt-0.5 text-sm text-zinc-400">{description}</p>}
              </div>
              <button aria-label="Cerrar" onClick={onClose} className="rounded-lg p-1 text-zinc-400 hover:bg-surface-2 hover:text-zinc-100">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

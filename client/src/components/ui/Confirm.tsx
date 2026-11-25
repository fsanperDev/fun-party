import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (o: ConfirmOptions) => Promise<boolean>;
const Ctx = createContext<ConfirmFn>(async () => false);

/** Confirmación dentro de la app (sin diálogos nativos del navegador). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = useCallback<ConfirmFn>((o) => new Promise((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <Ctx.Provider value={confirm}>
      {children}
      <Dialog open={!!state} onClose={() => close(false)} title={state?.title} description={state?.description}>
        <div className="mt-2 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => close(false)}>
            Cancelar
          </Button>
          <Button variant={state?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)}>
            {state?.confirmLabel ?? 'Aceptar'}
          </Button>
        </div>
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConfirm = () => useContext(Ctx);

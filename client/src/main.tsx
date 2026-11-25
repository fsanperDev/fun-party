import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { LOCAL_MODE, setApi } from './lib/api';
import { setBackup } from './lib/local/backup';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { ConfirmProvider } from './components/ui/Confirm';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } },
});

// En GitHub Pages no hay servidor: se carga el modo local (IndexedDB) antes de pintar.
if (LOCAL_MODE) {
  const { createLocalApi } = await import('./lib/local/localApi');
  const local = await createLocalApi();
  setApi(local);
  setBackup(local.backup);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || '/'}>
        <ConfirmProvider>
          <App />
          <Toaster theme="dark" position="bottom-right" richColors offset={{ bottom: 160 }} mobileOffset={{ bottom: 160 }} />
        </ConfirmProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

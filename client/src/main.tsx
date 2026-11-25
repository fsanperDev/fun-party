import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import App from './App';
import { ConfirmProvider } from './components/ui/Confirm';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConfirmProvider>
          <App />
          <Toaster theme="dark" position="bottom-right" richColors offset={{ bottom: 160 }} mobileOffset={{ bottom: 160 }} />
        </ConfirmProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);

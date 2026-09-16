import { CssBaseline, ThemeProvider } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './lib/auth/AuthContext';
import { theme } from './theme';
// Ícone de TipoRegistro (ver components/MdiIcon.tsx) — o mesmo slug do Material Design Icons
// (pictogrammers.com/library/mdi) que o mobile usa via @expo/vector-icons/MaterialCommunityIcons.
// Carregado uma vez, globalmente (fonte + classes .mdi/.mdi-{slug}).
import '@mdi/font/css/materialdesignicons.min.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);

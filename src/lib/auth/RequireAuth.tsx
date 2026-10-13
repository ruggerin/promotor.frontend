import { Box, CircularProgress } from '@mui/material';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

/** Caminho da tela de aceite dos Termos/Política (docs/58 §7) — fora do layout, tela cheia. */
export const ROTA_ACEITE_TERMOS = '/aceite-termos';

export function RequireAuth() {
  const { isAuthenticated, isLoading, usuario } = useAuth();
  const { pathname } = useLocation();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Termos/Política com versão vigente ainda não aceita (primeiro acesso ou texto atualizado):
  // nenhuma tela antes do aceite. O bloqueio é só na interface (docs/58 §5.6).
  if ((usuario?.documentos_pendentes?.length ?? 0) > 0 && pathname !== ROTA_ACEITE_TERMOS) {
    return <Navigate to={ROTA_ACEITE_TERMOS} replace />;
  }

  return <Outlet />;
}

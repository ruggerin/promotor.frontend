import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Tooltip, Typography } from '@mui/material';
import { formatarDataSemFuso } from '../lib/formatarData';
import { textoAppsAcesso, textoUltimoAcesso } from '../lib/acesso';
import type { AcessoUsuario } from '../types/api';

// "hoje · app", "há 9 dias" em âmbar quando sumiu — docs/52 §4.1. O tooltip detalha por app e a
// frequência dos últimos 30 dias.
export function UltimoAcesso({ acesso }: { acesso: AcessoUsuario | undefined }) {
  if (!acesso) return <Typography variant="body2" color="text.secondary">—</Typography>;

  const apps = textoAppsAcesso(acesso.mobile_em, acesso.admin_em);
  const detalhe = [
    acesso.mobile_em ? `App: ${formatarDataSemFuso(acesso.mobile_em)}` : null,
    acesso.admin_em ? `Admin web: ${formatarDataSemFuso(acesso.admin_em)}` : null,
    `Usou em ${acesso.dias_ativos_30d} dos últimos 30 dias`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip title={acesso.ultimo_em ? detalhe : 'Nenhum uso registrado desde que a medição começou'}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: acesso.sumido ? '#b45309' : undefined }}>
        {acesso.sumido && <WarningAmberIcon sx={{ fontSize: 16 }} />}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: acesso.sumido ? 700 : 400, color: acesso.ultimo_em ? 'inherit' : 'text.secondary' }}>
            {textoUltimoAcesso(acesso.ultimo_em)}
          </Typography>
          {apps && (
            <Typography variant="caption" color="text.secondary">
              {apps}
            </Typography>
          )}
        </Box>
      </Box>
    </Tooltip>
  );
}

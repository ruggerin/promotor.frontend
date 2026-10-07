import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { Box, Tooltip, Typography } from '@mui/material';
import { formatarDataSemFuso } from '../lib/formatarData';
import { textoAppsAcesso, textoUltimoAcesso } from '../lib/acesso';
import type { AcessoUsuario } from '../types/api';
import { horus } from '../theme';

// Data e hora do último acesso ("07/10/2026 10:32"), em âmbar com aviso quando sumiu — docs/52
// §4.1. Sem horário gravado, cai no dia. O tooltip diz há quanto tempo, detalha por app e a
// frequência dos últimos 30 dias.

function dataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}
export function UltimoAcesso({ acesso }: { acesso: AcessoUsuario | undefined }) {
  if (!acesso) return <Typography variant="body2" color="text.secondary">—</Typography>;

  const apps = textoAppsAcesso(acesso.mobile_em, acesso.admin_em);
  const quando = (horario: string | null | undefined, dia: string | null) =>
    horario ? dataHora(horario) : dia ? formatarDataSemFuso(dia) : null;
  const principal = quando(acesso.ultimo_horario, acesso.ultimo_em);
  const detalhe = [
    textoUltimoAcesso(acesso.ultimo_em),
    acesso.mobile_em ? `App: ${quando(acesso.mobile_horario, acesso.mobile_em)}` : null,
    acesso.admin_em ? `Admin web: ${quando(acesso.admin_horario, acesso.admin_em)}` : null,
    `Usou em ${acesso.dias_ativos_30d} dos últimos 30 dias`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Tooltip title={acesso.ultimo_em ? detalhe : 'Nenhum uso registrado desde que a medição começou'}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: acesso.sumido ? horus.ambarEscuro : undefined }}>
        {acesso.sumido && <WarningAmberIcon sx={{ fontSize: 16 }} />}
        <Box>
          <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontWeight: acesso.sumido ? 700 : 400, color: acesso.ultimo_em ? 'inherit' : 'text.secondary' }}>
            {principal ?? textoUltimoAcesso(acesso.ultimo_em)}
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

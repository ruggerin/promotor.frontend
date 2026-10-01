import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { diasDesde, textoUltimoAcesso } from '../../lib/acesso';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import type { PlanoEmpresa } from '../../types/api';
import { EmpresaFormDialog } from './EmpresaFormDialog';

const PLANO_LABELS: Record<PlanoEmpresa, string> = {
  GRATUITO: 'Gratuito',
  START: 'Start',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

const PLANO_COLORS: Record<PlanoEmpresa, 'default' | 'primary' | 'secondary' | 'success'> = {
  GRATUITO: 'default',
  START: 'primary',
  PRO: 'secondary',
  BUSINESS: 'success',
};

// Última vez que alguém da empresa usou o sistema — âmbar passando de 7 dias (cliente sumindo,
// docs/52 §4.2).
function AtividadeEmpresa({ ultima }: { ultima: string | null }) {
  const parado = ultima !== null && diasDesde(ultima) > 7;
  return (
    <Typography
      variant="body2"
      sx={{ color: ultima === null ? 'text.secondary' : parado ? '#b45309' : undefined, fontWeight: parado ? 700 : 400, whiteSpace: 'nowrap' }}
    >
      {textoUltimoAcesso(ultima)}
    </Typography>
  );
}

// Ações (editar dados, bloquear/reativar) ficam todas na página de detalhe
// (EmpresaDetailPage) — a lista é só uma tabela pra escanear e clicar, ver
// docs/03-ADMIN-WEB.md#8-empresas-empresas-só-superadmin.
export function EmpresasListPage() {
  const navigate = useNavigate();
  const [dialogAberto, setDialogAberto] = useState(false);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
  });

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Empresas" />);

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogAberto(true)}>
          Nova empresa
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome fantasia</TableCell>
              <TableCell>Razão social</TableCell>
              <TableCell>CNPJ</TableCell>
              <TableCell>Plano</TableCell>
              <TableCell align="right">Limite usuários</TableCell>
              <TableCell align="right">Limite PDVs</TableCell>
              {/* Adesão da carteira (docs/52 §4.2): uso do sistema, não login. */}
              <TableCell>Última atividade</TableCell>
              <TableCell>Usaram (7 · 30 · 90 dias)</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {empresasQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {empresasQuery.isError && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {empresasQuery.data?.empresas.length === 0 && !empresasQuery.isError && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  Nenhuma empresa encontrada.
                </TableCell>
              </TableRow>
            )}
            {empresasQuery.data?.empresas.map((empresa) => (
              <TableRow
                key={empresa.id}
                hover
                tabIndex={0}
                role="button"
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/empresas/${empresa.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/empresas/${empresa.id}`);
                  }
                }}
              >
                <TableCell>{empresa.nome_fantasia}</TableCell>
                <TableCell>{empresa.razao_social}</TableCell>
                <TableCell>{empresa.cnpj}</TableCell>
                <TableCell>
                  <Chip label={PLANO_LABELS[empresa.plano]} color={PLANO_COLORS[empresa.plano]} size="small" />
                </TableCell>
                <TableCell align="right">{empresa.limite_usuarios ?? 'Sem limite'}</TableCell>
                <TableCell align="right">{empresa.limite_pontos_venda ?? 'Sem limite'}</TableCell>
                <TableCell>
                  <AtividadeEmpresa ultima={empresa.adesao?.ultima_atividade ?? null} />
                </TableCell>
                <TableCell>
                  {empresa.adesao ? (
                    <Tooltip
                      title={empresa.adesao.janelas
                        .map((j) => `${j.dias} dias: ${j.usuarios} usuário(s) — ${j.mobile} no app, ${j.admin} no admin web`)
                        .join(' · ')}
                    >
                      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {empresa.adesao.janelas.map((j) => j.usuarios).join(' · ')}
                        <Typography component="span" variant="caption" color="text.secondary">
                          {' '}
                          de {empresa.adesao.usuarios_ativos}
                        </Typography>
                      </Typography>
                    </Tooltip>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={empresa.ativo ? 'Ativa' : 'Bloqueada'}
                    color={empresa.ativo ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <EmpresaFormDialog open={dialogAberto} empresa={null} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

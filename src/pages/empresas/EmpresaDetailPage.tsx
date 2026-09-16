import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { atualizarEmpresaSuperadmin, bloquearEmpresaSuperadmin, buscarEmpresaSuperadmin } from '../../lib/api/empresas';
import { listarFaturas } from '../../lib/api/faturas';
import { formatarDataSemFuso } from '../../lib/formatarData';
import type { Empresa, Fatura, StatusFatura } from '../../types/api';
import { EmpresaFormDialog } from './EmpresaFormDialog';
import { FaturaFormDialog } from './FaturaFormDialog';

const STATUS_FATURA_LABELS: Record<StatusFatura, string> = {
  PENDENTE: 'Pendente',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
};

// "Atrasada" não é um status gravado — é PENDENTE + vencimento no passado, calculado aqui na
// exibição (ver docs/01-MODELO-DE-DADOS.md#9-faturas). Comparação de string YYYY-MM-DD, sem
// passar por Date/fuso.
function statusFaturaExibicao(fatura: Fatura): { label: string; color: 'warning' | 'success' | 'default' | 'error' } {
  const hoje = new Date().toISOString().slice(0, 10);
  if (fatura.status === 'PENDENTE' && fatura.vencimento < hoje) {
    return { label: 'Atrasada', color: 'error' };
  }

  const cores: Record<StatusFatura, 'warning' | 'success' | 'default'> = {
    PENDENTE: 'warning',
    PAGA: 'success',
    CANCELADA: 'default',
  };
  return { label: STATUS_FATURA_LABELS[fatura.status], color: cores[fatura.status] };
}

function UsoBloco({ titulo, usado, limite }: { titulo: string; usado: number; limite: number | null }) {
  const percentual = limite ? Math.min(100, (usado / limite) * 100) : 0;

  return (
    <Box>
      <Typography variant="caption" color="text.secondary">
        {titulo}
      </Typography>
      <Typography variant="h5">{limite !== null ? `${usado} / ${limite}` : `${usado} / sem limite`}</Typography>
      {limite !== null && (
        <LinearProgress
          variant="determinate"
          value={percentual}
          color={usado >= limite ? 'error' : 'primary'}
          sx={{ mt: 1, borderRadius: 1 }}
        />
      )}
    </Box>
  );
}

// Substitui o antigo fluxo "editar empresa" em modal — reúne aqui o que é importante da
// operação daquela empresa cliente (licenças, uso, faturas), ver
// docs/03-ADMIN-WEB.md#8-empresas-empresas-só-superadmin.
export function EmpresaDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogEmpresaAberto, setDialogEmpresaAberto] = useState(false);
  const [dialogFaturaAberto, setDialogFaturaAberto] = useState(false);
  const [faturaEmEdicao, setFaturaEmEdicao] = useState<Fatura | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const empresaQuery = useQuery({
    queryKey: ['empresas', publicId],
    queryFn: () => buscarEmpresaSuperadmin(publicId as string),
    enabled: Boolean(publicId),
  });

  // Hook sempre chamado, mesmo antes de saber se a empresa carregou — Rules of Hooks não
  // permite pular a chamada num render e chamar no outro.
  const cabecalho = usePageHeader(
    empresaQuery.data ? (
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        {empresaQuery.data.empresa.nome_fantasia}
      </Typography>
    ) : null,
  );

  const faturasQuery = useQuery({
    queryKey: ['faturas', publicId],
    queryFn: () => listarFaturas(publicId as string),
    enabled: Boolean(publicId),
  });

  const reativarMutation = useMutation({
    mutationFn: (empresa: Empresa) => atualizarEmpresaSuperadmin(empresa.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['empresas', publicId] });
    },
    onError: () => setErro('Não foi possível reativar a empresa.'),
  });

  const bloquearMutation = useMutation({
    mutationFn: (empresa: Empresa) => bloquearEmpresaSuperadmin(empresa.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['empresas', publicId] });
    },
    onError: () => setErro('Não foi possível bloquear a empresa.'),
  });

  function alternarStatus(empresa: Empresa) {
    if (empresa.ativo) {
      if (
        window.confirm(
          `Bloquear ${empresa.nome_fantasia}? Todas as sessões ativas dessa empresa são derrubadas na hora e ninguém consegue logar até reativar.`,
        )
      ) {
        bloquearMutation.mutate(empresa);
      }
      return;
    }

    reativarMutation.mutate(empresa);
  }

  if (empresaQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (empresaQuery.isError || !empresaQuery.data) {
    return <Typography color="error">Empresa não encontrada.</Typography>;
  }

  const { empresa, uso } = empresaQuery.data;
  const faturas = faturasQuery.data?.faturas ?? [];

  return (
    <Box>
      {cabecalho}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/empresas')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Chip label={empresa.ativo ? 'Ativa' : 'Bloqueada'} color={empresa.ativo ? 'success' : 'error'} size="small" />
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={() => setDialogEmpresaAberto(true)}>
          Editar dados
        </Button>
        <Button
          variant="outlined"
          color={empresa.ativo ? 'error' : 'success'}
          onClick={() => alternarStatus(empresa)}
        >
          {empresa.ativo ? 'Bloquear' : 'Reativar'}
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Licenças &amp; Limites
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <UsoBloco titulo="Licenças (promotores)" usado={uso.licencas_usadas} limite={uso.licencas_limite} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <UsoBloco titulo="Usuários" usado={uso.usuarios_total} limite={uso.usuarios_limite} />
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <UsoBloco titulo="Pontos de venda" usado={uso.pontos_venda_total} limite={uso.pontos_venda_limite} />
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Atividade
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Total de visitas
            </Typography>
            <Typography variant="h5">{uso.visitas_total}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Últimos 30 dias
            </Typography>
            <Typography variant="h5">{uso.visitas_ultimos_30_dias}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              PDVs visitados
            </Typography>
            <Typography variant="h5">{uso.pontos_venda_visitados}</Typography>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Última atividade
            </Typography>
            <Typography>
              {uso.ultima_atividade_em ? new Date(uso.ultima_atividade_em).toLocaleString('pt-BR') : 'Nunca'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Faturas</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setFaturaEmEdicao(null);
            setDialogFaturaAberto(true);
          }}
        >
          Nova fatura
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Referência</TableCell>
              <TableCell align="right">Valor</TableCell>
              <TableCell>Vencimento</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Pago em</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {faturas.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Nenhuma fatura lançada ainda.
                </TableCell>
              </TableRow>
            )}
            {faturas.map((fatura) => {
              const statusExibicao = statusFaturaExibicao(fatura);
              return (
                <TableRow
                  key={fatura.id}
                  hover
                  tabIndex={0}
                  role="button"
                  sx={{ cursor: 'pointer' }}
                  onClick={() => {
                    setFaturaEmEdicao(fatura);
                    setDialogFaturaAberto(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setFaturaEmEdicao(fatura);
                      setDialogFaturaAberto(true);
                    }
                  }}
                >
                  <TableCell>{formatarDataSemFuso(fatura.referencia)}</TableCell>
                  <TableCell align="right">
                    {fatura.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </TableCell>
                  <TableCell>{formatarDataSemFuso(fatura.vencimento)}</TableCell>
                  <TableCell>
                    <Chip label={statusExibicao.label} color={statusExibicao.color} size="small" />
                  </TableCell>
                  <TableCell>{fatura.pago_em ? formatarDataSemFuso(fatura.pago_em) : '—'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <EmpresaFormDialog open={dialogEmpresaAberto} empresa={empresa} onClose={() => setDialogEmpresaAberto(false)} />
      <FaturaFormDialog
        open={dialogFaturaAberto}
        empresaUuid={empresa.id}
        fatura={faturaEmEdicao}
        onClose={() => setDialogFaturaAberto(false)}
      />
    </Box>
  );
}

import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarAgendaVisita, desativarAgendaVisita, listarAgendasVisita } from '../../lib/api/agendasVisita';
import type { AgendaVisita, PrioridadeVisita } from '../../types/api';
import { AgendaVisitaFormDialog } from './AgendaVisitaFormDialog';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const PRIORIDADE_LABELS: Record<PrioridadeVisita, string> = { BAIXA: 'Baixa', MEDIA: 'Média', ALTA: 'Alta' };
const PRIORIDADE_CORES: Record<PrioridadeVisita, 'default' | 'warning' | 'error'> = {
  BAIXA: 'default',
  MEDIA: 'warning',
  ALTA: 'error',
};

function quandoExibicao(agenda: AgendaVisita): string {
  if (agenda.recorrencia === 'SEMANAL') {
    return `Toda ${DIAS_SEMANA[agenda.dia_semana ?? 0]}`;
  }
  return agenda.data ? new Date(`${agenda.data}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

export function AgendasVisitaListPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<AgendaVisita | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['agendas-visita', { page }],
    queryFn: () => listarAgendasVisita({ page: page + 1 }),
    placeholderData: keepPreviousData,
  });

  const reativarMutation = useMutation({
    mutationFn: (a: AgendaVisita) => atualizarAgendaVisita(a.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['agendas-visita'] });
    },
    onError: () => setErro('Não foi possível reativar a agenda.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (a: AgendaVisita) => desativarAgendaVisita(a.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['agendas-visita'] });
    },
    onError: () => setErro('Não foi possível desativar a agenda.'),
  });

  function alternarStatus(a: AgendaVisita) {
    if (a.ativo) {
      if (window.confirm(`Desativar a agenda de "${a.usuario.nome}" em "${a.ponto_venda?.fantasia}"?`)) {
        desativarMutation.mutate(a);
      }
      return;
    }
    reativarMutation.mutate(a);
  }

  const agendasVisita = query.data?.agendas_visita ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Agenda de Visita
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEmEdicao(null);
            setDialogAberto(true);
          }}
        >
          Nova agenda
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Rotina fixa do promotor num PDV — toda semana no mesmo dia, ou numa data específica. Todo
        dia de manhã, uma ordem de serviço é criada automaticamente pra cada agenda que bate com
        a data de hoje.
      </Typography>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ponto de venda</TableCell>
              <TableCell>Promotor</TableCell>
              <TableCell>Quando</TableCell>
              <TableCell>Horário</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Prioridade</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.isError && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {agendasVisita.length === 0 && !query.isLoading && !query.isError && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Nenhuma agenda de visita cadastrada.
                </TableCell>
              </TableRow>
            )}
            {agendasVisita.map((a) => (
              <TableRow key={a.id} hover>
                <TableCell>{a.ponto_venda?.fantasia ?? '—'}</TableCell>
                <TableCell>{a.usuario.nome}</TableCell>
                <TableCell>{quandoExibicao(a)}</TableCell>
                <TableCell>{a.horario_previsto ?? '—'}</TableCell>
                <TableCell>
                  {a.tipo_visita ? (
                    <Chip label={a.tipo_visita.descricao} size="small" sx={{ bgcolor: a.tipo_visita.cor, color: '#fff' }} />
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={PRIORIDADE_LABELS[a.prioridade]} color={PRIORIDADE_CORES[a.prioridade]} size="small" />
                </TableCell>
                <TableCell>
                  <Chip label={a.ativo ? 'Ativa' : 'Inativa'} color={a.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEmEdicao(a);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={a.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(a)}>
                      {a.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={query.data?.meta.total ?? 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={query.data?.meta.per_page ?? 15}
          rowsPerPageOptions={[query.data?.meta.per_page ?? 15]}
          onRowsPerPageChange={() => {
            // A API não aceita per_page customizado ainda — mesmo padrão do resto do admin.
          }}
        />
      </TableContainer>

      <AgendaVisitaFormDialog open={dialogAberto} agendaVisita={emEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Autocomplete,
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
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarAgendaVisita, desativarAgendaVisita, listarAgendasVisita } from '../../lib/api/agendasVisita';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarUsuarios } from '../../lib/api/usuarios';
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

  // Filtros — a API já filtra por loja, promotor, dia da semana e situação.
  const [loja, setLoja] = useState<{ id: string; fantasia: string } | null>(null);
  const [promotor, setPromotor] = useState<{ id: string; nome: string } | null>(null);
  const [diaSemana, setDiaSemana] = useState<number | ''>('');
  const [situacao, setSituacao] = useState<'todas' | 'ativas' | 'inativas'>('todas');
  const temFiltro = Boolean(loja || promotor || diaSemana !== '' || situacao !== 'todas');

  // Mudou filtro, volta pra primeira página (a atual pode nem existir no resultado novo).
  function filtrar(aplicar: () => void) {
    aplicar();
    setPage(0);
  }

  const lojasQuery = useQuery({
    queryKey: ['pontos-venda', 'filtro-agenda'],
    queryFn: () => listarPontosVenda({ ativo: true, por_pagina: 200 }),
  });
  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores-filtro-agenda'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', por_pagina: 200 }),
  });

  const filtros = {
    ponto_venda_uuid: loja?.id,
    usuario_uuid: promotor?.id,
    dia_semana: diaSemana === '' ? undefined : diaSemana,
    ativo: situacao === 'todas' ? undefined : situacao === 'ativas',
  };

  const query = useQuery({
    queryKey: ['agendas-visita', { page, ...filtros }],
    queryFn: () => listarAgendasVisita({ page: page + 1, ...filtros }),
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

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Agenda de Visita" />);

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
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

      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <Autocomplete
          size="small"
          sx={{ width: 240 }}
          options={lojasQuery.data?.pontos_venda ?? []}
          getOptionLabel={(l) => l.fantasia}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={lojasQuery.isLoading}
          value={loja}
          onChange={(_, l) => filtrar(() => setLoja(l ? { id: l.id, fantasia: l.fantasia } : null))}
          renderInput={(params) => <TextField {...params} label="Loja" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 220 }}
          options={promotoresQuery.data?.usuarios ?? []}
          getOptionLabel={(u) => u.nome}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={promotoresQuery.isLoading}
          value={promotor}
          onChange={(_, u) => filtrar(() => setPromotor(u ? { id: u.id, nome: u.nome } : null))}
          renderInput={(params) => <TextField {...params} label="Promotor" />}
        />
        <TextField
          select
          size="small"
          label="Dia da semana"
          value={diaSemana}
          onChange={(e) => filtrar(() => setDiaSemana(e.target.value === '' ? '' : Number(e.target.value)))}
          sx={{ width: 170 }}
        >
          <MenuItem value="">Todos</MenuItem>
          {DIAS_SEMANA.map((dia, i) => (
            <MenuItem key={dia} value={i}>
              {dia}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Situação"
          value={situacao}
          onChange={(e) => filtrar(() => setSituacao(e.target.value as typeof situacao))}
          sx={{ width: 150 }}
        >
          <MenuItem value="todas">Todas</MenuItem>
          <MenuItem value="ativas">Ativas</MenuItem>
          <MenuItem value="inativas">Inativas</MenuItem>
        </TextField>
        {temFiltro && (
          <Button
            size="small"
            onClick={() =>
              filtrar(() => {
                setLoja(null);
                setPromotor(null);
                setDiaSemana('');
                setSituacao('todas');
              })
            }
          >
            Limpar filtros
          </Button>
        )}
      </Box>

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
                  {temFiltro ? 'Nenhuma agenda com esses filtros.' : 'Nenhuma agenda de visita cadastrada.'}
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

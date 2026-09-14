import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { aprovarOrdemServico, atualizarOrdemServico, listarOrdensServico, rejeitarOrdemServico } from '../../lib/api/ordensServico';
import type { OrdemServico, OrigemOrdemServico, StatusOrdemServico } from '../../types/api';
import { OrdemServicoFormDialog } from './OrdemServicoFormDialog';

type ChipColor = 'warning' | 'info' | 'success' | 'default' | 'error';
type FiltroStatus = StatusOrdemServico | 'todos' | 'solicitacoes';

// Painel de aprovação (docs/13-AGENDA-MOBILE-E-AUTONOMIA.md §6.2) — os três status que só
// existem quando a empresa exige aprovação pra ações do promotor sobre a própria agenda.
const STATUS_SOLICITACAO: StatusOrdemServico[] = ['AGUARDANDO_APROVACAO', 'REAGENDAMENTO_SOLICITADO', 'CANCELAMENTO_SOLICITADO'];

const STATUS_LABELS: Record<StatusOrdemServico, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
  AGUARDANDO_APROVACAO: 'Aguardando aprovação',
  REAGENDAMENTO_SOLICITADO: 'Reagendamento solicitado',
  CANCELAMENTO_SOLICITADO: 'Cancelamento solicitado',
};

// De onde a OS veio — CONTRATO é gerada automaticamente por um comodato/ponto extra vencendo
// (ver docs/09-CONTRATO-METAS.md), sem tela própria de origem; mostrar isso aqui é o único jeito
// do gestor saber por que ela existe.
const ORIGEM_LABELS: Record<OrigemOrdemServico, string> = {
  MANUAL: 'Manual',
  CAMPANHA: 'Campanha',
  AGENDA: 'Agenda',
  CONTRATO: 'Contrato',
};

const STATUS_CORES: Record<StatusOrdemServico, ChipColor> = {
  PENDENTE: 'warning',
  EM_ANDAMENTO: 'info',
  CONCLUIDA: 'success',
  CANCELADA: 'default',
  AGUARDANDO_APROVACAO: 'warning',
  REAGENDAMENTO_SOLICITADO: 'warning',
  CANCELAMENTO_SOLICITADO: 'warning',
};

// "Expirada" não é um status gravado — é PENDENTE + prazo_fim no passado, calculado aqui na
// exibição, mesmo espírito de Fatura ("Atrasada") e Contrato ("Vencido"). Ver
// docs/07-ORDEM-DE-SERVICO.md.
function statusExibicao(os: OrdemServico): { label: string; color: ChipColor } {
  if (os.status === 'PENDENTE' && os.prazo_fim < new Date().toISOString()) {
    return { label: 'Expirada', color: 'error' };
  }
  return { label: STATUS_LABELS[os.status], color: STATUS_CORES[os.status] };
}

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function OrdensServicoListPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(0);
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('todos');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<OrdemServico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [rejeitando, setRejeitando] = useState<OrdemServico | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  const query = useQuery({
    queryKey: ['ordens-servico', { page, filtroStatus }],
    queryFn: () =>
      listarOrdensServico({
        page: page + 1,
        status: filtroStatus === 'todos' ? undefined : filtroStatus === 'solicitacoes' ? STATUS_SOLICITACAO : filtroStatus,
      }),
    placeholderData: keepPreviousData,
  });

  const cancelarMutation = useMutation({
    mutationFn: (os: OrdemServico) => atualizarOrdemServico(os.id, { status: 'CANCELADA' }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
    },
    onError: () => setErro('Não foi possível cancelar a ordem de serviço.'),
  });

  const aprovarMutation = useMutation({
    mutationFn: (os: OrdemServico) => aprovarOrdemServico(os.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
    },
    onError: () => setErro('Não foi possível aprovar a solicitação.'),
  });

  const rejeitarMutation = useMutation({
    mutationFn: ({ os, motivo }: { os: OrdemServico; motivo: string }) => rejeitarOrdemServico(os.id, motivo),
    onSuccess: () => {
      setErro(null);
      setRejeitando(null);
      setMotivoRejeicao('');
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
    },
    onError: () => setErro('Não foi possível rejeitar a solicitação.'),
  });

  function cancelar(os: OrdemServico) {
    if (window.confirm(`Cancelar a ordem de serviço de "${os.ponto_venda?.fantasia}"?`)) {
      cancelarMutation.mutate(os);
    }
  }

  const ordensServico = query.data?.ordens_servico ?? [];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Ordens de Serviço
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEmEdicao(null);
            setDialogAberto(true);
          }}
        >
          Nova ordem de serviço
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compromisso de visita que você direciona a um promotor (ou deixa em fila aberta), com
        prazo — aparece pro promotor direcionar o trabalho dele no app. Inclui os compromissos
        que o próprio promotor cria/reagenda/cancela pela agenda dele.
      </Typography>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          label="Status"
          size="small"
          sx={{ width: 260 }}
          value={filtroStatus}
          onChange={(e) => {
            setPage(0);
            setFiltroStatus(e.target.value as FiltroStatus);
          }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="solicitacoes">Solicitações pendentes (aprovação)</MenuItem>
          <MenuItem value="PENDENTE">Pendente</MenuItem>
          <MenuItem value="EM_ANDAMENTO">Em andamento</MenuItem>
          <MenuItem value="CONCLUIDA">Concluída</MenuItem>
          <MenuItem value="CANCELADA">Cancelada</MenuItem>
          <MenuItem value="AGUARDANDO_APROVACAO">Aguardando aprovação (criação)</MenuItem>
          <MenuItem value="REAGENDAMENTO_SOLICITADO">Reagendamento solicitado</MenuItem>
          <MenuItem value="CANCELAMENTO_SOLICITADO">Cancelamento solicitado</MenuItem>
        </TextField>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ponto de venda</TableCell>
              <TableCell>Promotor</TableCell>
              <TableCell>Origem</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Prazo</TableCell>
              <TableCell>Obrigatória</TableCell>
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
            {ordensServico.length === 0 && !query.isLoading && !query.isError && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  Nenhuma ordem de serviço encontrada.
                </TableCell>
              </TableRow>
            )}
            {ordensServico.map((os) => {
              const status = statusExibicao(os);
              const podeEditarOuCancelar = os.status === 'PENDENTE';
              const temSolicitacao = STATUS_SOLICITACAO.includes(os.status);
              return (
                <TableRow key={os.id} hover>
                  <TableCell>{os.ponto_venda?.fantasia ?? '—'}</TableCell>
                  <TableCell>{os.usuario?.nome ?? 'Fila aberta'}</TableCell>
                  <TableCell>
                    {ORIGEM_LABELS[os.origem]}
                    {os.origem === 'CONTRATO' && os.contrato && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {os.contrato.tipo === 'COMODATO' ? 'Comodato' : 'Ponto extra'}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {os.tipo_visita ? (
                      <Chip
                        label={os.tipo_visita.descricao}
                        size="small"
                        sx={{ bgcolor: os.tipo_visita.cor, color: '#fff' }}
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {formatarDataHora(os.prazo_inicio)} – {formatarDataHora(os.prazo_fim)}
                    {os.status === 'REAGENDAMENTO_SOLICITADO' && os.prazo_inicio_proposto && os.prazo_fim_proposto && (
                      <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
                        Proposto: {formatarDataHora(os.prazo_inicio_proposto)} – {formatarDataHora(os.prazo_fim_proposto)}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{os.obrigatoria ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>
                    <Chip label={status.label} color={status.color} size="small" />
                    {os.status === 'PENDENTE' && !!os.motivo_rejeicao && (
                      <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                        Rejeitado: {os.motivo_rejeicao}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {temSolicitacao ? (
                      <>
                        <Tooltip title="Aprovar">
                          <IconButton size="small" color="success" onClick={() => aprovarMutation.mutate(os)}>
                            <CheckIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rejeitar">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setRejeitando(os);
                              setMotivoRejeicao('');
                            }}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip title="Editar">
                          <IconButton
                            size="small"
                            onClick={() => {
                              setEmEdicao(os);
                              setDialogAberto(true);
                            }}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {podeEditarOuCancelar && (
                          <Tooltip title="Cancelar">
                            <IconButton size="small" onClick={() => cancelar(os)}>
                              <BlockIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <OrdemServicoFormDialog open={dialogAberto} ordemServico={emEdicao} onClose={() => setDialogAberto(false)} />

      <Dialog open={!!rejeitando} onClose={() => setRejeitando(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Rejeitar solicitação</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            O promotor vê esse motivo na própria agenda — ajuda ele a entender por que foi
            recusado. Opcional.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            multiline
            minRows={2}
            label="Motivo (opcional)"
            value={motivoRejeicao}
            onChange={(e) => setMotivoRejeicao(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setRejeitando(null)}>Cancelar</Button>
          <Button
            variant="contained"
            color="error"
            disabled={rejeitarMutation.isPending}
            onClick={() => rejeitando && rejeitarMutation.mutate({ os: rejeitando, motivo: motivoRejeicao })}
          >
            Rejeitar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

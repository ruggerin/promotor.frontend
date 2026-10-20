import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
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
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RegistroDetalheDialog } from '../../components/registros/RegistroDetalheDialog';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { buscarVisita } from '../../lib/api/visitas';
import { avaliarRegistro, listarAvaliacoes } from '../../lib/api/xp';
import type { RegistroParaAvaliar, StatusAvaliacao } from '../../types/api';

const idade = (dias: number | null) => (dias === null ? '—' : dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`);

/**
 * Avaliação de formulário pelo gestor (doc 33, mínimo da régua de XP — docs/88 §10). O gestor
 * olha a evidência (fotos e valores, na visita) e aprova ou reprova. Com a régua ligada, o XP de
 * iniciativa e a parte de qualidade daquele formulário só contam depois de aprovados.
 * Clicar na linha abre só o registro (como no painel Registros); a visita inteira é atalho.
 */
export function AvaliacoesFormularioPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusAvaliacao>('PENDENTE');
  const [page, setPage] = useState(0);
  const [reprovando, setReprovando] = useState<RegistroParaAvaliar | null>(null);
  const [aberto, setAberto] = useState<RegistroParaAvaliar | null>(null);
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Avaliação de formulários" />);

  const query = useQuery({
    queryKey: ['avaliacoes-formulario', status, page],
    queryFn: () => listarAvaliacoes(status, page + 1),
    placeholderData: keepPreviousData,
  });

  const aprovar = useMutation({
    mutationFn: (r: RegistroParaAvaliar) => avaliarRegistro(r.visita_id!, r.id, 'APROVADO'),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['avaliacoes-formulario'] });
      setAberto(null);
    },
  });

  const registros = query.data?.registros ?? [];

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
        Formulários marcados com "Exige avaliação". Clique na linha para conferir fotos e respostas. Reprovado não gera XP e o promotor
        vê o motivo; dá para rever a decisão depois.
      </Typography>
      <Tabs
        value={status}
        onChange={(_, v) => {
          setStatus(v);
          setPage(0);
        }}
        sx={{ mb: 2 }}
      >
        <Tab value="PENDENTE" label="Aguardando" />
        <Tab value="APROVADO" label="Aprovados" />
        <Tab value="REPROVADO" label="Reprovados" />
      </Tabs>
      {(aprovar.error) && <Alert severity="error" sx={{ mb: 2 }}>Não foi possível salvar a avaliação.</Alert>}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Formulário</TableCell>
              <TableCell>Loja</TableCell>
              <TableCell>Promotor</TableCell>
              <TableCell>{status === 'PENDENTE' ? 'Aguardando' : 'Avaliado'}</TableCell>
              <TableCell align="right">XP</TableCell>
              <TableCell align="right">Fotos</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && registros.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  {status === 'PENDENTE' ? 'Nada aguardando avaliação.' : 'Nenhum registro.'}
                </TableCell>
              </TableRow>
            )}
            {registros.map((r) => (
              <TableRow key={r.id} hover sx={{ cursor: r.visita_id ? 'pointer' : undefined }} onClick={() => r.visita_id && setAberto(r)}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {r.formulario?.descricao ?? '—'}
                  </Typography>
                  {r.produto && (
                    <Typography variant="caption" color="text.secondary">
                      {r.produto}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>{r.loja?.fantasia ?? '—'}</TableCell>
                <TableCell>{r.promotor?.nome ?? '—'}</TableCell>
                <TableCell>
                  {status === 'PENDENTE' ? (
                    <Chip size="small" label={idade(r.idade_dias)} color={(r.idade_dias ?? 0) >= 3 ? 'warning' : 'default'} variant="outlined" />
                  ) : (
                    <Box>
                      <Typography variant="caption">{r.avaliacao.por ?? '—'}</Typography>
                      {r.avaliacao.motivo && (
                        <Typography variant="caption" color="text.secondary" component="div">
                          {r.avaliacao.motivo}
                        </Typography>
                      )}
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right">{r.xp > 0 ? `+${r.xp}` : '—'}</TableCell>
                <TableCell align="right">{r.fotos}</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                  {r.visita_id && (
                    <Button size="small" onClick={() => setAberto(r)} sx={{ textTransform: 'none' }}>
                      Ver registro
                    </Button>
                  )}
                  {status !== 'APROVADO' && (
                    <Button size="small" color="success" startIcon={<CheckIcon />} disabled={aprovar.isPending} onClick={() => aprovar.mutate(r)}>
                      Aprovar
                    </Button>
                  )}
                  {status !== 'REPROVADO' && (
                    <Button size="small" color="error" startIcon={<CloseIcon />} onClick={() => setReprovando(r)}>
                      Reprovar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={query.data?.meta.total ?? 0}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={query.data?.meta.per_page ?? 25}
          rowsPerPageOptions={[query.data?.meta.per_page ?? 25]}
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count}`}
        />
      </TableContainer>
      {aberto && (
        <RegistroParaAvaliarDialog
          item={aberto}
          status={status}
          aprovando={aprovar.isPending}
          onFechar={() => setAberto(null)}
          onAprovar={() => aprovar.mutate(aberto)}
          onReprovar={() => {
            setReprovando(aberto);
            setAberto(null);
          }}
        />
      )}
      {reprovando && <ReprovarDialog registro={reprovando} onFechar={() => setReprovando(null)} />}
    </Box>
  );
}

// Carrega o registro completo (fotos, respostas, conversa) pela visita de origem e mostra só ele,
// com a decisão no rodapé — mesmo diálogo do painel Registros.
function RegistroParaAvaliarDialog({
  item,
  status,
  aprovando,
  onFechar,
  onAprovar,
  onReprovar,
}: {
  item: RegistroParaAvaliar;
  status: StatusAvaliacao;
  aprovando: boolean;
  onFechar: () => void;
  onAprovar: () => void;
  onReprovar: () => void;
}) {
  const navigate = useNavigate();
  const visitaQuery = useQuery({ queryKey: ['visita', item.visita_id], queryFn: () => buscarVisita(item.visita_id!) });
  const registro = (visitaQuery.data?.visita.registros ?? []).find((r) => r.id === item.id) ?? null;
  const verVisita = () => navigate(`/visitas/${item.visita_id}`);

  if (registro) {
    return (
      <RegistroDetalheDialog
        registro={registro}
        visitaUuid={item.visita_id!}
        onClose={onFechar}
        acoes={
          <>
            <Button onClick={verVisita} sx={{ textTransform: 'none', mr: 'auto' }}>
              Ver visita completa
            </Button>
            {status !== 'REPROVADO' && (
              <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={onReprovar} sx={{ textTransform: 'none' }}>
                Reprovar
              </Button>
            )}
            {status !== 'APROVADO' && (
              <Button variant="contained" color="success" startIcon={<CheckIcon />} disabled={aprovando} onClick={onAprovar} sx={{ textTransform: 'none' }}>
                Aprovar{item.xp > 0 ? ` (+${item.xp} XP)` : ''}
              </Button>
            )}
          </>
        }
      />
    );
  }

  // Carregando, ou o registro não veio na visita (cancelado/removido): nunca fica preso.
  return (
    <Dialog open onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', py: 4 }}>
        {visitaQuery.isLoading ? (
          <CircularProgress size={28} />
        ) : (
          <>
            <Alert severity="warning" sx={{ width: '100%' }}>
              Não foi possível abrir o detalhe deste registro.
            </Alert>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button onClick={onFechar}>Fechar</Button>
              <Button variant="contained" onClick={verVisita}>
                Ver visita
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReprovarDialog({ registro, onFechar }: { registro: RegistroParaAvaliar; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');
  const reprovar = useMutation({
    mutationFn: () => avaliarRegistro(registro.visita_id!, registro.id, 'REPROVADO', motivo.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['avaliacoes-formulario'] });
      onFechar();
    },
  });

  return (
    <Dialog open onClose={onFechar} fullWidth maxWidth="sm">
      <DialogTitle>Reprovar · {registro.formulario?.descricao}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {reprovar.error && <Alert severity="error" sx={{ mb: 2 }}>Não foi possível reprovar.</Alert>}
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={3}
          label="Motivo"
          required
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          helperText="O promotor vê este motivo. Ex.: a foto não mostra o ponto extra."
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button color="error" variant="contained" disabled={!motivo.trim() || reprovar.isPending} onClick={() => reprovar.mutate()}>
          Reprovar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
  Link,
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
import { Link as RouterLink } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { avaliarRegistro, listarAvaliacoes } from '../../lib/api/xp';
import type { RegistroParaAvaliar, StatusAvaliacao } from '../../types/api';

const idade = (dias: number | null) => (dias === null ? '—' : dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`);

/**
 * Avaliação de formulário pelo gestor (doc 33, mínimo da régua de XP — docs/88 §10). O gestor
 * olha a evidência (fotos e valores, na visita) e aprova ou reprova. Com a régua ligada, o XP de
 * iniciativa e a parte de qualidade daquele formulário só contam depois de aprovados.
 */
export function AvaliacoesFormularioPage() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<StatusAvaliacao>('PENDENTE');
  const [page, setPage] = useState(0);
  const [reprovando, setReprovando] = useState<RegistroParaAvaliar | null>(null);
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Avaliação de formulários" />);

  const query = useQuery({
    queryKey: ['avaliacoes-formulario', status, page],
    queryFn: () => listarAvaliacoes(status, page + 1),
    placeholderData: keepPreviousData,
  });

  const aprovar = useMutation({
    mutationFn: (r: RegistroParaAvaliar) => avaliarRegistro(r.visita_id!, r.id, 'APROVADO'),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['avaliacoes-formulario'] }),
  });

  const registros = query.data?.registros ?? [];

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
        Formulários marcados com "Exige avaliação". Abra a visita para conferir fotos e respostas. Reprovado não gera XP e o promotor
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
              <TableRow key={r.id} hover>
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
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {r.visita_id && (
                    <Link component={RouterLink} to={`/visitas/${r.visita_id}`} sx={{ mr: 1 }} variant="body2">
                      Ver visita
                    </Link>
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
      {reprovando && <ReprovarDialog registro={reprovando} onFechar={() => setReprovando(null)} />}
    </Box>
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

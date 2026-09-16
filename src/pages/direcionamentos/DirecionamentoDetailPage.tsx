import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
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
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { atualizarDirecionamento, buscarDirecionamento } from '../../lib/api/direcionamentos';
import { DirecionamentoFormDialog } from './DirecionamentoFormDialog';

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function DirecionamentoDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['direcionamentos', publicId],
    queryFn: () => buscarDirecionamento(publicId!),
    enabled: !!publicId,
  });

  const cancelarMutation = useMutation({
    mutationFn: () => atualizarDirecionamento(publicId!, { ativo: false }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['direcionamentos', publicId] });
    },
    onError: () => setErro('Não foi possível cancelar o direcionamento.'),
  });

  const direcionamento = query.data?.direcionamento;

  const cabecalho = usePageHeader(
    <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
      {direcionamento?.descricao ?? 'Direcionamento'}
    </Typography>,
  );

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!direcionamento) {
    return <Typography color="error">Direcionamento não encontrado.</Typography>;
  }

  const progresso = query.data!.progresso;

  function confirmarCancelamento() {
    if (
      window.confirm(
        'Cancelar este direcionamento? Toda Ordem de Serviço gerada por ele que ainda estiver pendente (promotor não começou) será cancelada junto. As que já estão em andamento ou concluídas continuam intocadas.',
      )
    ) {
      cancelarMutation.mutate();
    }
  }

  return (
    <Box>
      {cabecalho}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/direcionamentos')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
        <Chip label={direcionamento.ativo ? 'Ativo' : 'Cancelado'} color={direcionamento.ativo ? 'success' : 'default'} size="small" />
        <Box sx={{ flexGrow: 1 }} />
        {direcionamento.ativo && (
          <>
            <Button variant="outlined" startIcon={<EditIcon />} onClick={() => setDialogAberto(true)}>
              Editar
            </Button>
            <Button variant="outlined" color="error" disabled={cancelarMutation.isPending} onClick={confirmarCancelamento}>
              {cancelarMutation.isPending ? 'Cancelando...' : 'Cancelar direcionamento'}
            </Button>
          </>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vigência: {formatarDataHora(direcionamento.vigencia_inicio)} até {formatarDataHora(direcionamento.vigencia_fim)}
      </Typography>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ mb: 1 }}>
          Filtros
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {direcionamento.filtros.pontos_venda.length === 0 &&
          direcionamento.filtros.redes_loja.length === 0 &&
          direcionamento.filtros.promotores.length === 0
            ? 'Sem filtro — vale pra empresa inteira.'
            : null}
        </Typography>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mt: 1 }}>
          {direcionamento.filtros.pontos_venda.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Pontos de venda
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {direcionamento.filtros.pontos_venda.map((p) => (
                  <Chip key={p.id} label={p.fantasia} size="small" />
                ))}
              </Box>
            </Box>
          )}
          {direcionamento.filtros.redes_loja.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Redes de loja
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {direcionamento.filtros.redes_loja.map((r) => (
                  <Chip key={r.id} label={r.descricao} size="small" />
                ))}
              </Box>
            </Box>
          )}
          {direcionamento.filtros.promotores.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary">
                Promotores
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {direcionamento.filtros.promotores.map((u) => (
                  <Chip key={u.id} label={u.nome} size="small" />
                ))}
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4">{progresso.ordens_geradas}</Typography>
          <Typography variant="caption" color="text.secondary">
            Ordens geradas
          </Typography>
        </Box>
        <Box>
          <Typography variant="h4" color="success.main">
            {progresso.ordens_concluidas}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Concluídas
          </Typography>
        </Box>
        <Box>
          <Typography variant="h4" color="warning.main">
            {progresso.ordens_pendentes}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Pendentes
          </Typography>
        </Box>
      </Paper>

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        Formulários exigidos
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Formulário</TableCell>
              <TableCell>Obrigatório</TableCell>
              <TableCell>Calcula compliance</TableCell>
              <TableCell>Expedidos</TableCell>
              <TableCell>Preenchidos</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {direcionamento.formularios.map((f) => {
              const linhaProgresso = progresso.por_formulario.find((p) => p.tipo_registro_id === f.tipo_registro.id);
              return (
                <TableRow key={f.tipo_registro.id} hover>
                  <TableCell>{f.tipo_registro.descricao}</TableCell>
                  <TableCell>{f.obrigatorio ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>{f.calcula_percentual_compliance ? 'Sim' : 'Não'}</TableCell>
                  <TableCell>{linhaProgresso?.expedidos ?? 0}</TableCell>
                  <TableCell>{linhaProgresso?.preenchidos ?? 0}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      <DirecionamentoFormDialog open={dialogAberto} direcionamento={direcionamento} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

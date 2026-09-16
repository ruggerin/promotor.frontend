import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
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
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarTipoVisita, desativarTipoVisita, listarTiposVisita } from '../../lib/api/tiposVisita';
import type { TipoVisita } from '../../types/api';
import { TipoVisitaFormDialog } from './TipoVisitaFormDialog';

export function TiposVisitaListPage() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<TipoVisita | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['tipos-visita'],
    queryFn: () => listarTiposVisita(),
  });

  const reativarMutation = useMutation({
    mutationFn: (t: TipoVisita) => atualizarTipoVisita(t.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-visita'] });
    },
    onError: () => setErro('Não foi possível reativar o tipo de visita.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (t: TipoVisita) => desativarTipoVisita(t.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-visita'] });
    },
    onError: () => setErro('Não foi possível desativar o tipo de visita.'),
  });

  function alternarStatus(t: TipoVisita) {
    if (t.ativo) {
      if (window.confirm(`Desativar "${t.descricao}"? Ordens de serviço já criadas com este tipo continuam intactas.`)) {
        desativarMutation.mutate(t);
      }
      return;
    }
    reativarMutation.mutate(t);
  }

  const tiposVisita = query.data?.tipos_visita ?? [];

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Tipos de Visita
    </Typography>,
  );

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
          Novo tipo de visita
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Tag colorida pra classificar uma ordem de serviço — manual ou gerada pela agenda de
        visita — e identificar rápido na listagem e no app do promotor.
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
              <TableCell>Tipo</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.isError && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {tiposVisita.length === 0 && !query.isLoading && !query.isError && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Nenhum tipo de visita cadastrado.
                </TableCell>
              </TableRow>
            )}
            {tiposVisita.map((t) => (
              <TableRow key={t.id} hover>
                <TableCell>
                  <Chip label={t.descricao} size="small" sx={{ bgcolor: t.cor, color: '#fff', fontWeight: 600 }} />
                </TableCell>
                <TableCell>
                  <Chip label={t.ativo ? 'Ativo' : 'Inativo'} color={t.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEmEdicao(t);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(t)}>
                      {t.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <TipoVisitaFormDialog open={dialogAberto} tipoVisita={emEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

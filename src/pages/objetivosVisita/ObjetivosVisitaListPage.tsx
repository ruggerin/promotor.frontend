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
import { atualizarObjetivoVisita, desativarObjetivoVisita, listarObjetivosVisita } from '../../lib/api/objetivosVisita';
import type { ObjetivoVisita } from '../../types/api';
import { ObjetivoVisitaFormDialog } from './ObjetivoVisitaFormDialog';

export function ObjetivosVisitaListPage() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ObjetivoVisita | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['objetivos-visita'],
    queryFn: () => listarObjetivosVisita(),
  });

  const reativarMutation = useMutation({
    mutationFn: (o: ObjetivoVisita) => atualizarObjetivoVisita(o.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['objetivos-visita'] });
    },
    onError: () => setErro('Não foi possível reativar o objetivo de visita.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (o: ObjetivoVisita) => desativarObjetivoVisita(o.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['objetivos-visita'] });
    },
    onError: () => setErro('Não foi possível desativar o objetivo de visita.'),
  });

  function alternarStatus(o: ObjetivoVisita) {
    if (o.ativo) {
      if (window.confirm(`Desativar "${o.descricao}"? Ordens de serviço já criadas com esse objetivo continuam intactas.`)) {
        desativarMutation.mutate(o);
      }
      return;
    }
    reativarMutation.mutate(o);
  }

  const objetivosVisita = query.data?.objetivos_visita ?? [];

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Objetivos de Visita
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
          Novo objetivo de visita
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Motivo de negócio de um compromisso — manual ou auto-agendado pelo promotor — ex.
        "Reposição", "Negociação", "Retomada de volume". Diferente do tipo de visita (a tag
        colorida): objetivo é o motivo específico daquele compromisso, não a classificação geral.
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
              <TableCell>Objetivo</TableCell>
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
            {objetivosVisita.length === 0 && !query.isLoading && !query.isError && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Nenhum objetivo de visita cadastrado.
                </TableCell>
              </TableRow>
            )}
            {objetivosVisita.map((o) => (
              <TableRow key={o.id} hover>
                <TableCell>{o.descricao}</TableCell>
                <TableCell>
                  <Chip label={o.ativo ? 'Ativo' : 'Inativo'} color={o.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEmEdicao(o);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={o.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(o)}>
                      {o.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ObjetivoVisitaFormDialog open={dialogAberto} objetivoVisita={emEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

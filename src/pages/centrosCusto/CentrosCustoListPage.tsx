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
import { atualizarCentroCusto, desativarCentroCusto, listarCentrosCusto } from '../../lib/api/centrosCusto';
import type { CentroCusto } from '../../types/api';
import { CentroCustoFormDialog } from './CentroCustoFormDialog';

function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function CentrosCustoListPage() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<CentroCusto | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['centros-custo'],
    queryFn: () => listarCentrosCusto(),
  });

  const reativarMutation = useMutation({
    mutationFn: (c: CentroCusto) => atualizarCentroCusto(c.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
    },
    onError: () => setErro('Não foi possível reativar o centro de custo.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (c: CentroCusto) => desativarCentroCusto(c.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
    },
    onError: () => setErro('Não foi possível desativar o centro de custo.'),
  });

  function alternarStatus(c: CentroCusto) {
    if (c.ativo) {
      if (
        window.confirm(
          `Desativar "${c.descricao}"? Promotores já vinculados continuam com o histórico intacto, só não vai mais aparecer pra um vínculo novo.`,
        )
      ) {
        desativarMutation.mutate(c);
      }
      return;
    }
    reativarMutation.mutate(c);
  }

  const centrosCusto = query.data?.centros_custo ?? [];

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Centros de Custo
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
          Novo centro de custo
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Perfil de custo reutilizável atribuível a um ou mais promotores (na tela de Usuários) —
        não é o holerite de uma pessoa específica. O custo/hora é sempre recalculado, nunca
        fica desatualizado.
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
              <TableCell>Descrição</TableCell>
              <TableCell>Carga horária/semana</TableCell>
              <TableCell>Promotores vinculados</TableCell>
              <TableCell>Custo/hora</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.isError && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {centrosCusto.length === 0 && !query.isLoading && !query.isError && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhum centro de custo cadastrado.
                </TableCell>
              </TableRow>
            )}
            {centrosCusto.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.descricao}</TableCell>
                <TableCell>{c.carga_horaria_semanal}h</TableCell>
                <TableCell>{c.resumo.qtd_promotores_ativos}</TableCell>
                <TableCell>{formatarReais(c.resumo.custo_por_hora)}</TableCell>
                <TableCell>
                  <Chip label={c.ativo ? 'Ativo' : 'Inativo'} color={c.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEmEdicao(c);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={c.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(c)}>
                      {c.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CentroCustoFormDialog open={dialogAberto} centroCusto={emEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

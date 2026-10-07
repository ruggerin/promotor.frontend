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
  TableRow,
  Tooltip,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { atualizarMotivoNaoExecucao, desativarMotivoNaoExecucao, listarMotivosNaoExecucao } from '../../lib/api/motivosNaoExecucao';
import type { MotivoNaoExecucao } from '../../types/api';
import { MotivoNaoExecucaoFormDialog } from './MotivoNaoExecucaoFormDialog';

/**
 * Catálogo de motivos pra cancelar visita planejada que não aconteceu (docs/59) — usado no
 * diálogo de cancelamento da tela "Visitas não realizadas" e da lista de Ordens de Serviço. Mesmo molde de Ramos de Atividade.
 */
export function MotivosNaoExecucaoListPage() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<MotivoNaoExecucao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['motivos-nao-execucao'], queryFn: () => listarMotivosNaoExecucao() });

  const reativarMutation = useMutation({
    mutationFn: (m: MotivoNaoExecucao) => atualizarMotivoNaoExecucao(m.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['motivos-nao-execucao'] });
    },
    onError: () => setErro('Não foi possível reativar o motivo.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (m: MotivoNaoExecucao) => desativarMotivoNaoExecucao(m.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['motivos-nao-execucao'] });
    },
    onError: () => setErro('Não foi possível desativar o motivo.'),
  });

  function alternarStatus(m: MotivoNaoExecucao) {
    if (m.ativo) {
      if (window.confirm(`Desativar "${m.descricao}"?`)) {
        desativarMutation.mutate(m);
      }
      return;
    }
    reativarMutation.mutate(m);
  }

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Motivos de Não Execução" />);

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
          Novo motivo
        </Button>
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
              <TableCell>Descrição</TableCell>
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
            {query.data?.motivos_nao_execucao.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Nenhum motivo cadastrado ainda — quem cancelar uma visita vai cair direto em "Outro" até você cadastrar algum.
                </TableCell>
              </TableRow>
            )}
            {query.data?.motivos_nao_execucao.map((m) => (
              <TableRow key={m.id} hover>
                <TableCell>{m.descricao}</TableCell>
                <TableCell>
                  <Chip label={m.ativo ? 'Ativo' : 'Inativo'} color={m.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setEmEdicao(m);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={m.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(m)}>
                      {m.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <MotivoNaoExecucaoFormDialog open={dialogAberto} motivo={emEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

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
import { atualizarMotivoResolucaoAlerta, desativarMotivoResolucaoAlerta, listarMotivosResolucaoAlerta } from '../../lib/api/motivosResolucaoAlerta';
import type { MotivoResolucaoAlerta } from '../../types/api';
import { MotivoResolucaoAlertaFormDialog } from './MotivoResolucaoAlertaFormDialog';

/**
 * Catálogo de motivos pra fechamento rápido de alerta (docs/56) — usado no diálogo "Resolver
 * alerta" do Painel de Atividades e da tela Registros. Mesmo molde de Ramos de Atividade.
 */
export function MotivosResolucaoAlertaListPage() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<MotivoResolucaoAlerta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['motivos-resolucao-alerta'], queryFn: () => listarMotivosResolucaoAlerta() });

  const reativarMutation = useMutation({
    mutationFn: (m: MotivoResolucaoAlerta) => atualizarMotivoResolucaoAlerta(m.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['motivos-resolucao-alerta'] });
    },
    onError: () => setErro('Não foi possível reativar o motivo.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (m: MotivoResolucaoAlerta) => desativarMotivoResolucaoAlerta(m.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['motivos-resolucao-alerta'] });
    },
    onError: () => setErro('Não foi possível desativar o motivo.'),
  });

  function alternarStatus(m: MotivoResolucaoAlerta) {
    if (m.ativo) {
      if (window.confirm(`Desativar "${m.descricao}"?`)) {
        desativarMutation.mutate(m);
      }
      return;
    }
    reativarMutation.mutate(m);
  }

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Motivos de Resolução" />);

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
            {query.data?.motivos_resolucao_alerta.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Nenhum motivo cadastrado ainda — quem resolver um alerta pela tela Registros ou
                  pelo Painel de Atividades vai cair direto em "Outro" até você cadastrar algum.
                </TableCell>
              </TableRow>
            )}
            {query.data?.motivos_resolucao_alerta.map((m) => (
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

      <MotivoResolucaoAlertaFormDialog open={dialogAberto} motivo={emEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

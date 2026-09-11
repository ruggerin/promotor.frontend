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
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarPerfil, desativarPerfil, listarPerfis } from '../../lib/api/perfis';
import type { Perfil } from '../../types/api';
import { PerfilFormDialog } from './PerfilFormDialog';

export function PerfisListPage() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [perfilEmEdicao, setPerfilEmEdicao] = useState<Perfil | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const perfisQuery = useQuery({
    queryKey: ['perfis'],
    queryFn: listarPerfis,
  });

  const reativarMutation = useMutation({
    mutationFn: (perfil: Perfil) => atualizarPerfil(perfil.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['perfis'] });
    },
    onError: () => setErro('Não foi possível reativar o perfil.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (perfil: Perfil) => desativarPerfil(perfil.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['perfis'] });
    },
    onError: () => setErro('Não foi possível desativar o perfil.'),
  });

  function alternarStatus(perfil: Perfil) {
    if (perfil.ativo) {
      if (window.confirm(`Desativar o perfil ${perfil.nome}? Todo GESTOR com esse perfil perde as permissões dele.`)) {
        desativarMutation.mutate(perfil);
      }
      return;
    }

    reativarMutation.mutate(perfil);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Perfis
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setPerfilEmEdicao(null);
            setDialogAberto(true);
          }}
        >
          Novo perfil
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
              <TableCell>Nome</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Permissões</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {perfisQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {perfisQuery.isError && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {perfisQuery.data?.perfis.length === 0 && !perfisQuery.isError && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Nenhum perfil cadastrado.
                </TableCell>
              </TableRow>
            )}
            {perfisQuery.data?.perfis.map((perfil) => (
              <TableRow key={perfil.id} hover>
                <TableCell>{perfil.nome}</TableCell>
                <TableCell>{perfil.descricao ?? '—'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {perfil.permissoes.length === 0 && (
                      <Typography variant="body2" color="text.secondary">
                        Nenhuma
                      </Typography>
                    )}
                    {perfil.permissoes.map((permissao) => (
                      <Chip key={permissao} label={permissao} size="small" />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  <Chip label={perfil.ativo ? 'Ativo' : 'Inativo'} color={perfil.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setPerfilEmEdicao(perfil);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={perfil.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(perfil)}>
                      {perfil.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <PerfilFormDialog open={dialogAberto} perfil={perfilEmEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

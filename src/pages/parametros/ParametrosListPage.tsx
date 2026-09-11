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
import axios from 'axios';
import { useState } from 'react';
import { atualizarParametro, desativarParametro, listarParametros } from '../../lib/api/parametros';
import type { Parametro } from '../../types/api';
import { ParametroFormDialog } from './ParametroFormDialog';

// Lista sem paginação — mesmo padrão de Perfis (catálogo pequeno por natureza, ver
// PerfisListPage.tsx). Configuração chave/valor por empresa (ex.: CHECKIN_RAIO_METROS), ver
// docs/03-ADMIN-WEB.md#6-parâmetros.
export function ParametrosListPage() {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [parametroEmEdicao, setParametroEmEdicao] = useState<Parametro | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const parametrosQuery = useQuery({
    queryKey: ['parametros'],
    queryFn: listarParametros,
  });

  const reativarMutation = useMutation({
    mutationFn: (parametro: Parametro) => atualizarParametro(parametro.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['parametros'] });
    },
    onError: () => setErro('Não foi possível reativar o parâmetro.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (parametro: Parametro) => desativarParametro(parametro.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['parametros'] });
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível desativar o parâmetro.';
      setErro(mensagem);
    },
  });

  function alternarStatus(parametro: Parametro) {
    if (parametro.ativo) {
      // CHECKIN_RAIO_METROS é um caso especial (ver docs/02-API-BACKEND.md, regra de negócio
      // 1): desativar não volta pro padrão do sistema, desliga a validação de raio por
      // completo. Vale um aviso diferente do genérico — já aconteceu de alguém desativar
      // esperando "sem restrição" e cair no default (200m), que era mais restritivo que o
      // valor customizado que tinha.
      const aviso =
        parametro.chave === 'CHECKIN_RAIO_METROS'
          ? 'Desativar CHECKIN_RAIO_METROS? Diferente dos outros parâmetros, isso não volta pro padrão do sistema — desliga a validação de distância por completo, qualquer check-in vai ser aceito independente de onde o promotor estiver.'
          : `Desativar ${parametro.chave}? Quem consome este parâmetro passa a usar o valor padrão do sistema.`;

      if (window.confirm(aviso)) {
        desativarMutation.mutate(parametro);
      }
      return;
    }

    reativarMutation.mutate(parametro);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Parâmetros
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setParametroEmEdicao(null);
            setDialogAberto(true);
          }}
        >
          Novo parâmetro
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
              <TableCell>Chave</TableCell>
              <TableCell>Valor</TableCell>
              <TableCell>Descrição</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parametrosQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {parametrosQuery.isError && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {parametrosQuery.data?.parametros.length === 0 && !parametrosQuery.isError && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Nenhum parâmetro cadastrado.
                </TableCell>
              </TableRow>
            )}
            {parametrosQuery.data?.parametros.map((parametro) => (
              <TableRow key={parametro.id} hover>
                <TableCell>
                  <Typography component="code" sx={{ fontFamily: 'monospace' }}>
                    {parametro.chave}
                  </Typography>
                </TableCell>
                <TableCell>{parametro.valor}</TableCell>
                <TableCell>{parametro.descricao ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={parametro.ativo ? 'Ativo' : 'Inativo'}
                    color={parametro.ativo ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setParametroEmEdicao(parametro);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={parametro.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(parametro)}>
                      {parametro.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <ParametroFormDialog open={dialogAberto} parametro={parametroEmEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

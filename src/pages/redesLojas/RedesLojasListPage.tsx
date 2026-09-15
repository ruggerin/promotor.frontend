import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Autocomplete,
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
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { atualizarRedeLoja, desativarRedeLoja, listarRedesLojas } from '../../lib/api/redesLojas';
import { useAuth } from '../../lib/auth/AuthContext';
import type { RedeLoja } from '../../types/api';
import { RedeLojaFormDialog } from './RedeLojaFormDialog';

/**
 * Classificação de PontoVenda (selects no cadastro da loja) — item próprio no menu lateral, não
 * uma aba dentro de Catálogo (que é reservado pro catálogo de auditoria: departamento/seção/
 * marca/produto/nível de exibição). Pedido explícito do usuário.
 */
export function RedesLojasListPage() {
  const { usuario } = useAuth();
  const isSuperadmin = usuario?.user_type === 'SUPERADMIN';
  const [empresaUuid, setEmpresaUuid] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<RedeLoja | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: isSuperadmin,
  });

  const query = useQuery({
    queryKey: ['redes-lojas', { empresaUuid }],
    queryFn: () => listarRedesLojas({ empresa_uuid: empresaUuid ?? undefined }),
  });

  const totalColunas = isSuperadmin ? 4 : 3;

  const reativarMutation = useMutation({
    mutationFn: (r: RedeLoja) => atualizarRedeLoja(r.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['redes-lojas'] });
    },
    onError: () => setErro('Não foi possível reativar a rede de lojas.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (r: RedeLoja) => desativarRedeLoja(r.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['redes-lojas'] });
    },
    onError: () => setErro('Não foi possível desativar a rede de lojas.'),
  });

  function alternarStatus(r: RedeLoja) {
    if (r.ativo) {
      if (window.confirm(`Desativar ${r.descricao}?`)) {
        desativarMutation.mutate(r);
      }
      return;
    }
    reativarMutation.mutate(r);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Redes de Lojas
        </Typography>
        {!isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Nova rede de lojas
          </Button>
        )}
      </Box>

      {isSuperadmin && (
        <Autocomplete
          size="small"
          sx={{ width: 280, mb: 2 }}
          options={empresasQuery.data?.empresas ?? []}
          getOptionLabel={(option) => option.nome_fantasia}
          loading={empresasQuery.isLoading}
          onChange={(_, value) => setEmpresaUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Empresa" placeholder="Todas as empresas" />}
        />
      )}

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {isSuperadmin && <TableCell>Empresa</TableCell>}
              <TableCell>Descrição</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.data?.redes_lojas.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhuma rede de lojas cadastrada.
                </TableCell>
              </TableRow>
            )}
            {query.data?.redes_lojas.map((r) => (
              <TableRow key={r.id} hover>
                {isSuperadmin && <TableCell>{r.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{r.descricao}</TableCell>
                <TableCell>
                  <Chip label={r.ativo ? 'Ativo' : 'Inativo'} color={r.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  {isSuperadmin ? (
                    '—'
                  ) : (
                    <>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEmEdicao(r);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={r.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(r)}>
                          {r.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isSuperadmin && (
        <RedeLojaFormDialog open={dialogAberto} redeLoja={emEdicao} onClose={() => setDialogAberto(false)} />
      )}
    </Box>
  );
}

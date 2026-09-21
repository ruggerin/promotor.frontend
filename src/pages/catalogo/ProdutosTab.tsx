import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClearIcon from '@mui/icons-material/Clear';
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
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { aprovarProduto, atualizarProduto, desativarProduto, listarProdutos, rejeitarProduto } from '../../lib/api/produtos';
import type { ProdutoAuditoria } from '../../types/api';
import { ProdutoFormDialog } from './ProdutoFormDialog';

interface ProdutosTabProps {
  empresaUuid: string | null;
  isSuperadmin: boolean;
}

export function ProdutosTab({ empresaUuid, isSuperadmin }: ProdutosTabProps) {
  const queryClient = useQueryClient();
  const [filtroDepartamentoUuid, setFiltroDepartamentoUuid] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<ProdutoAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const departamentosQuery = useQuery({
    queryKey: ['departamentos', { empresaUuid }],
    queryFn: () => listarDepartamentos({ empresa_uuid: empresaUuid ?? undefined }),
  });

  const query = useQuery({
    queryKey: ['produtos', { filtroDepartamentoUuid, empresaUuid }],
    queryFn: () =>
      listarProdutos({ departamento_uuid: filtroDepartamentoUuid ?? undefined, empresa_uuid: empresaUuid ?? undefined }),
  });

  const totalColunas = isSuperadmin ? 10 : 9;

  const reativarMutation = useMutation({
    mutationFn: (p: ProdutoAuditoria) => atualizarProduto(p.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: () => setErro('Não foi possível reativar o produto.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (p: ProdutoAuditoria) => desativarProduto(p.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: () => setErro('Não foi possível desativar o produto.'),
  });

  // Produto cadastrado por um promotor pela visita, em modo REQUER_APROVACAO — ver
  // docs/14-SORTIMENTO-PONTO-VENDA.md §9.
  const aprovarMutation = useMutation({
    mutationFn: (p: ProdutoAuditoria) => aprovarProduto(p.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: () => setErro('Não foi possível aprovar o produto.'),
  });

  const rejeitarMutation = useMutation({
    mutationFn: (p: ProdutoAuditoria) => rejeitarProduto(p.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['produtos'] });
    },
    onError: () => setErro('Não foi possível rejeitar o produto.'),
  });

  function alternarStatus(p: ProdutoAuditoria) {
    if (p.ativo) {
      if (window.confirm(`Desativar ${p.descricao}?`)) {
        desativarMutation.mutate(p);
      }
      return;
    }
    reativarMutation.mutate(p);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 2, flexWrap: 'wrap' }}>
        <Autocomplete
          size="small"
          sx={{ width: 260 }}
          options={departamentosQuery.data?.departamentos ?? []}
          getOptionLabel={(option) => option.descricao}
          onChange={(_, value) => setFiltroDepartamentoUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Filtrar por departamento" />}
        />
        {!isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Novo produto
          </Button>
        )}
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
              {isSuperadmin && <TableCell>Empresa</TableCell>}
              <TableCell>Descrição</TableCell>
              <TableCell>Código de barras</TableCell>
              <TableCell>Departamento</TableCell>
              <TableCell>Seção</TableCell>
              <TableCell>Marca</TableCell>
              <TableCell>Nível</TableCell>
              <TableCell>Propriedade</TableCell>
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
            {query.data?.produtos.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum produto cadastrado.
                </TableCell>
              </TableRow>
            )}
            {query.data?.produtos.map((p) => (
              <TableRow key={p.id} hover>
                {isSuperadmin && <TableCell>{p.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{p.descricao}</TableCell>
                <TableCell>{p.codigo_barras ?? '—'}</TableCell>
                <TableCell>{p.departamento?.descricao ?? '—'}</TableCell>
                <TableCell>{p.secao?.descricao ?? '—'}</TableCell>
                <TableCell>{p.marca?.descricao ?? '—'}</TableCell>
                <TableCell>{p.nivel_exibicao?.descricao ?? '—'}</TableCell>
                <TableCell>
                  <Chip
                    label={p.propriedade === 'PROPRIA' ? 'Própria' : 'Concorrente'}
                    color={p.propriedade === 'PROPRIA' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={p.ativo ? 'Ativo' : 'Inativo'} color={p.ativo ? 'success' : 'default'} size="small" />
                    {p.produto_chave && (
                      <Tooltip title='Avisa o promotor pelo nome ao finalizar a visita se ficar sem registro'>
                        <Chip label="Chave" color="info" size="small" />
                      </Tooltip>
                    )}
                    {p.status_aprovacao === 'PENDENTE' && (
                      <Chip label={`Pendente${p.criado_por ? ` (${p.criado_por.nome})` : ''}`} color="warning" size="small" />
                    )}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {isSuperadmin ? (
                    '—'
                  ) : p.status_aprovacao === 'PENDENTE' ? (
                    <>
                      <Tooltip title="Aprovar">
                        <IconButton size="small" onClick={() => aprovarMutation.mutate(p)}>
                          <CheckCircleIcon fontSize="small" color="success" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Rejeitar">
                        <IconButton size="small" onClick={() => rejeitarMutation.mutate(p)}>
                          <ClearIcon fontSize="small" color="error" />
                        </IconButton>
                      </Tooltip>
                    </>
                  ) : (
                    <>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEmEdicao(p);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={p.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(p)}>
                          {p.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
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
        <ProdutoFormDialog open={dialogAberto} produto={emEdicao} onClose={() => setDialogAberto(false)} />
      )}
    </Box>
  );
}

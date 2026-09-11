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
import { atualizarDepartamento, desativarDepartamento, listarDepartamentos } from '../../lib/api/departamentos';
import type { DepartamentoAuditoria } from '../../types/api';
import { DepartamentoFormDialog } from './DepartamentoFormDialog';

interface DepartamentosTabProps {
  empresaUuid: string | null;
  isSuperadmin: boolean;
}

export function DepartamentosTab({ empresaUuid, isSuperadmin }: DepartamentosTabProps) {
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<DepartamentoAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['departamentos', { empresaUuid }],
    queryFn: () => listarDepartamentos({ empresa_uuid: empresaUuid ?? undefined }),
  });

  const totalColunas = isSuperadmin ? 4 : 3;

  const reativarMutation = useMutation({
    mutationFn: (d: DepartamentoAuditoria) => atualizarDepartamento(d.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['departamentos'] });
    },
    onError: () => setErro('Não foi possível reativar o departamento.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (d: DepartamentoAuditoria) => desativarDepartamento(d.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['departamentos'] });
    },
    onError: () => setErro('Não foi possível desativar o departamento.'),
  });

  function alternarStatus(d: DepartamentoAuditoria) {
    if (d.ativo) {
      if (window.confirm(`Desativar ${d.descricao}?`)) {
        desativarMutation.mutate(d);
      }
      return;
    }
    reativarMutation.mutate(d);
  }

  return (
    <Box>
      {!isSuperadmin && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Novo departamento
          </Button>
        </Box>
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
            {query.data?.departamentos.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum departamento cadastrado.
                </TableCell>
              </TableRow>
            )}
            {query.data?.departamentos.map((d) => (
              <TableRow key={d.id} hover>
                {isSuperadmin && <TableCell>{d.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{d.descricao}</TableCell>
                <TableCell>
                  <Chip label={d.ativo ? 'Ativo' : 'Inativo'} color={d.ativo ? 'success' : 'default'} size="small" />
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
                            setEmEdicao(d);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={d.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(d)}>
                          {d.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
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
        <DepartamentoFormDialog open={dialogAberto} departamento={emEdicao} onClose={() => setDialogAberto(false)} />
      )}
    </Box>
  );
}

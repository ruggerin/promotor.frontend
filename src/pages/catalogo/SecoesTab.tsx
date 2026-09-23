import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
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
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { atualizarSecao, desativarSecao, listarSecoes } from '../../lib/api/secoes';
import type { SecaoAuditoria } from '../../types/api';
import { SecaoFormDialog } from './SecaoFormDialog';

interface SecoesTabProps {
  empresaUuid: string | null;
  isSuperadmin: boolean;
}

export function SecoesTab({ empresaUuid, isSuperadmin }: SecoesTabProps) {
  const queryClient = useQueryClient();
  const [filtroDepartamentoUuid, setFiltroDepartamentoUuid] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<SecaoAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const departamentosQuery = useQuery({
    queryKey: ['departamentos', { empresaUuid }],
    queryFn: () => listarDepartamentos({ empresa_uuid: empresaUuid ?? undefined }),
  });

  const query = useQuery({
    queryKey: ['secoes', { filtroDepartamentoUuid, empresaUuid, busca }],
    queryFn: () =>
      listarSecoes({
        departamento_uuid: filtroDepartamentoUuid ?? undefined,
        empresa_uuid: empresaUuid ?? undefined,
        busca: busca || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const totalColunas = isSuperadmin ? 5 : 4;

  const reativarMutation = useMutation({
    mutationFn: (s: SecaoAuditoria) => atualizarSecao(s.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['secoes'] });
    },
    onError: () => setErro('Não foi possível reativar a seção.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (s: SecaoAuditoria) => desativarSecao(s.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['secoes'] });
    },
    onError: () => setErro('Não foi possível desativar a seção.'),
  });

  function alternarStatus(s: SecaoAuditoria) {
    if (s.ativo) {
      if (window.confirm(`Desativar ${s.descricao}?`)) {
        desativarMutation.mutate(s);
      }
      return;
    }
    reativarMutation.mutate(s);
  }

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 1.5,
          pb: 2,
          mb: 2,
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Buscar"
            size="small"
            sx={{ width: 240 }}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Descrição da seção"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Autocomplete
            size="small"
            sx={{ width: 220 }}
            options={departamentosQuery.data?.departamentos ?? []}
            getOptionLabel={(option) => option.descricao}
            onChange={(_, value) => setFiltroDepartamentoUuid(value?.id ?? null)}
            renderInput={(params) => <TextField {...params} label="Departamento" />}
          />
        </Box>
        {!isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Nova seção
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
              <TableCell>Departamento</TableCell>
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
            {query.data?.secoes.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhuma seção cadastrada.
                </TableCell>
              </TableRow>
            )}
            {query.data?.secoes.map((s) => (
              <TableRow key={s.id} hover>
                {isSuperadmin && <TableCell>{s.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{s.descricao}</TableCell>
                <TableCell>{s.departamento?.descricao ?? '—'}</TableCell>
                <TableCell>
                  <Chip label={s.ativo ? 'Ativo' : 'Inativo'} color={s.ativo ? 'success' : 'default'} size="small" />
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
                            setEmEdicao(s);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={s.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(s)}>
                          {s.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
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

      {!isSuperadmin && <SecaoFormDialog open={dialogAberto} secao={emEdicao} onClose={() => setDialogAberto(false)} />}
    </Box>
  );
}

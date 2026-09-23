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
  MenuItem,
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
import { atualizarMarca, desativarMarca, listarMarcas } from '../../lib/api/marcas';
import type { MarcaAuditoria, Propriedade } from '../../types/api';
import { MarcaFormDialog } from './MarcaFormDialog';

interface MarcasTabProps {
  empresaUuid: string | null;
  isSuperadmin: boolean;
}

export function MarcasTab({ empresaUuid, isSuperadmin }: MarcasTabProps) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [filtroPropriedade, setFiltroPropriedade] = useState<Propriedade | ''>('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<MarcaAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['marcas', { empresaUuid, busca, filtroPropriedade }],
    queryFn: () =>
      listarMarcas({
        empresa_uuid: empresaUuid ?? undefined,
        busca: busca || undefined,
        propriedade: filtroPropriedade || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const totalColunas = isSuperadmin ? 5 : 4;

  const reativarMutation = useMutation({
    mutationFn: (m: MarcaAuditoria) => atualizarMarca(m.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['marcas'] });
    },
    onError: () => setErro('Não foi possível reativar a marca.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (m: MarcaAuditoria) => desativarMarca(m.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['marcas'] });
    },
    onError: () => setErro('Não foi possível desativar a marca.'),
  });

  function alternarStatus(m: MarcaAuditoria) {
    if (m.ativo) {
      if (window.confirm(`Desativar ${m.descricao}?`)) {
        desativarMutation.mutate(m);
      }
      return;
    }
    reativarMutation.mutate(m);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, gap: 1.5, flexWrap: 'wrap' }}>
        <Paper sx={{ p: 1.5, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Buscar"
            size="small"
            sx={{ width: 240 }}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Descrição da marca"
          />
          <TextField
            select
            label="Propriedade"
            size="small"
            sx={{ width: 160 }}
            value={filtroPropriedade}
            onChange={(e) => setFiltroPropriedade(e.target.value as Propriedade | '')}
          >
            <MenuItem value="">Todas</MenuItem>
            <MenuItem value="PROPRIA">Própria</MenuItem>
            <MenuItem value="CONCORRENTE">Concorrente</MenuItem>
          </TextField>
        </Paper>
        {!isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Nova marca
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
            {query.data?.marcas.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhuma marca cadastrada.
                </TableCell>
              </TableRow>
            )}
            {query.data?.marcas.map((m) => (
              <TableRow key={m.id} hover>
                {isSuperadmin && <TableCell>{m.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{m.descricao}</TableCell>
                <TableCell>
                  <Chip
                    label={m.propriedade === 'PROPRIA' ? 'Própria' : 'Concorrente'}
                    color={m.propriedade === 'PROPRIA' ? 'primary' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Chip label={m.ativo ? 'Ativo' : 'Inativo'} color={m.ativo ? 'success' : 'default'} size="small" />
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
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isSuperadmin && <MarcaFormDialog open={dialogAberto} marca={emEdicao} onClose={() => setDialogAberto(false)} />}
    </Box>
  );
}

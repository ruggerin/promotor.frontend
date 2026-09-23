import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
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
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { atualizarNivelExibicao, desativarNivelExibicao, listarNiveisExibicao } from '../../lib/api/niveisExibicao';
import type { NivelExibicao } from '../../types/api';
import { NivelExibicaoFormDialog } from './NivelExibicaoFormDialog';

interface NiveisExibicaoTabProps {
  empresaUuid: string | null;
  isSuperadmin: boolean;
}

export function NiveisExibicaoTab({ empresaUuid, isSuperadmin }: NiveisExibicaoTabProps) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState('');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<NivelExibicao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['niveis-exibicao', { empresaUuid, busca }],
    queryFn: () => listarNiveisExibicao({ empresa_uuid: empresaUuid ?? undefined, busca: busca || undefined }),
    placeholderData: keepPreviousData,
  });

  const totalColunas = isSuperadmin ? 4 : 3;

  const reativarMutation = useMutation({
    mutationFn: (n: NivelExibicao) => atualizarNivelExibicao(n.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['niveis-exibicao'] });
    },
    onError: () => setErro('Não foi possível reativar o nível.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (n: NivelExibicao) => desativarNivelExibicao(n.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['niveis-exibicao'] });
    },
    onError: () => setErro('Não foi possível desativar o nível.'),
  });

  function alternarStatus(n: NivelExibicao) {
    if (n.ativo) {
      if (window.confirm(`Desativar ${n.descricao}?`)) {
        desativarMutation.mutate(n);
      }
      return;
    }
    reativarMutation.mutate(n);
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lista própria da empresa — cada uma define os próprios níveis (ex.: "Prateleira", "Ponta
        de gôndola"), atribuídos aos produtos no cadastro deles.
      </Typography>
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
        <TextField
          label="Buscar"
          size="small"
          sx={{ width: 280 }}
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Descrição do nível"
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
        {!isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Novo nível
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
            {query.data?.niveis_exibicao.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum nível cadastrado.
                </TableCell>
              </TableRow>
            )}
            {query.data?.niveis_exibicao.map((n) => (
              <TableRow key={n.id} hover>
                {isSuperadmin && <TableCell>{n.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{n.descricao}</TableCell>
                <TableCell>
                  <Chip label={n.ativo ? 'Ativo' : 'Inativo'} color={n.ativo ? 'success' : 'default'} size="small" />
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
                            setEmEdicao(n);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={n.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(n)}>
                          {n.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
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
        <NivelExibicaoFormDialog open={dialogAberto} nivel={emEdicao} onClose={() => setDialogAberto(false)} />
      )}
    </Box>
  );
}

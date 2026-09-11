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
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { atualizarCampanha, desativarCampanha, listarCampanhas } from '../../lib/api/campanhas';
import { formatarDataSemFuso } from '../../lib/formatarData';
import type { CampanhaAuditoria } from '../../types/api';
import { CampanhaFormDialog } from './CampanhaFormDialog';

export function CampanhasListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<CampanhaAuditoria | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['campanhas', { filtroAtivo }],
    queryFn: () => listarCampanhas(filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos'),
  });

  const reativarMutation = useMutation({
    mutationFn: (c: CampanhaAuditoria) => atualizarCampanha(c.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['campanhas'] });
    },
    onError: () => setErro('Não foi possível reativar a campanha.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (c: CampanhaAuditoria) => desativarCampanha(c.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['campanhas'] });
    },
    onError: () => setErro('Não foi possível desativar a campanha.'),
  });

  function alternarStatus(c: CampanhaAuditoria, e: React.MouseEvent) {
    e.stopPropagation();
    if (c.ativo) {
      if (window.confirm(`Desativar ${c.descricao}?`)) {
        desativarMutation.mutate(c);
      }
      return;
    }
    reativarMutation.mutate(c);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Campanhas
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setEmEdicao(null);
            setDialogAberto(true);
          }}
        >
          Nova campanha
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2 }}>
        <TextField
          select
          label="Status"
          size="small"
          sx={{ width: 160 }}
          value={filtroAtivo}
          onChange={(e) => setFiltroAtivo(e.target.value as 'todos' | 'ativos' | 'inativos')}
        >
          <MenuItem value="ativos">Ativas</MenuItem>
          <MenuItem value="inativos">Inativas</MenuItem>
          <MenuItem value="todos">Todas</MenuItem>
        </TextField>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell>Vigência início</TableCell>
              <TableCell>Vigência fim</TableCell>
              <TableCell>Recorrência</TableCell>
              <TableCell align="right">Itens</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.isError && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {query.data?.campanhas.length === 0 && !query.isError && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Nenhuma campanha encontrada.
                </TableCell>
              </TableRow>
            )}
            {query.data?.campanhas.map((c) => (
              <TableRow key={c.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/campanhas/${c.id}`)}>
                <TableCell>{c.descricao}</TableCell>
                <TableCell>{formatarDataSemFuso(c.vigencia_inicio)}</TableCell>
                <TableCell>{formatarDataSemFuso(c.vigencia_fim)}</TableCell>
                <TableCell>
                  {c.execucao_recorrente ? `A cada ${c.frequencia_dias} dia(s)` : 'Única'}
                </TableCell>
                <TableCell align="right">{c.itens?.length ?? '—'}</TableCell>
                <TableCell>
                  <Chip label={c.ativo ? 'Ativa' : 'Inativa'} color={c.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEmEdicao(c);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={c.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={(e) => alternarStatus(c, e)}>
                      {c.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <CampanhaFormDialog open={dialogAberto} campanha={emEdicao} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

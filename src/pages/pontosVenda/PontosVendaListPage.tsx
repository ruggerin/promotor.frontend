import AddIcon from '@mui/icons-material/Add';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import GroupIcon from '@mui/icons-material/Group';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
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
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  adicionarPromotorPontoVenda,
  atualizarPontoVenda,
  desativarPontoVenda,
  listarPontosVenda,
  removerPromotorPontoVenda,
} from '../../lib/api/pontosVenda';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { PontoVenda } from '../../types/api';
import { AtribuirPromotorDialog } from './AtribuirPromotorDialog';
import { PontoVendaFormDialog } from './PontoVendaFormDialog';

export function PontosVendaListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [busca, setBusca] = useState('');
  const [filtroPromotorUuid, setFiltroPromotorUuid] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [pdvEmEdicao, setPdvEmEdicao] = useState<PontoVenda | null>(null);
  // Map (não Set) pra guardar o objeto inteiro, não só o uuid — a seleção precisa sobreviver
  // trocando de página (ex.: atribuir 50 das 100 lojas cobre várias páginas de 15), e cada PDV
  // selecionado numa página anterior não fica mais disponível em `pdvs` depois de paginar.
  const [selecionados, setSelecionados] = useState<Map<string, PontoVenda>>(new Map());
  const [dialogPromotorAberto, setDialogPromotorAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Lista de promotores da empresa — reusada no filtro e no diálogo de atribuição em massa.
  // Regra de negócio 6 (ver docs/02-API-BACKEND.md): cada loja pode ter um ou mais promotores
  // responsáveis; sem nenhum atribuído, ela continua visível a todos no mobile.
  const promotoresQuery = useQuery({
    queryKey: ['usuarios', { user_type: 'PROMOTOR', ativo: true }],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', ativo: true }),
  });
  const promotores = promotoresQuery.data?.usuarios ?? [];

  const pdvQuery = useQuery({
    queryKey: ['pontos-venda', { page, filtroAtivo, busca, filtroPromotorUuid }],
    queryFn: () =>
      listarPontosVenda({
        page: page + 1,
        ativo: filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos',
        busca: busca || undefined,
        promotor_uuid: filtroPromotorUuid ?? undefined,
      }),
    placeholderData: keepPreviousData,
  });
  const pdvs = pdvQuery.data?.pontos_venda ?? [];

  const alternarAtivoMutation = useMutation({
    mutationFn: (pdv: PontoVenda) => atualizarPontoVenda(pdv.id, { ativo: !pdv.ativo }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda'] });
    },
    onError: () => setErro('Não foi possível alterar o status do ponto de venda.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (pdv: PontoVenda) => desativarPontoVenda(pdv.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda'] });
    },
    onError: () => setErro('Não foi possível desativar o ponto de venda.'),
  });

  // Soma o promotor escolhido à atribuição das lojas selecionadas — não mexe em quem já estava
  // atribuído nelas. Add unitário por PDV (não sync da lista inteira) — evita a race de duas
  // atribuições em sequência rápida uma perdendo a outra. Cobre o caso de "atribuir 50 das 100
  // lojas pro promotor A" de uma vez.
  const atribuirPromotorMutation = useMutation({
    mutationFn: async ({ pdvsAlvo, promotorUuid }: { pdvsAlvo: PontoVenda[]; promotorUuid: string }) => {
      await Promise.all(pdvsAlvo.map((pdv) => adicionarPromotorPontoVenda(pdv.id, promotorUuid)));
    },
    onSuccess: () => {
      setErro(null);
      setSelecionados(new Map());
      setDialogPromotorAberto(false);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda'] });
    },
    onError: () => setErro('Não foi possível atribuir o promotor a uma ou mais lojas selecionadas.'),
  });

  // Remove só aquele promotor daquela loja (clique no "x" do chip) — mantém os demais.
  const removerPromotorMutation = useMutation({
    mutationFn: ({ pdv, promotorUuid }: { pdv: PontoVenda; promotorUuid: string }) =>
      removerPromotorPontoVenda(pdv.id, promotorUuid),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda'] });
    },
    onError: () => setErro('Não foi possível remover o promotor desta loja.'),
  });

  function alternarStatus(pdv: PontoVenda) {
    if (pdv.ativo) {
      if (window.confirm(`Desativar ${pdv.fantasia}?`)) {
        desativarMutation.mutate(pdv);
      }
      return;
    }

    alternarAtivoMutation.mutate(pdv);
  }

  function alternarSelecao(pdv: PontoVenda) {
    setSelecionados((atual) => {
      const novo = new Map(atual);
      if (novo.has(pdv.id)) {
        novo.delete(pdv.id);
      } else {
        novo.set(pdv.id, pdv);
      }
      return novo;
    });
  }

  const todosSelecionadosNestaPagina = pdvs.length > 0 && pdvs.every((pdv) => selecionados.has(pdv.id));

  function alternarSelecaoTodos() {
    setSelecionados((atual) => {
      const novo = new Map(atual);
      if (todosSelecionadosNestaPagina) {
        pdvs.forEach((pdv) => novo.delete(pdv.id));
      } else {
        pdvs.forEach((pdv) => novo.set(pdv.id, pdv));
      }
      return novo;
    });
  }

  const perPage = pdvQuery.data?.meta.per_page ?? 15;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Pontos de Venda
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setPdvEmEdicao(null);
            setDialogAberto(true);
          }}
        >
          Novo ponto de venda
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Buscar"
          size="small"
          sx={{ width: 280 }}
          value={busca}
          onChange={(e) => {
            setPage(0);
            setBusca(e.target.value);
          }}
          placeholder="Razão social, fantasia ou bairro"
        />
        <TextField
          select
          label="Status"
          size="small"
          sx={{ width: 160 }}
          value={filtroAtivo}
          onChange={(e) => {
            setPage(0);
            setFiltroAtivo(e.target.value as 'todos' | 'ativos' | 'inativos');
          }}
        >
          <MenuItem value="ativos">Ativos</MenuItem>
          <MenuItem value="inativos">Inativos</MenuItem>
          <MenuItem value="todos">Todos</MenuItem>
        </TextField>
        <Autocomplete
          size="small"
          sx={{ width: 240 }}
          options={promotores}
          getOptionLabel={(option) => option.nome}
          loading={promotoresQuery.isLoading}
          onChange={(_, value) => {
            setPage(0);
            setFiltroPromotorUuid(value?.id ?? null);
          }}
          renderInput={(params) => <TextField {...params} label="Promotor" placeholder="Todos os promotores" />}
        />
        {selecionados.size > 0 && (
          <Button
            variant="outlined"
            startIcon={<GroupIcon />}
            sx={{ ml: 'auto' }}
            onClick={() => setDialogPromotorAberto(true)}
          >
            Atribuir promotor ({selecionados.size})
          </Button>
        )}
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={todosSelecionadosNestaPagina}
                  indeterminate={!todosSelecionadosNestaPagina && pdvs.some((pdv) => selecionados.has(pdv.id))}
                  onChange={alternarSelecaoTodos}
                />
              </TableCell>
              <TableCell>Fantasia</TableCell>
              <TableCell>Razão social</TableCell>
              <TableCell>Cidade</TableCell>
              <TableCell>Bairro</TableCell>
              <TableCell>Telefone</TableCell>
              <TableCell>Promotores</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pdvQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {pdvQuery.isError && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {pdvs.length === 0 && !pdvQuery.isLoading && !pdvQuery.isError && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  Nenhum ponto de venda encontrado.
                </TableCell>
              </TableRow>
            )}
            {pdvs.map((pdv) => (
              <TableRow
                key={pdv.id}
                hover
                selected={selecionados.has(pdv.id)}
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/pontos-venda/${pdv.id}`)}
              >
                <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                  <Checkbox checked={selecionados.has(pdv.id)} onChange={() => alternarSelecao(pdv)} />
                </TableCell>
                <TableCell>{pdv.fantasia}</TableCell>
                <TableCell>{pdv.razao_social}</TableCell>
                <TableCell>{pdv.cidade}</TableCell>
                <TableCell>{pdv.bairro ?? '—'}</TableCell>
                <TableCell>{pdv.telefone ?? '—'}</TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {pdv.promotores.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {pdv.promotores.map((p) => (
                        <Chip
                          key={p.id}
                          label={p.nome}
                          size="small"
                          onDelete={() => removerPromotorMutation.mutate({ pdv, promotorUuid: p.id })}
                        />
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={pdv.ativo ? 'Ativo' : 'Inativo'} color={pdv.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() => {
                        setPdvEmEdicao(pdv);
                        setDialogAberto(true);
                      }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={pdv.ativo ? 'Desativar' : 'Reativar'}>
                    <IconButton size="small" onClick={() => alternarStatus(pdv)}>
                      {pdv.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={pdvQuery.data?.meta.total ?? 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={perPage}
          rowsPerPageOptions={[perPage]}
          onRowsPerPageChange={() => {
            // A API não aceita per_page customizado ainda.
          }}
        />
      </TableContainer>

      <PontoVendaFormDialog
        open={dialogAberto}
        pontoVenda={pdvEmEdicao}
        onClose={() => setDialogAberto(false)}
      />

      <AtribuirPromotorDialog
        open={dialogPromotorAberto}
        promotores={promotores}
        loadingPromotores={promotoresQuery.isLoading}
        quantidadeSelecionada={selecionados.size}
        atribuindo={atribuirPromotorMutation.isPending}
        onClose={() => setDialogPromotorAberto(false)}
        onConfirmar={(promotorUuid) => {
          atribuirPromotorMutation.mutate({ pdvsAlvo: Array.from(selecionados.values()), promotorUuid });
        }}
      />
    </Box>
  );
}

import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
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
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../components/DataTable';
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

const coluna = createColumnHelper<PontoVenda>();

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

  // Ordena só as linhas já carregadas nesta página (ver DataTable) — a paginação/busca em si
  // continuam vindo do backend. Sem useMemo de propósito: as colunas fecham sobre `selecionados`/
  // mutations, que mudam a cada render de qualquer forma — memoizar aqui só arriscaria um closure
  // desatualizado sem ganhar nada.
  const colunas = [
      coluna.display({
        id: 'selecao',
        meta: { padding: 'checkbox' },
        header: () => (
          <Checkbox
            checked={todosSelecionadosNestaPagina}
            indeterminate={!todosSelecionadosNestaPagina && pdvs.some((pdv) => selecionados.has(pdv.id))}
            onChange={alternarSelecaoTodos}
          />
        ),
        cell: (info) => (
          <Box onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={selecionados.has(info.row.original.id)}
              onChange={() => alternarSelecao(info.row.original)}
            />
          </Box>
        ),
      }),
      coluna.accessor('fantasia', { header: 'Fantasia' }),
      coluna.accessor('razao_social', { header: 'Razão social' }),
      coluna.accessor('cidade', { header: 'Cidade' }),
      coluna.accessor((pdv) => pdv.bairro ?? '—', { id: 'bairro', header: 'Bairro' }),
      coluna.accessor((pdv) => pdv.telefone ?? '—', { id: 'telefone', header: 'Telefone' }),
      coluna.display({
        id: 'promotores',
        header: 'Promotores',
        cell: (info) => {
          const pdv = info.row.original;
          if (pdv.promotores.length === 0) {
            return (
              <Typography variant="body2" color="text.secondary">
                —
              </Typography>
            );
          }
          return (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
              {pdv.promotores.map((p) => (
                <Chip
                  key={p.id}
                  label={p.nome}
                  size="small"
                  onDelete={() => removerPromotorMutation.mutate({ pdv, promotorUuid: p.id })}
                />
              ))}
            </Box>
          );
        },
      }),
      coluna.accessor('ativo', {
        header: 'Status',
        cell: (info) => (
          <Chip label={info.getValue() ? 'Ativo' : 'Inativo'} color={info.getValue() ? 'success' : 'default'} size="small" />
        ),
      }),
      coluna.display({
        id: 'acoes',
        header: 'Ações',
        meta: { align: 'right' },
        cell: (info) => {
          const pdv = info.row.original;
          return (
            <Box onClick={(e) => e.stopPropagation()}>
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
            </Box>
          );
        },
      }),
  ];

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Pontos de Venda
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
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

      <DataTable
        columns={colunas}
        data={pdvs}
        getRowId={(pdv) => pdv.id}
        isLoading={pdvQuery.isLoading}
        isError={pdvQuery.isError}
        emptyMessage="Nenhum ponto de venda encontrado."
        onRowClick={(pdv) => navigate(`/pontos-venda/${pdv.id}`)}
        isRowSelected={(pdv) => selecionados.has(pdv.id)}
        page={page}
        onPageChange={setPage}
        rowsPerPage={perPage}
        totalRows={pdvQuery.data?.meta.total ?? 0}
      />

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

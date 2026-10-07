import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff';
import GroupIcon from '@mui/icons-material/Group';
import UploadFileIcon from '@mui/icons-material/UploadFile';
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
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../components/DataTable';
import {
  adicionarPromotorPontoVenda,
  atualizarPontoVenda,
  desativarPontoVenda,
  listarPontosVenda,
  removerPromotorPontoVenda,
} from '../../lib/api/pontosVenda';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { PontoVenda } from '../../types/api';
import { AtribuirPromotorDialog } from './AtribuirPromotorDialog';
import { PontoVendaFormDialog } from './PontoVendaFormDialog';

const coluna = createColumnHelper<PontoVenda>();

// "Sem promotor" é uma opção do mesmo seletor de promotor — loja ainda sem carteira.
const SEM_PROMOTOR = '__sem_promotor__';

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function PontosVendaListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [busca, setBusca] = useState('');
  const [buscaDebounced, setBuscaDebounced] = useState('');
  const [filtroPromotorUuid, setFiltroPromotorUuid] = useState<string | null>(null);
  const [filtroRedeUuid, setFiltroRedeUuid] = useState<string | null>(null);
  const [cidade, setCidade] = useState('');
  const [cidadeDebounced, setCidadeDebounced] = useState('');
  // Período: por data de cadastro (quem entrou na base) ou de última alteração do cadastro.
  const [dataCampo, setDataCampo] = useState<'created_at' | 'updated_at'>('created_at');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [ordenar, setOrdenar] = useState<'fantasia' | 'recentes'>('fantasia');

  // Espera parar de digitar — antes cada tecla disparava uma busca.
  useEffect(() => {
    const timer = setTimeout(() => {
      setBuscaDebounced(busca.trim());
      setCidadeDebounced(cidade.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [busca, cidade]);
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

  const redesQuery = useQuery({
    queryKey: ['redes-lojas', 'filtro-pdv'],
    queryFn: () => listarRedesLojas({ ativo: true, por_pagina: 200 }),
  });
  const redes = redesQuery.data?.redes_lojas ?? [];

  const filtros = {
    ativo: filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos',
    busca: buscaDebounced || undefined,
    promotor_uuid: filtroPromotorUuid && filtroPromotorUuid !== SEM_PROMOTOR ? filtroPromotorUuid : undefined,
    sem_promotor: filtroPromotorUuid === SEM_PROMOTOR || undefined,
    rede_loja_uuid: filtroRedeUuid ?? undefined,
    cidade: cidadeDebounced || undefined,
    data_campo: dataCampo,
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
    ordenar,
  };
  const temFiltro =
    filtroAtivo !== 'ativos' || !!busca || !!filtroPromotorUuid || !!filtroRedeUuid || !!cidade || !!dataInicio || !!dataFim || ordenar !== 'fantasia';

  const pdvQuery = useQuery({
    queryKey: ['pontos-venda', { page, ...filtros }],
    queryFn: () => listarPontosVenda({ page: page + 1, ...filtros }),
    placeholderData: keepPreviousData,
  });

  function mudarFiltro(atualizar: () => void) {
    atualizar();
    setPage(0);
  }

  function limparFiltros() {
    mudarFiltro(() => {
      setFiltroAtivo('ativos');
      setBusca('');
      setFiltroPromotorUuid(null);
      setFiltroRedeUuid(null);
      setCidade('');
      setDataCampo('created_at');
      setDataInicio('');
      setDataFim('');
      setOrdenar('fantasia');
    });
  }
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
      coluna.accessor((pdv) => pdv.codigo_externo ?? '—', { id: 'codigo_externo', header: 'Código' }),
      coluna.accessor('fantasia', { header: 'Fantasia' }),
      coluna.accessor('razao_social', { header: 'Razão social' }),
      coluna.accessor('cidade', { header: 'Cidade' }),
      coluna.accessor((pdv) => pdv.bairro ?? '—', { id: 'bairro', header: 'Bairro' }),
      coluna.accessor((pdv) => pdv.telefone ?? '—', { id: 'telefone', header: 'Telefone' }),
      // Só a última alteração do cadastro — a data de cadastro saiu da linha (poluía a tabela), mas
      // continua disponível como opção do filtro de período.
      coluna.accessor('updated_at', {
        header: 'Atualizado em',
        cell: (info) => <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{formatarDataHora(info.getValue())}</Typography>,
      }),
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

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Pontos de Venda" />);

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1, mb: 2 }}>
        {/* Importação em lote mudou pra tela própria (docs/42) — o atalho continua aqui pra quem procura. */}
        <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => navigate('/importacao-dados')}>
          Importar CSV
        </Button>
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

      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Buscar"
            size="small"
            sx={{ width: 300 }}
            value={busca}
            onChange={(e) => mudarFiltro(() => setBusca(e.target.value))}
            placeholder="Fantasia, razão social, bairro, código ou CNPJ"
          />
          <TextField
            select
            label="Status"
            size="small"
            sx={{ width: 140 }}
            value={filtroAtivo}
            onChange={(e) => mudarFiltro(() => setFiltroAtivo(e.target.value as 'todos' | 'ativos' | 'inativos'))}
          >
            <MenuItem value="ativos">Ativos</MenuItem>
            <MenuItem value="inativos">Inativos</MenuItem>
            <MenuItem value="todos">Todos</MenuItem>
          </TextField>
          <Autocomplete
            size="small"
            sx={{ width: 220 }}
            options={[{ id: SEM_PROMOTOR, nome: 'Sem promotor atribuído' }, ...promotores]}
            getOptionLabel={(option) => option.nome}
            loading={promotoresQuery.isLoading}
            value={
              filtroPromotorUuid === SEM_PROMOTOR
                ? { id: SEM_PROMOTOR, nome: 'Sem promotor atribuído' }
                : (promotores.find((p) => p.id === filtroPromotorUuid) ?? null)
            }
            isOptionEqualToValue={(a, b) => a.id === b.id}
            onChange={(_, value) => mudarFiltro(() => setFiltroPromotorUuid(value?.id ?? null))}
            renderInput={(params) => <TextField {...params} label="Promotor" placeholder="Todos os promotores" />}
          />
          <Autocomplete
            size="small"
            sx={{ width: 200 }}
            options={redes}
            getOptionLabel={(r) => r.descricao}
            loading={redesQuery.isLoading}
            value={redes.find((r) => r.id === filtroRedeUuid) ?? null}
            onChange={(_, r) => mudarFiltro(() => setFiltroRedeUuid(r?.id ?? null))}
            renderInput={(params) => <TextField {...params} label="Rede" placeholder="Todas as redes" />}
          />
          <TextField
            label="Cidade"
            size="small"
            sx={{ width: 160 }}
            value={cidade}
            onChange={(e) => mudarFiltro(() => setCidade(e.target.value))}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            label="Período por"
            size="small"
            sx={{ width: 170 }}
            value={dataCampo}
            onChange={(e) => mudarFiltro(() => setDataCampo(e.target.value as 'created_at' | 'updated_at'))}
          >
            <MenuItem value="created_at">Data de cadastro</MenuItem>
            <MenuItem value="updated_at">Última atualização</MenuItem>
          </TextField>
          <TextField
            type="date"
            label="De"
            size="small"
            value={dataInicio}
            onChange={(e) => mudarFiltro(() => setDataInicio(e.target.value))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            type="date"
            label="Até"
            size="small"
            value={dataFim}
            onChange={(e) => mudarFiltro(() => setDataFim(e.target.value))}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            select
            label="Ordenar"
            size="small"
            sx={{ width: 180 }}
            value={ordenar}
            onChange={(e) => mudarFiltro(() => setOrdenar(e.target.value as 'fantasia' | 'recentes'))}
          >
            <MenuItem value="fantasia">Fantasia (A–Z)</MenuItem>
            <MenuItem value="recentes">{dataCampo === 'created_at' ? 'Cadastro mais recente' : 'Atualização mais recente'}</MenuItem>
          </TextField>
          {temFiltro && (
            <Button size="small" startIcon={<FilterAltOffIcon />} onClick={limparFiltros}>
              Limpar filtros
            </Button>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {pdvQuery.data ? `${pdvQuery.data.meta.total} loja(s)` : ''}
          </Typography>
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
        </Box>
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

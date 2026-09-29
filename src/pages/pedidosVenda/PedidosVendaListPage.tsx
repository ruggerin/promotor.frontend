import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  LinearProgress,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { baixarCsv } from '../../lib/csv';
import { listarPedidosVenda, listarVendedoresPedidosVenda } from '../../lib/api/pedidosVenda';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import type { PedidoVenda, StatusPedidoVenda } from '../../types/api';
import { formatarDataHora } from '../planosAcao/statusPlanoAcao';
import { formatarMoeda, STATUS_PEDIDO_VENDA } from './statusPedidoVenda';

// "Aguardando autorização" é a view principal pra quem aprova (docs/38 §8).
type FiltroStatus = 'pendentes' | 'abertos' | 'concluidos' | 'cancelados' | 'todos';
const STATUS_POR_FILTRO: Record<FiltroStatus, StatusPedidoVenda[] | undefined> = {
  pendentes: ['PENDENTE_AUTORIZACAO'],
  abertos: ['RASCUNHO', 'PENDENTE_AUTORIZACAO', 'APROVADO'],
  concluidos: ['CONCLUIDO'],
  cancelados: ['CANCELADO'],
  todos: undefined,
};

// Lista de Pedidos de Venda tirados pelos vendedores no app — ver docs/38-PEDIDO-VENDEDOR.md §8.
export function PedidosVendaListPage() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('abertos');
  const [vendedorUuid, setVendedorUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [page, setPage] = useState(1);

  const filtros = {
    status: STATUS_POR_FILTRO[filtroStatus],
    vendedor_uuid: vendedorUuid ?? undefined,
    ponto_venda_uuid: pontoVendaUuid ?? undefined,
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
  };

  const query = useQuery({
    queryKey: ['pedidos-venda', filtros, page],
    queryFn: () => listarPedidosVenda({ ...filtros, page }),
    placeholderData: keepPreviousData,
  });
  const vendedoresQuery = useQuery({ queryKey: ['pedidos-venda', 'vendedores'], queryFn: listarVendedoresPedidosVenda });
  const lojasQuery = useQuery({
    queryKey: ['pontos-venda', 'seletor-pedido-venda'],
    queryFn: () => listarPontosVenda({ ativo: true, por_pagina: 200 }),
  });
  const vendedores = vendedoresQuery.data ?? [];
  const lojas = lojasQuery.data?.pontos_venda ?? [];

  // Exporta tudo que casa com o filtro (não só a página visível) — uma linha por item.
  const exportar = useMutation({
    mutationFn: () => listarPedidosVenda({ ...filtros, per_page: 500 }),
    onSuccess: (data) => {
      const linhas = data.pedidos_venda.flatMap((p) =>
        (p.itens ?? []).map((i) => [
          p.id,
          formatarDataHora(p.created_at),
          STATUS_PEDIDO_VENDA[p.status].label,
          p.vendedor?.nome ?? '',
          p.ponto_venda?.fantasia ?? '',
          p.ponto_venda?.cnpj ?? '',
          p.ponto_venda?.codigo_externo ?? '',
          i.produto?.descricao ?? '',
          i.produto?.codigo_externo ?? '',
          String(i.quantidade).replace('.', ','),
          i.preco_tabela.toFixed(2).replace('.', ','),
          i.preco.toFixed(2).replace('.', ','),
          i.subtotal.toFixed(2).replace('.', ','),
          i.requer_autorizacao ? 'Sim' : 'Não',
        ]),
      );
      baixarCsv(
        `pedidos-venda-${new Date().toISOString().slice(0, 10)}.csv`,
        [
          'Pedido', 'Criado em', 'Status', 'Vendedor', 'Loja', 'CNPJ', 'Código loja (ERP)', 'Produto',
          'Código produto (ERP)', 'Quantidade', 'Preço tabela', 'Preço', 'Subtotal', 'Abaixo do mínimo',
        ],
        linhas,
      );
    },
  });

  const pedidos = query.data?.pedidos_venda ?? [];
  const resumo = query.data?.resumo;
  const semPermissao = axios.isAxiosError(query.error) && query.error.response?.status === 403;

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Pedidos de Venda" />);

  function mudarFiltro(atualizar: () => void) {
    atualizar();
    setPage(1);
  }

  if (semPermissao) {
    return (
      <Box>
        {cabecalho}
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography color="text.secondary">
            Seu perfil não tem nenhuma permissão de "Pedidos de Venda". Peça a um administrador para incluí-la.
          </Typography>
        </Paper>
      </Box>
    );
  }

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Pedidos tirados pelos vendedores no app, durante a visita ou fora dela. Pedido com item abaixo do preço
          mínimo (tabela menos o desconto máximo do produto) só segue depois de autorizado aqui — e nunca por quem o
          criou.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={() => exportar.mutate()}
          disabled={exportar.isPending}
          sx={{ flexShrink: 0 }}
        >
          {exportar.isPending ? 'Exportando...' : 'Exportar CSV'}
        </Button>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <Kpi
          titulo="Aguardando autorização"
          valor={resumo?.pendentes_autorizacao}
          destaque={(resumo?.pendentes_autorizacao ?? 0) > 0}
          onClick={() => mudarFiltro(() => setFiltroStatus('pendentes'))}
        />
        <Kpi titulo="Aprovados (a concluir)" valor={resumo?.aprovados} />
        <Kpi titulo="Concluídos no mês" valor={resumo?.concluidos_mes} />
        <Kpi titulo="Valor concluído no mês" valor={resumo ? formatarMoeda(resumo.valor_concluido_mes) : undefined} />
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filtroStatus}
          onChange={(_, v: FiltroStatus | null) => v && mudarFiltro(() => setFiltroStatus(v))}
        >
          <ToggleButton value="pendentes">Aguardando autorização</ToggleButton>
          <ToggleButton value="abertos">Em aberto</ToggleButton>
          <ToggleButton value="concluidos">Concluídos</ToggleButton>
          <ToggleButton value="cancelados">Cancelados</ToggleButton>
          <ToggleButton value="todos">Todos</ToggleButton>
        </ToggleButtonGroup>
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          options={vendedores}
          getOptionLabel={(o) => o.nome}
          value={vendedores.find((v) => v.id === vendedorUuid) ?? null}
          onChange={(_, v) => mudarFiltro(() => setVendedorUuid(v?.id ?? null))}
          renderInput={(params) => <TextField {...params} label="Vendedor" />}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 220 }}
          options={lojas}
          getOptionLabel={(p) => p.fantasia}
          value={lojas.find((p) => p.id === pontoVendaUuid) ?? null}
          onChange={(_, p) => mudarFiltro(() => setPontoVendaUuid(p?.id ?? null))}
          renderInput={(params) => <TextField {...params} label="Loja" />}
        />
        <TextField
          size="small"
          type="date"
          label="De"
          value={dataInicio}
          onChange={(e) => mudarFiltro(() => setDataInicio(e.target.value))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          size="small"
          type="date"
          label="Até"
          value={dataFim}
          onChange={(e) => mudarFiltro(() => setDataFim(e.target.value))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </Paper>

      <TableContainer component={Paper}>
        {query.isFetching && !query.isLoading && <LinearProgress />}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Loja</TableCell>
              <TableCell>Vendedor</TableCell>
              <TableCell>Criado em</TableCell>
              <TableCell align="right">Itens</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {pedidos.length === 0 && !query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhum pedido encontrado.
                </TableCell>
              </TableRow>
            )}
            {pedidos.map((p) => (
              <LinhaPedido key={p.id} pedido={p} onAbrir={() => navigate(`/pedidos-venda/${p.id}`)} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {(query.data?.meta.last_page ?? 1) > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={query.data!.meta.last_page} page={page} onChange={(_, p) => setPage(p)} />
        </Box>
      )}
    </Box>
  );
}

function LinhaPedido({ pedido, onAbrir }: { pedido: PedidoVenda; onAbrir: () => void }) {
  const status = STATUS_PEDIDO_VENDA[pedido.status];

  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={onAbrir}>
      <TableCell sx={{ maxWidth: 280 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {pedido.ponto_venda?.fantasia ?? '—'}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {pedido.visita_id ? 'Tirado durante a visita' : 'Fora de visita'}
        </Typography>
      </TableCell>
      <TableCell>{pedido.vendedor?.nome ?? '—'}</TableCell>
      <TableCell>{formatarDataHora(pedido.created_at)}</TableCell>
      <TableCell align="right">{pedido.total_itens ?? '—'}</TableCell>
      <TableCell align="right" sx={{ fontWeight: 600 }}>
        {formatarMoeda(pedido.total)}
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Chip size="small" label={status.label} color={status.cor} />
          {pedido.requer_autorizacao && pedido.status !== 'CONCLUIDO' && pedido.status !== 'CANCELADO' && (
            <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} titleAccess="Tem item abaixo do preço mínimo" />
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
}

function Kpi({
  titulo,
  valor,
  destaque,
  onClick,
}: {
  titulo: string;
  valor?: number | string;
  destaque?: boolean;
  onClick?: () => void;
}) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{ p: 1.5, borderColor: destaque ? 'warning.main' : undefined, cursor: onClick ? 'pointer' : undefined }}
    >
      <Typography variant="caption" color="text.secondary">
        {titulo}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: destaque ? 'warning.dark' : undefined }}>
        {valor ?? '—'}
      </Typography>
    </Paper>
  );
}

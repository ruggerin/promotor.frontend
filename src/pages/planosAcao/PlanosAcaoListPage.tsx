import AddIcon from '@mui/icons-material/Add';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  Pagination,
  Paper,
  Switch,
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
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { listarPlanosAcao, listarResponsaveisPlanoAcao } from '../../lib/api/planosAcao';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { NovoPlanoAcaoDialog } from './NovoPlanoAcaoDialog';
import type { PlanoAcao, StatusPlanoAcao } from '../../types/api';
import { formatarDuracao, formatarHoras, formatarPrazo, STATUS_PLANO } from './statusPlanoAcao';

// Filtro rápido de status — "ativos" é o default (é o que pede ação); os outros pra consulta.
type FiltroStatus = 'ativos' | 'concluidos' | 'cancelados' | 'todos';
const STATUS_POR_FILTRO: Record<FiltroStatus, StatusPlanoAcao[] | undefined> = {
  ativos: ['ABERTO', 'EM_ANDAMENTO'],
  concluidos: ['CONCLUIDO'],
  cancelados: ['CANCELADO'],
  todos: undefined,
};

// Lista de Planos de Ação — tela própria, não dentro do Painel de Atividades: um plano vive
// dias/semanas, o painel é o feed do "agora". Ver docs/37-PLANOS-DE-ACAO.md §9.
export function PlanosAcaoListPage() {
  const navigate = useNavigate();
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('ativos');
  const [apenasAtrasados, setApenasAtrasados] = useState(false);
  const [responsavelUuid, setResponsavelUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [redeLojaUuid, setRedeLojaUuid] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [criando, setCriando] = useState(false);

  const filtros = {
    status: STATUS_POR_FILTRO[filtroStatus],
    atrasados: apenasAtrasados || undefined,
    responsavel_uuid: responsavelUuid ?? undefined,
    ponto_venda_uuid: pontoVendaUuid ?? undefined,
    rede_loja_uuid: redeLojaUuid ?? undefined,
    busca: busca.trim() || undefined,
    page,
  };

  const query = useQuery({
    queryKey: ['planos-acao', filtros],
    queryFn: () => listarPlanosAcao(filtros),
    placeholderData: keepPreviousData,
  });
  const responsaveisQuery = useQuery({ queryKey: ['planos-acao', 'responsaveis'], queryFn: listarResponsaveisPlanoAcao });
  const responsaveis = responsaveisQuery.data ?? [];
  const lojasQuery = useQuery({
    queryKey: ['pontos-venda', 'seletor-plano-acao'],
    queryFn: () => listarPontosVenda({ ativo: true, por_pagina: 200 }),
  });
  const redesQuery = useQuery({
    queryKey: ['redes-lojas', 'seletor-plano-acao'],
    queryFn: () => listarRedesLojas({ ativo: true, por_pagina: 200 }),
  });
  const lojas = lojasQuery.data?.pontos_venda ?? [];
  const redes = redesQuery.data?.redes_lojas ?? [];

  const planos = query.data?.planos_acao ?? [];
  const resumo = query.data?.resumo;
  const semPermissao = axios.isAxiosError(query.error) && query.error.response?.status === 403;

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Planos de Ação
    </Typography>,
  );

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
            Seu perfil não tem a permissão "Planos de Ação — visualizar". Peça a um administrador para incluí-la.
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
          Acompanhamento de problemas que precisam de várias etapas para serem resolvidos de verdade. Um plano
          nasce de um alerta no Painel de Atividades ("Abrir Plano de Ação") ou é criado aqui, ligado a uma
          loja, a uma rede ou a nada.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCriando(true)} sx={{ flexShrink: 0 }}>
          Novo plano de ação
        </Button>
      </Box>

      {/* KPIs — sempre da empresa inteira, independente dos filtros da tabela. */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, mb: 2 }}>
        <Kpi titulo="Em aberto" valor={resumo?.ativos} />
        <Kpi titulo="Atrasados" valor={resumo?.atrasados} destaque={(resumo?.atrasados ?? 0) > 0} />
        <Kpi titulo="Concluídos no mês" valor={resumo?.concluidos_mes} />
        <Kpi
          titulo="Tempo médio de resolução"
          valor={resumo ? formatarHoras(resumo.tempo_medio_resolucao_horas) : undefined}
          dica="Concluídos neste mês, da abertura à conclusão"
        />
      </Box>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filtroStatus}
          onChange={(_, v: FiltroStatus | null) => v && mudarFiltro(() => setFiltroStatus(v))}
        >
          <ToggleButton value="ativos">Em aberto</ToggleButton>
          <ToggleButton value="concluidos">Concluídos</ToggleButton>
          <ToggleButton value="cancelados">Cancelados</ToggleButton>
          <ToggleButton value="todos">Todos</ToggleButton>
        </ToggleButtonGroup>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={apenasAtrasados}
              onChange={(e) => mudarFiltro(() => setApenasAtrasados(e.target.checked))}
            />
          }
          label="Só atrasados"
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 240 }}
          options={responsaveis}
          getOptionLabel={(o) => o.nome}
          value={responsaveis.find((r) => r.id === responsavelUuid) ?? null}
          onChange={(_, v) => mudarFiltro(() => setResponsavelUuid(v?.id ?? null))}
          renderInput={(params) => <TextField {...params} label="Responsável (etapa em aberto)" />}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 200 }}
          options={lojas}
          getOptionLabel={(p) => p.fantasia}
          value={lojas.find((p) => p.id === pontoVendaUuid) ?? null}
          onChange={(_, p) => mudarFiltro(() => setPontoVendaUuid(p?.id ?? null))}
          renderInput={(params) => <TextField {...params} label="Loja" />}
        />
        <Autocomplete
          size="small"
          sx={{ minWidth: 180 }}
          options={redes}
          getOptionLabel={(r) => r.descricao}
          value={redes.find((r) => r.id === redeLojaUuid) ?? null}
          onChange={(_, r) => mudarFiltro(() => setRedeLojaUuid(r?.id ?? null))}
          renderInput={(params) => <TextField {...params} label="Rede" title="Inclui os planos das lojas da rede" />}
        />
        <TextField
          size="small"
          label="Buscar título"
          value={busca}
          onChange={(e) => mudarFiltro(() => setBusca(e.target.value))}
          sx={{ minWidth: 200 }}
        />
      </Paper>

      <TableContainer component={Paper}>
        {query.isFetching && !query.isLoading && <LinearProgress />}
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Plano</TableCell>
              <TableCell>Origem</TableCell>
              <TableCell>Progresso</TableCell>
              <TableCell>Etapa atual</TableCell>
              <TableCell>Prazo</TableCell>
              <TableCell>Aberto há</TableCell>
              <TableCell>Status</TableCell>
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
            {planos.length === 0 && !query.isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Nenhum plano de ação encontrado.
                </TableCell>
              </TableRow>
            )}
            {planos.map((p) => (
              <LinhaPlano key={p.id} plano={p} onAbrir={() => navigate(`/planos-acao/${p.id}`)} />
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {(query.data?.meta.last_page ?? 1) > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination count={query.data!.meta.last_page} page={page} onChange={(_, p) => setPage(p)} />
        </Box>
      )}

      <NovoPlanoAcaoDialog open={criando} onClose={() => setCriando(false)} />
    </Box>
  );
}

function LinhaPlano({ plano, onAbrir }: { plano: PlanoAcao; onAbrir: () => void }) {
  const resumo = plano.etapas_resumo;
  const atual = plano.etapa_atual;
  const responsavelAtual = atual?.responsavel?.nome ?? atual?.responsavel_externo_nome ?? null;
  const fim = plano.concluido_em ?? plano.cancelado_em;

  return (
    <TableRow hover sx={{ cursor: 'pointer' }} onClick={onAbrir}>
      <TableCell sx={{ maxWidth: 280 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {plano.titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          por {plano.criado_por?.nome ?? '—'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" noWrap>
          {plano.origem
            ? `${plano.origem.tipo_registro?.descricao ?? 'Alerta'}${plano.origem.produto ? ` · ${plano.origem.produto}` : ''}`
            : 'Criado manualmente'}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {plano.ponto_venda
            ? `Loja: ${plano.ponto_venda.fantasia}`
            : plano.rede_loja
              ? `Rede: ${plano.rede_loja.descricao}`
              : ''}
        </Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 120 }}>
        {resumo && (
          <>
            <LinearProgress
              variant="determinate"
              value={resumo.total ? (resumo.feitas / resumo.total) * 100 : 0}
              sx={{ height: 6, borderRadius: 3, mb: 0.5 }}
            />
            <Typography variant="caption" color="text.secondary">
              {resumo.feitas}/{resumo.total} etapas
              {resumo.bloqueadas > 0 && ` · ${resumo.bloqueadas} bloqueada(s)`}
            </Typography>
          </>
        )}
      </TableCell>
      <TableCell sx={{ maxWidth: 240 }}>
        {atual ? (
          <>
            <Typography variant="body2" noWrap>
              {atual.ordem}. {atual.titulo}
            </Typography>
            {responsavelAtual && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {responsavelAtual}
              </Typography>
            )}
          </>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {plano.atrasado && <WarningAmberIcon color="error" sx={{ fontSize: 16 }} titleAccess="Atrasado" />}
          <Typography variant="body2" color={plano.atrasado ? 'error' : undefined}>
            {formatarPrazo(plano.prazo)}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>{formatarDuracao(plano.created_at, fim)}</TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          <Chip size="small" label={STATUS_PLANO[plano.status].label} color={STATUS_PLANO[plano.status].cor} />
          {plano.atrasado && <Chip size="small" label="Atrasado" color="error" variant="outlined" />}
        </Box>
      </TableCell>
    </TableRow>
  );
}

function Kpi({ titulo, valor, destaque, dica }: { titulo: string; valor?: number | string; destaque?: boolean; dica?: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderColor: destaque ? 'error.light' : undefined }} title={dica}>
      <Typography variant="caption" color="text.secondary">
        {titulo}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: destaque ? 'error.main' : undefined }}>
        {valor ?? '—'}
      </Typography>
    </Paper>
  );
}

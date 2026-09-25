import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import PrintIcon from '@mui/icons-material/Print';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link as RouterLink } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { ZoomComCtrl } from '../../components/mapa/ZoomComCtrl';
import {
  atualizarAgendaVisita,
  baixarRelatorioRota,
  criarAgendaVisita,
  desativarAgendaVisita,
  listarAgendasVisita,
  type AgendasVisitaListResponse,
} from '../../lib/api/agendasVisita';
import { hojeISO } from '../../components/relatorios/FiltroPeriodo';
import { buscarOmitirDomingoPlanejador, buscarOmitirSabadoPlanejador } from '../../lib/api/parametros';
import { buscarVisitasPlanejadasXExecutadas } from '../../lib/api/relatorios';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { AgendaVisita, PontoVenda } from '../../types/api';
import { AgendaVisitaFormDialog } from '../agendasVisita/AgendaVisitaFormDialog';

// 0 (domingo) a 6 (sábado) — mesma convenção de dia_semana no backend (ver
// docs/10-AGENDA-VISITA.md). `cor` é só visual (mapa/legenda/impressão), sem correspondente no
// banco. Domingo/sábado podem ser omitidos por parâmetro — ver diasVisiveis.
const DIAS = [
  { valor: 0, curto: 'Dom', label: 'Domingo', cor: '#ef4444' },
  { valor: 1, curto: 'Seg', label: 'Segunda', cor: '#4f46e5' },
  { valor: 2, curto: 'Ter', label: 'Terça', cor: '#0ea5e9' },
  { valor: 3, curto: 'Qua', label: 'Quarta', cor: '#10b981' },
  { valor: 4, curto: 'Qui', label: 'Quinta', cor: '#f59e0b' },
  { valor: 5, curto: 'Sex', label: 'Sexta', cor: '#8b5cf6' },
  { valor: 6, curto: 'Sáb', label: 'Sábado', cor: '#ec4899' },
];

const COR_SEM_ROTA = '#9ca3af';
const LIMITE_SUGERIDO_POR_LOJA = 3;
// Sentinela do filtro do mapa pro chip "Sem rota" — fora da faixa real de dia_semana (0-6), ver
// diaFiltro/MapaRota.
const FILTRO_SEM_ROTA = -1;

// Endereço composto a partir do que a loja tiver preenchido — usado no popup do mapa e no
// relatório de impressão. Nenhum campo é obrigatório no cadastro do PDV, então filtra vazio.
function enderecoCompleto(pdv: PontoVenda): string {
  const partes = [
    pdv.numero ? `${pdv.endereco}, ${pdv.numero}` : pdv.endereco,
    pdv.bairro,
    pdv.cidade,
    pdv.cep,
  ].filter((parte): parte is string => !!parte && parte.trim().length > 0);
  return partes.length > 0 ? partes.join(' — ') : 'Endereço não cadastrado';
}

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return (partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '');
}

type Arraste = { tipo: 'loja'; pontoVendaId: string } | { tipo: 'agenda'; agendaId: string };

export function PlanejadorVisitasPage() {
  const queryClient = useQueryClient();
  const [promotorUuid, setPromotorUuid] = useState<string | null>(null);
  const [arraste, setArraste] = useState<Arraste | null>(null);
  const [diaSobre, setDiaSobre] = useState<number | null>(null);
  const [emEdicao, setEmEdicao] = useState<AgendaVisita | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; severidade: 'success' | 'warning' | 'error' } | null>(null);
  // Filtro do "Mapa da rota" — clicar num chip da legenda isola só aquele dia (ou só quem não
  // tem rota ainda, ver FILTRO_SEM_ROTA); clicar de novo no mesmo volta a mostrar tudo. `null` =
  // sem filtro.
  const [diaFiltroMapa, setDiaFiltroMapa] = useState<number | null>(null);

  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores', 'planejador-visitas'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', ativo: true, por_pagina: 200 }),
  });
  const promotores = promotoresQuery.data?.usuarios ?? [];

  useEffect(() => {
    if (!promotorUuid && promotores.length > 0) setPromotorUuid(promotores[0].id);
  }, [promotorUuid, promotores]);

  // Troca de promotor limpa o filtro do mapa — um dia isolado do promotor anterior não faz
  // sentido continuar aplicado depois de trocar quem está sendo visto.
  useEffect(() => {
    setDiaFiltroMapa(null);
  }, [promotorUuid]);

  const carteiraQuery = useQuery({
    queryKey: ['pontos-venda', 'carteira-promotor', promotorUuid],
    queryFn: () => listarPontosVenda({ promotor_uuid: promotorUuid as string, ativo: true, por_pagina: 200 }),
    enabled: !!promotorUuid,
  });
  const carteira = useMemo(() => carteiraQuery.data?.pontos_venda ?? [], [carteiraQuery.data]);

  // Extraída pra variável (em vez de escrita solta no useQuery) porque as três mutations abaixo
  // (criar/mover/remover) precisam apontar pra exatamente esta mesma chave — é nela que fazem o
  // update otimista via setQueryData, não só invalidar depois.
  const agendaQueryKey = ['agendas-visita', 'planejador-visitas', promotorUuid] as const;

  const agendaQuery = useQuery({
    queryKey: agendaQueryKey,
    queryFn: () => listarAgendasVisita({ usuario_uuid: promotorUuid as string, ativo: true, por_pagina: 200 }),
    enabled: !!promotorUuid,
  });
  // Cumprimento real dos últimos 7 dias do promotor (relatório de docs/28 §2.1, planejado ×
  // executado) — o quadro planeja a rota, esse KPI mostra se ela está sendo cumprida.
  const cumprimentoQuery = useQuery({
    queryKey: ['relatorio-visitas-planejadas', 'planejador', promotorUuid],
    queryFn: () =>
      buscarVisitasPlanejadasXExecutadas({ data_inicio: hojeISO(-6), data_fim: hojeISO(), usuario_uuid: promotorUuid }),
    enabled: !!promotorUuid,
  });
  // O quadro só mostra (e só mexe em) a rota fixa — recorrência SEMANAL. Visita avulsa (data
  // específica) continua exclusivamente na tela "Agenda de Visita" (modo lista/formulário).
  const agendaSemanal = useMemo(
    () => (agendaQuery.data?.agendas_visita ?? []).filter((a) => a.recorrencia === 'SEMANAL'),
    [agendaQuery.data],
  );

  const porLoja = useMemo(() => {
    const mapa = new Map<string, AgendaVisita[]>();
    for (const a of agendaSemanal) {
      if (!a.ponto_venda) continue;
      const lista = mapa.get(a.ponto_venda.id) ?? [];
      lista.push(a);
      mapa.set(a.ponto_venda.id, lista);
    }
    return mapa;
  }, [agendaSemanal]);

  const porDia = useMemo(() => {
    const mapa = new Map<number, AgendaVisita[]>();
    for (const a of agendaSemanal) {
      if (a.dia_semana === null) continue;
      const lista = mapa.get(a.dia_semana) ?? [];
      lista.push(a);
      mapa.set(a.dia_semana, lista);
    }
    return mapa;
  }, [agendaSemanal]);

  const semAgenda = useMemo(() => carteira.filter((pdv) => (porLoja.get(pdv.id)?.length ?? 0) === 0), [carteira, porLoja]);
  const comMultiplasVisitas = carteira.filter((pdv) => (porLoja.get(pdv.id)?.length ?? 0) >= 2).length;
  const cobertura = carteira.length > 0 ? Math.round(((carteira.length - semAgenda.length) / carteira.length) * 100) : 0;

  // Painel "Lojas Vinculadas" — mostra a carteira inteira (não só quem está sem rota), pra dar
  // pra adicionar uma 2ª/3ª visita numa loja que já tem alguma; sem isso a loja simplesmente
  // sumia da lista depois da primeira visita, sem jeito de arrastar/adicionar outro dia.
  const [filtroCarteira, setFiltroCarteira] = useState<'TODAS' | 'COM_ROTA' | 'SEM_ROTA'>('TODAS');
  // Busca por texto do painel — a lupa abre um campo que cobre o cabeçalho (mesmo padrão de
  // caixa de pesquisa de app mobile), pra não gastar uma linha fixa de espaço com o campo.
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [buscaLoja, setBuscaLoja] = useState('');
  const carteiraFiltrada = useMemo(() => {
    let lista = carteira;
    if (filtroCarteira === 'SEM_ROTA') lista = lista.filter((pdv) => (porLoja.get(pdv.id)?.length ?? 0) === 0);
    if (filtroCarteira === 'COM_ROTA') lista = lista.filter((pdv) => (porLoja.get(pdv.id)?.length ?? 0) > 0);
    const termo = buscaLoja.trim().toLowerCase();
    if (termo) {
      lista = lista.filter((pdv) =>
        [pdv.fantasia, pdv.razao_social, pdv.bairro, pdv.codigo_externo].some((campo) => campo?.toLowerCase().includes(termo)),
      );
    }
    return lista;
  }, [carteira, porLoja, filtroCarteira, buscaLoja]);

  // Domingo/sábado somem do quadro, do mapa e da impressão quando o parâmetro da empresa está
  // ligado — ausente/inativo = mostra os 7 dias (default conservador). Ver
  // docs/10-AGENDA-VISITA.md §8.
  const omitirDomingoQuery = useQuery({
    queryKey: ['parametros', 'omitir-domingo-planejador'],
    queryFn: buscarOmitirDomingoPlanejador,
  });
  const omitirSabadoQuery = useQuery({
    queryKey: ['parametros', 'omitir-sabado-planejador'],
    queryFn: buscarOmitirSabadoPlanejador,
  });
  const diasVisiveis = useMemo(
    () => DIAS.filter((d) => !(d.valor === 0 && omitirDomingoQuery.data) && !(d.valor === 6 && omitirSabadoQuery.data)),
    [omitirDomingoQuery.data, omitirSabadoQuery.data],
  );

  // As três mutations abaixo seguem o mesmo formato — onMutate escreve o resultado esperado
  // direto no cache (setQueryData) ANTES da resposta da API chegar, onError desfaz voltando pra
  // foto de antes (contexto.anterior), onSettled reconcilia com o servidor no final (sucesso ou
  // erro). Sem isso, arrastar uma loja só refletia na tela depois do round-trip completo —
  // travava a experiência por causa do invalidate+refetch acontecer só no onSuccess.
  async function congelarAgendaAtual() {
    await queryClient.cancelQueries({ queryKey: agendaQueryKey });
    return queryClient.getQueryData<AgendasVisitaListResponse>(agendaQueryKey);
  }
  function reconciliar() {
    void queryClient.invalidateQueries({ queryKey: agendaQueryKey });
  }

  const criarMutation = useMutation({
    mutationFn: (variaveis: { pontoVenda: PontoVenda; dia: number }) =>
      criarAgendaVisita({
        ponto_venda_uuid: variaveis.pontoVenda.id,
        usuario_uuid: promotorUuid as string,
        recorrencia: 'SEMANAL',
        dia_semana: variaveis.dia,
      }),
    onMutate: async (variaveis) => {
      const anterior = await congelarAgendaAtual();
      // Guardado aqui (em vez de lido de `porLoja` no onSuccess) porque, por essa hora, o cache
      // já foi escrito com o item otimista abaixo — ler `porLoja` no onSuccess contaria a visita
      // nova duas vezes.
      const jaTinha = porLoja.get(variaveis.pontoVenda.id)?.length ?? 0;

      const otimista: AgendaVisita = {
        id: `temp-${crypto.randomUUID()}`,
        ponto_venda: { id: variaveis.pontoVenda.id, fantasia: variaveis.pontoVenda.fantasia },
        usuario: { id: promotorSelecionado!.id, nome: promotorSelecionado!.nome },
        tipo_visita: null,
        objetivo_visita: null,
        prioridade: 'MEDIA',
        recorrencia: 'SEMANAL',
        dia_semana: variaveis.dia,
        data: null,
        horario_previsto: null,
        obrigatoria: false,
        ativo: true,
        observacao: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      queryClient.setQueryData<AgendasVisitaListResponse | undefined>(agendaQueryKey, (atual) =>
        atual ? { ...atual, agendas_visita: [...atual.agendas_visita, otimista] } : atual,
      );

      return { anterior, jaTinha };
    },
    onSuccess: (_dados, variaveis, contexto) => {
      const diaLabel = DIAS.find((d) => d.valor === variaveis.dia)?.label ?? '';
      const jaTinha = contexto?.jaTinha ?? 0;
      setAviso(
        jaTinha + 1 > LIMITE_SUGERIDO_POR_LOJA
          ? { texto: `${variaveis.pontoVenda.fantasia} já passou de ${LIMITE_SUGERIDO_POR_LOJA} visitas na semana — confira se é isso mesmo.`, severidade: 'warning' }
          : { texto: `${variaveis.pontoVenda.fantasia} agendada — toda ${diaLabel}.`, severidade: 'success' },
      );
    },
    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(agendaQueryKey, contexto.anterior);
      setAviso({ texto: 'Não foi possível agendar essa visita agora.', severidade: 'error' });
    },
    onSettled: reconciliar,
  });

  const moverMutation = useMutation({
    mutationFn: (variaveis: { agenda: AgendaVisita; dia: number }) =>
      atualizarAgendaVisita(variaveis.agenda.id, { dia_semana: variaveis.dia }),
    onMutate: async (variaveis) => {
      const anterior = await congelarAgendaAtual();
      queryClient.setQueryData<AgendasVisitaListResponse | undefined>(agendaQueryKey, (atual) =>
        atual
          ? {
              ...atual,
              agendas_visita: atual.agendas_visita.map((a) =>
                a.id === variaveis.agenda.id ? { ...a, dia_semana: variaveis.dia } : a,
              ),
            }
          : atual,
      );
      return { anterior };
    },
    onError: (_erro, _variaveis, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(agendaQueryKey, contexto.anterior);
      setAviso({ texto: 'Não foi possível mover essa visita agora.', severidade: 'error' });
    },
    onSettled: reconciliar,
  });

  const removerMutation = useMutation({
    mutationFn: (agenda: AgendaVisita) => desativarAgendaVisita(agenda.id),
    onMutate: async (agenda) => {
      const anterior = await congelarAgendaAtual();
      queryClient.setQueryData<AgendasVisitaListResponse | undefined>(agendaQueryKey, (atual) =>
        atual ? { ...atual, agendas_visita: atual.agendas_visita.filter((a) => a.id !== agenda.id) } : atual,
      );
      return { anterior };
    },
    onSuccess: (_dados, agenda) => {
      setAviso({ texto: `Visita removida de ${agenda.ponto_venda?.fantasia ?? 'PDV'}.`, severidade: 'success' });
    },
    onError: (_erro, _agenda, contexto) => {
      if (contexto?.anterior) queryClient.setQueryData(agendaQueryKey, contexto.anterior);
      setAviso({ texto: 'Não foi possível remover essa visita agora.', severidade: 'error' });
    },
    onSettled: reconciliar,
  });

  // Relatório de Rota impresso (PDF gerado no backend, ver docs/10-AGENDA-VISITA.md §9) — rota
  // autenticada, não dá pra abrir num <a href> direto (não manda o Authorization). Baixa como
  // blob e dispara o salvamento via um <a download> temporário, mesma técnica de sempre pra
  // arquivo autenticado que precisa virar download de verdade (não só exibição inline).
  const imprimirRotaMutation = useMutation({
    mutationFn: (usuarioUuid: string) => baixarRelatorioRota(usuarioUuid),
    onSuccess: (blob, usuarioUuid) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const nomePromotor = promotores.find((p) => p.id === usuarioUuid)?.nome ?? 'promotor';
      link.download = `rota-visita-${nomePromotor.toLowerCase().replace(/\s+/g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: () => setAviso({ texto: 'Não foi possível gerar o relatório de rota agora.', severidade: 'error' }),
  });

  function soltarEm(dia: number) {
    setDiaSobre(null);
    if (!arraste) return;
    if (arraste.tipo === 'loja') {
      const pdv = carteira.find((p) => p.id === arraste.pontoVendaId);
      if (pdv) criarMutation.mutate({ pontoVenda: pdv, dia });
    } else {
      const agenda = agendaSemanal.find((a) => a.id === arraste.agendaId);
      if (agenda && agenda.dia_semana !== dia) moverMutation.mutate({ agenda, dia });
    }
    setArraste(null);
  }

  const promotorSelecionado = promotores.find((p) => p.id === promotorUuid) ?? null;
  const carregando = promotoresQuery.isLoading || (!!promotorUuid && (carteiraQuery.isLoading || agendaQuery.isLoading));

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Planejador de Visitas
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Monte a rota fixa semanal do promotor arrastando lojas da carteira para os dias — a mesma
        loja aceita quantas visitas na semana forem necessárias. Isso edita direto a{' '}
        <RouterLink to="/agendas-visita">Agenda de Visita</RouterLink> recorrente dele; visita
        avulsa numa data específica continua sendo cadastrada por lá.
      </Typography>

      {aviso && (
        <Alert severity={aviso.severidade} sx={{ mb: 2 }} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      {promotoresQuery.isError && <Alert severity="error">Não foi possível carregar os promotores.</Alert>}

      {!promotoresQuery.isLoading && promotores.length === 0 && (
        <Alert severity="info">Nenhum promotor ativo cadastrado ainda.</Alert>
      )}

      {promotores.length > 0 && (
        <Paper sx={{ p: 1.5, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
            PROMOTOR
          </Typography>
          {promotores.map((p) => (
            <Chip
              key={p.id}
              onClick={() => setPromotorUuid(p.id)}
              avatar={<Avatar sx={{ fontSize: 11, fontWeight: 700 }}>{iniciais(p.nome).toUpperCase()}</Avatar>}
              label={p.nome}
              color={p.id === promotorUuid ? 'primary' : 'default'}
              variant={p.id === promotorUuid ? 'filled' : 'outlined'}
            />
          ))}
          {promotorSelecionado && (
            <Button
              size="small"
              startIcon={imprimirRotaMutation.isPending ? <CircularProgress size={14} /> : <PrintIcon />}
              sx={{ ml: 'auto' }}
              disabled={imprimirRotaMutation.isPending}
              onClick={() => imprimirRotaMutation.mutate(promotorSelecionado.id)}
            >
              {imprimirRotaMutation.isPending ? 'Gerando...' : 'Imprimir rota'}
            </Button>
          )}
        </Paper>
      )}

      {carregando && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!carregando && promotorSelecionado && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1.5, mb: 2 }}>
            <KpiCard label="Visitas na rota" valor={agendaSemanal.length} />
            <KpiCard
              label="Lojas cobertas"
              valor={`${carteira.length - semAgenda.length}/${carteira.length}`}
              destaque={cobertura === 100 ? 'success' : 'warning'}
              hint={`${cobertura}%`}
            />
            <KpiCard
              label="Sem agendamento"
              valor={semAgenda.length}
              destaque={semAgenda.length > 0 ? 'error' : 'success'}
              hint={semAgenda.length > 0 ? 'exige ação' : 'tudo ok'}
            />
            <KpiCard label="Lojas com 2+ visitas" valor={comMultiplasVisitas} destaque="info" />
            <KpiCard
              label="Cumprimento (7 dias)"
              valor={
                cumprimentoQuery.data?.total.percentual_cumprimento == null
                  ? '—'
                  : `${cumprimentoQuery.data.total.percentual_cumprimento}%`
              }
              hint={
                cumprimentoQuery.data
                  ? `${cumprimentoQuery.data.total.cumpridas}/${cumprimentoQuery.data.total.planejadas} cumpridas`
                  : undefined
              }
              destaque={
                cumprimentoQuery.data?.total.percentual_cumprimento == null
                  ? undefined
                  : cumprimentoQuery.data.total.percentual_cumprimento >= 90
                    ? 'success'
                    : cumprimentoQuery.data.total.percentual_cumprimento >= 60
                      ? 'warning'
                      : 'error'
              }
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <Box
              sx={{
                flex: '1 1 640px',
                minWidth: 0,
                display: 'grid',
                gridTemplateColumns: `repeat(${diasVisiveis.length}, minmax(130px, 1fr))`,
                gap: 1,
                overflowX: 'auto',
                pb: 0.5,
              }}
            >
              {diasVisiveis.map((dia) => {
                const visitas = (porDia.get(dia.valor) ?? []).slice().sort((a, b) => (a.ponto_venda?.fantasia ?? '').localeCompare(b.ponto_venda?.fantasia ?? ''));
                const sobre = diaSobre === dia.valor;
                return (
                  <Box
                    key={dia.valor}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (diaSobre !== dia.valor) setDiaSobre(dia.valor);
                    }}
                    onDragLeave={() => setDiaSobre((atual) => (atual === dia.valor ? null : atual))}
                    onDrop={(e) => {
                      e.preventDefault();
                      soltarEm(dia.valor);
                    }}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                      minHeight: 320,
                      p: 1,
                      borderRadius: 2,
                      border: '1.5px dashed transparent',
                      bgcolor: sobre ? 'primary.50' : 'background.paper',
                      borderColor: sobre ? 'primary.main' : 'divider',
                      borderStyle: sobre ? 'dashed' : 'solid',
                      transition: 'background-color .12s ease, border-color .12s ease',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        {dia.curto}
                      </Typography>
                      <Chip label={visitas.length} size="small" sx={{ height: 18, fontSize: 11 }} />
                    </Box>

                    {visitas.map((v) => {
                      return (
                        <Paper
                          key={v.id}
                          draggable
                          onDragStart={() => setArraste({ tipo: 'agenda', agendaId: v.id })}
                          variant="outlined"
                          sx={{
                            p: 1,
                            cursor: 'grab',
                            borderLeft: '3px solid',
                            borderLeftColor: v.tipo_visita?.cor ?? 'grey.400',
                          }}
                        >
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
                              {v.ponto_venda?.fantasia}
                            </Typography>
                            {/* onMouseDown com stopPropagation — sem isso, o navegador às vezes
                                interpreta o clique num botão dentro de um card draggable como
                                início de arraste em vez de clique, e o onClick nunca dispara. */}
                            <Box sx={{ display: 'flex', flexShrink: 0, alignItems: 'center' }} onMouseDown={(e) => e.stopPropagation()}>
                              <Tooltip title="Editar detalhes">
                                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => setEmEdicao(v)}>
                                  <EditIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remover">
                                <IconButton size="small" sx={{ p: 0.25 }} onClick={() => removerMutation.mutate(v)}>
                                  <CloseIcon sx={{ fontSize: 13 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                            {v.horario_previsto && (
                              <Chip label={v.horario_previsto} size="small" sx={{ height: 16, fontSize: 10 }} />
                            )}
                            {v.tipo_visita && <Chip label={v.tipo_visita.descricao} size="small" sx={{ height: 16, fontSize: 10 }} />}
                          </Box>
                        </Paper>
                      );
                    })}

                    {visitas.length === 0 && (
                      <Box
                        sx={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 2,
                          minHeight: 90,
                          p: 1,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                          Solte uma loja aqui
                        </Typography>
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>

            <Box sx={{ flex: '1 1 300px', minWidth: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
                <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', position: 'relative' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Lojas Vinculadas
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Chip label={carteiraFiltrada.length} size="small" />
                      <Tooltip title="Buscar loja">
                        <IconButton size="small" onClick={() => setBuscaAberta(true)}>
                          <SearchIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                 
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {(
                      [
                        { valor: 'TODAS', rotulo: `Todas (${carteira.length})` },
                        { valor: 'COM_ROTA', rotulo: `Com rota (${carteira.length - semAgenda.length})` },
                        { valor: 'SEM_ROTA', rotulo: `Sem rota (${semAgenda.length})` },
                      ] as const
                    ).map((opcao) => (
                      <Chip
                        key={opcao.valor}
                        label={opcao.rotulo}
                        size="small"
                        onClick={() => setFiltroCarteira(opcao.valor)}
                        color={filtroCarteira === opcao.valor ? 'primary' : 'default'}
                        variant={filtroCarteira === opcao.valor ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>

                  {/* Campo de busca por cima do cabeçalho inteiro (título + filtros) — não ocupa
                      linha própria, só aparece quando a lupa é tocada; fechar limpa o termo. */}
                  {buscaAberta && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'background.paper',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        px: 1.5,
                        zIndex: 1,
                      }}
                    >
                      <TextField
                        autoFocus
                        fullWidth
                        size="small"
                        placeholder="Buscar loja, bairro ou código"
                        value={buscaLoja}
                        onChange={(e) => setBuscaLoja(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setBuscaLoja('');
                            setBuscaAberta(false);
                          }
                        }}
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
                      <IconButton
                        size="small"
                        title="Fechar busca"
                        onClick={() => {
                          setBuscaLoja('');
                          setBuscaAberta(false);
                        }}
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                <Stack sx={{ maxHeight: 420, overflowY: 'auto', p: 1.25, gap: 1 }}>
                  {carteiraFiltrada.map((pdv) => {
                    const diasComVisita = new Set((porLoja.get(pdv.id) ?? []).map((a) => a.dia_semana));
                    return (
                      <Paper
                        key={pdv.id}
                        draggable
                        onDragStart={() => setArraste({ tipo: 'loja', pontoVendaId: pdv.id })}
                        variant="outlined"
                        sx={{ p: 1, cursor: 'grab' }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }} noWrap>
                          {pdv.fantasia}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {pdv.rede_loja?.descricao ?? 'Independente'} · {pdv.cidade}
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.75 }}>
                          {diasVisiveis.map((dia) => {
                            const jaTem = diasComVisita.has(dia.valor);
                            return (
                              <Tooltip key={dia.valor} title={jaTem ? `Já agendada toda ${dia.label}` : `Agendar toda ${dia.label}`}>
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={jaTem}
                                    sx={{
                                      fontSize: 10,
                                      fontWeight: 700,
                                      borderRadius: 1,
                                      px: 0.75,
                                      py: 0.25,
                                      bgcolor: jaTem ? 'primary.main' : 'action.hover',
                                      color: jaTem ? 'primary.contrastText' : 'text.primary',
                                      '&.Mui-disabled': { color: jaTem ? 'primary.contrastText' : undefined, bgcolor: jaTem ? 'primary.main' : undefined },
                                    }}
                                    onClick={() => criarMutation.mutate({ pontoVenda: pdv, dia: dia.valor })}
                                  >
                                    {dia.curto[0]}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            );
                          })}
                        </Box>
                      </Paper>
                    );
                  })}
                  {carteiraFiltrada.length === 0 && carteira.length > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      Nenhuma loja neste filtro.
                    </Typography>
                  )}
                  {carteira.length === 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                      Este promotor ainda não tem loja vinculada.
                    </Typography>
                  )}
                </Stack>
              </Paper>
            </Box>
          </Box>

          <Paper variant="outlined" sx={{ mt: 2, p: 1.5, '@media print': { display: 'none' } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 1, mb: 1 }}>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  Mapa da rota
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Cor = dia da semana agendado. Cinza = loja sem rota ainda. Clique numa cor pra
                  isolar só aquele dia no mapa (com a sequência sugerida) — clique de novo pra
                  voltar a ver tudo. Segure Ctrl e role o mouse sobre o mapa pra dar zoom.
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {diasVisiveis.map((dia) => {
                  const selecionado = diaFiltroMapa === dia.valor;
                  return (
                    <Chip
                      key={dia.valor}
                      size="small"
                      label={`${dia.label} (${(porDia.get(dia.valor) ?? []).length})`}
                      onClick={() => setDiaFiltroMapa((atual) => (atual === dia.valor ? null : dia.valor))}
                      sx={{
                        bgcolor: dia.cor,
                        color: '#fff',
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: diaFiltroMapa !== null && !selecionado ? 0.4 : 1,
                        outline: selecionado ? '2px solid #111827' : 'none',
                        outlineOffset: 1,
                      }}
                    />
                  );
                })}
                <Chip
                  size="small"
                  label={`Sem rota (${semAgenda.length})`}
                  onClick={() => setDiaFiltroMapa((atual) => (atual === FILTRO_SEM_ROTA ? null : FILTRO_SEM_ROTA))}
                  sx={{
                    bgcolor: COR_SEM_ROTA,
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    opacity: diaFiltroMapa !== null && diaFiltroMapa !== FILTRO_SEM_ROTA ? 0.4 : 1,
                    outline: diaFiltroMapa === FILTRO_SEM_ROTA ? '2px solid #111827' : 'none',
                    outlineOffset: 1,
                  }}
                />
              </Box>
            </Box>
            <MapaRota carteira={carteira} porLoja={porLoja} diaFiltro={diaFiltroMapa} />
          </Paper>
        </>
      )}

      <AgendaVisitaFormDialog open={emEdicao !== null} agendaVisita={emEdicao} onClose={() => setEmEdicao(null)} />
    </Box>
  );
}

function corDoPdv(pdvId: string, porLoja: Map<string, AgendaVisita[]>): string {
  const dias = new Set((porLoja.get(pdvId) ?? []).map((a) => a.dia_semana));
  const primeiro = DIAS.find((d) => dias.has(d.valor));
  return primeiro?.cor ?? COR_SEM_ROTA;
}

// Pin "gota" via CSS (quadrado arredondado + rotação) — evita o problema clássico de Leaflet
// com bundlers (o ícone padrão quebra porque o Vite não resolve os caminhos de imagem do pacote
// automaticamente); como é tudo desenhado em HTML/CSS, esse problema nem aparece aqui.
// `sempreMostrar` diferencia os dois significados que o badge pode ter: contagem semanal (só
// aparece se >1, ex. "2x/sem") quando o mapa mostra a carteira inteira, ou sequência sugerida da
// rota (sempre aparece, mesmo "1") quando um dia específico está isolado — ver diaFiltro.
function iconePin(cor: string, badge: number, sempreMostrar: boolean): L.DivIcon {
  const mostrar = sempreMostrar || badge > 1;
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${cor};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);transform:rotate(-45deg);display:flex;align-items:center;justify-content:center">${
      mostrar ? `<span style="transform:rotate(45deg);color:#fff;font-size:10px;font-weight:700">${badge}</span>` : ''
    }</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

// Reenquadra o mapa quando a carteira muda (troca de promotor, por exemplo) — MapContainer só
// aceita center/zoom fixos na criação, então precisa do useMap() pra mexer na instância depois.
function AjustarLimites({ pontos }: { pontos: [number, number][] }) {
  const mapa = useMap();
  useEffect(() => {
    if (pontos.length === 0) return;
    if (pontos.length === 1) {
      mapa.setView(pontos[0], 14);
      return;
    }
    mapa.fitBounds(pontos, { padding: [32, 32] });
  }, [mapa, pontos]);
  return null;
}

function MapaRota({
  carteira,
  porLoja,
  diaFiltro,
}: {
  carteira: PontoVenda[];
  porLoja: Map<string, AgendaVisita[]>;
  // Dia isolado pela legenda (0-6), FILTRO_SEM_ROTA, ou null (mostra tudo) — ver diaFiltroMapa.
  diaFiltro: number | null;
}) {
  // Com um dia específico isolado, a ordem também vira a sequência sugerida da rota (por
  // horário previsto; quem não tem horário vai pro fim, por nome) — sem isso, "colocar a
  // sequência" não teria uma ordem estável pra numerar.
  const carteiraFiltrada = useMemo(() => {
    if (diaFiltro === null) return carteira;
    if (diaFiltro === FILTRO_SEM_ROTA) {
      return carteira.filter((pdv) => (porLoja.get(pdv.id)?.length ?? 0) === 0);
    }
    return carteira
      .filter((pdv) => (porLoja.get(pdv.id) ?? []).some((a) => a.dia_semana === diaFiltro))
      .sort((a, b) => {
        const horarioA = porLoja.get(a.id)?.find((ag) => ag.dia_semana === diaFiltro)?.horario_previsto ?? null;
        const horarioB = porLoja.get(b.id)?.find((ag) => ag.dia_semana === diaFiltro)?.horario_previsto ?? null;
        if (horarioA && horarioB) return horarioA.localeCompare(horarioB);
        if (horarioA) return -1;
        if (horarioB) return 1;
        return a.fantasia.localeCompare(b.fantasia);
      });
  }, [carteira, porLoja, diaFiltro]);

  const pontos = useMemo<[number, number][]>(
    () => carteiraFiltrada.map((pdv) => [pdv.latitude, pdv.longitude]),
    [carteiraFiltrada],
  );
  const mostrandoSequencia = diaFiltro !== null && diaFiltro !== FILTRO_SEM_ROTA;

  if (carteira.length === 0) {
    return (
      <Box sx={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Nenhuma loja na carteira pra mostrar no mapa.
        </Typography>
      </Box>
    );
  }

  if (carteiraFiltrada.length === 0) {
    return (
      <Box sx={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover', borderRadius: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Nenhuma loja nesse filtro.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: 380, borderRadius: 1, overflow: 'hidden' }}>
      {/* scrollWheelZoom desligado por padrão (rolar a página com o mouse em cima do mapa não
          pode virar zoom sem querer) e ligado enquanto Ctrl/Cmd está pressionado — ver
          ZoomComCtrl. Os controles +/- do próprio Leaflet continuam disponíveis sempre. */}
      <MapContainer center={pontos[0]} zoom={12} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <AjustarLimites pontos={pontos} />
        <ZoomComCtrl />
        {carteiraFiltrada.map((pdv, indice) => {
          const dias = (porLoja.get(pdv.id) ?? []).slice().sort((a, b) => (a.dia_semana ?? 0) - (b.dia_semana ?? 0));
          const badge = mostrandoSequencia ? indice + 1 : dias.length;
          return (
            <Marker
              key={pdv.id}
              position={[pdv.latitude, pdv.longitude]}
              icon={iconePin(corDoPdv(pdv.id, porLoja), badge, mostrandoSequencia)}
            >
              <Popup>
                {mostrandoSequencia && (
                  <>
                    <strong>{indice + 1}ª parada</strong>
                    <br />
                  </>
                )}
                <strong>{pdv.fantasia}</strong>
                <br />
                {enderecoCompleto(pdv)}
                <br />
                {dias.length > 0
                  ? dias
                      .map((a) => `${DIAS.find((d) => d.valor === a.dia_semana)?.label}${a.horario_previsto ? ` (${a.horario_previsto})` : ''}`)
                      .join(', ')
                  : 'Sem rota fixa ainda'}
                <br />
                {pdv.sortimento_count ?? '—'} produto(s) no mix
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </Box>
  );
}

function KpiCard({
  label,
  valor,
  hint,
  destaque,
}: {
  label: string;
  valor: string | number;
  hint?: string;
  destaque?: 'success' | 'warning' | 'error' | 'info';
}) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5 }}>
      <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {valor}
        </Typography>
        {hint && (
          <Typography variant="caption" sx={{ fontWeight: 700, color: destaque ? `${destaque}.main` : 'text.secondary' }}>
            {hint}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

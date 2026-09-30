import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Popover,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { useNavigate } from 'react-router-dom';
import { GaleriaDialog } from '../../components/fotos/GaleriaDialog';
import type { FotoComRegistro } from '../../components/fotos/tipos';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { buscarResumoAtividades, listarAtividades, resolverAlerta } from '../../lib/api/atividades';
import { buscarPollingAtividadesMs } from '../../lib/api/parametros';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { AtividadeEvento } from '../../types/api';
import { NovoPlanoAcaoDialog, type AlertaOrigem } from '../planosAcao/NovoPlanoAcaoDialog';
import { ColunaLateral } from './ColunaLateral';
import { LinhaChegada, LinhaComentario, PostAlerta, PostFormulario, PostSaida, type AcoesFeed } from './FeedItens';
import { agruparPorDia, datasDoPreset, ROTULO_PERIODO, rotuloDoDia, type PresetPeriodo } from './feedUtil';

type Vista = 'tudo' | 'pendentes' | 'com_foto';
type FiltroEntidade = 'periodo' | 'promotor' | 'loja' | 'tipo';

// Painel de Atividades — feed único, cronológico, "com jeito de grupo": cada acontecimento tem um
// peso visual diferente (chegada = linha de sistema, alerta = post grande com conversa embutida),
// coluna lateral com "Em loja agora"/"Precisa de você", e o que chega de novo não empurra o que
// você está lendo (pílula "↑ N novas atividades"). Referência visual: protótipo
// docs/"Painel de atividades— revisão de UX.html" (v2). Ver docs/43-REVISAO-UX-PAINEL-ATIVIDADES.md
// e docs/19-PAINEL-ATIVIDADES.md.
export function AtividadesPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [preset, setPreset] = useState<PresetPeriodo>('hoje_ontem');
  const [periodo, setPeriodo] = useState(() => datasDoPreset('hoje_ontem'));
  const [usuarioUuid, setUsuarioUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [tipoRegistroUuid, setTipoRegistroUuid] = useState<string | null>(null);
  const [vista, setVista] = useState<Vista>('tudo');
  const [edicao, setEdicao] = useState<{ tipo: FiltroEntidade; anchorEl: HTMLElement } | null>(null);
  const [galeria, setGaleria] = useState<{ fotos: FotoComRegistro[]; indice: number } | null>(null);
  const [alertaPlano, setAlertaPlano] = useState<AlertaOrigem | null>(null);
  const telaLarga = useMediaQuery((theme) => theme.breakpoints.up('lg'));
  const [lateralAberta, setLateralAberta] = useState(false);

  const usuariosQuery = useQuery({ queryKey: ['usuarios', 'promotores'], queryFn: () => listarUsuarios({ user_type: 'PROMOTOR' }) });
  const pontosVendaQuery = useQuery({
    queryKey: ['pontos-venda', 'filtro-atividades'],
    queryFn: () => listarPontosVenda({ ativo: true, por_pagina: 200 }),
  });
  const tiposRegistroQuery = useQuery({ queryKey: ['tipos-registro', 'filtro'], queryFn: () => listarTiposRegistro() });
  const pollingQuery = useQuery({ queryKey: ['parametros', 'atividades-polling'], queryFn: buscarPollingAtividadesMs });
  const pollingMs = pollingQuery.data ?? 30_000;

  const promotorSelecionado = usuariosQuery.data?.usuarios.find((u) => u.id === usuarioUuid);
  const lojaSelecionada = pontosVendaQuery.data?.pontos_venda.find((p) => p.id === pontoVendaUuid);
  const tipoSelecionado = tiposRegistroQuery.data?.tipos_registro.find((t) => t.id === tipoRegistroUuid);

  const filtros = {
    data_inicio: periodo.inicio || undefined,
    data_fim: periodo.fim || undefined,
    usuario_uuid: usuarioUuid ?? undefined,
    ponto_venda_uuid: pontoVendaUuid ?? undefined,
    tipo_registro_uuid: tipoRegistroUuid ?? undefined,
    pendentes: vista === 'pendentes' || undefined,
    com_foto: vista === 'com_foto' || undefined,
  };

  // O feed carregado é uma "foto": não recarrega sozinho (recarregar empurraria o que você está
  // lendo). Quem faz polling é a consulta de novidades abaixo, só da 1ª página.
  const eventosQuery = useInfiniteQuery({
    queryKey: ['atividades', filtros],
    queryFn: ({ pageParam }) => listarAtividades({ ...filtros, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (pagina) => (pagina.meta.current_page < pagina.meta.last_page ? pagina.meta.current_page + 1 : undefined),
  });
  const eventos = useMemo(() => eventosQuery.data?.pages.flatMap((p) => p.eventos) ?? [], [eventosQuery.data]);

  const novidadesQuery = useQuery({
    queryKey: ['atividades-novidades', filtros],
    queryFn: () => listarAtividades({ ...filtros, page: 1 }),
    refetchInterval: pollingMs,
    enabled: !eventosQuery.isLoading,
  });
  const novas = useMemo(() => {
    const vistos = new Set(eventos.map((e) => e.id));
    const maisRecente = eventos[0]?.ocorrido_em;
    return (novidadesQuery.data?.eventos ?? []).filter(
      (e) => !vistos.has(e.id) && (!maisRecente || new Date(e.ocorrido_em) >= new Date(maisRecente)),
    ).length;
  }, [novidadesQuery.data, eventos]);

  const resumoQuery = useQuery({
    queryKey: ['atividades-resumo', periodo.inicio, periodo.fim],
    queryFn: () => buscarResumoAtividades({ data_inicio: periodo.inicio, data_fim: periodo.fim }),
    refetchInterval: pollingMs,
  });
  const resumo = resumoQuery.data;
  const requerResolucao = resumo?.requer_resolucao ?? false;

  function mostrarNovas() {
    // Volta pra 1ª página (descarta as páginas antigas carregadas) e sobe pro topo.
    void queryClient.resetQueries({ queryKey: ['atividades', filtros] });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function recarregarTudo() {
    void queryClient.invalidateQueries({ queryKey: ['atividades'] });
    void queryClient.invalidateQueries({ queryKey: ['atividades-novidades'] });
    void queryClient.invalidateQueries({ queryKey: ['atividades-resumo'] });
  }

  const resolverMutation = useMutation({
    mutationFn: ({ visitaUuid, registroUuid }: { visitaUuid: string; registroUuid: string }) => resolverAlerta(visitaUuid, registroUuid),
    onSuccess: recarregarTudo,
  });

  const acoes: AcoesFeed = {
    requerResolucao,
    resolvendo: resolverMutation.isPending,
    onResolver: (visitaUuid, registroUuid) => resolverMutation.mutate({ visitaUuid, registroUuid }),
    onAbrirPlano: (e) =>
      e.registro &&
      setAlertaPlano({
        registroUuid: e.registro.id,
        tipo: e.registro.tipo_registro.descricao,
        produto: e.registro.produto_auditoria?.descricao,
        pontoVenda: e.ponto_venda?.fantasia,
        observacao: e.registro.observacao,
      }),
    onAbrirFotos: (fotos, indice) => setGaleria({ fotos, indice }),
  };

  // "Precisa de você" → rola até o card do alerta se ele está no feed; senão abre a visita.
  function abrirAlerta(registroId: string, visitaId: string) {
    setLateralAberta(false);
    const el = document.getElementById(`evento-alerta:${registroId}`);
    if (!el) {
      navigate(`/visitas/${visitaId}`);
      return;
    }
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    el.animate([{ outline: '3px solid #4f46e5', outlineOffset: '4px' }, { outline: '3px solid transparent', outlineOffset: '4px' }], {
      duration: 1600,
      easing: 'ease-out',
    });
  }

  const cabecalho = usePageHeader(
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        Atividades
      </Typography>
      <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13, color: '#15803d', fontWeight: 500 }}>
        <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#16a34a', display: 'block' }} />
        Ao vivo · atualiza sozinho
      </Box>
    </Box>,
  );

  const pill = (rotulo: string, ativo: boolean, tipo: FiltroEntidade) => (
    <Button
      onClick={(e) => setEdicao({ tipo, anchorEl: e.currentTarget })}
      endIcon={<KeyboardArrowDownIcon sx={{ fontSize: '16px !important' }} />}
      sx={{
        height: 36,
        px: 1.75,
        borderRadius: 99,
        textTransform: 'none',
        fontSize: 14,
        fontWeight: ativo ? 600 : 400,
        color: ativo ? '#3730a3' : '#1a1830',
        bgcolor: ativo ? '#eef0ff' : '#fff',
        border: '1px solid',
        borderColor: ativo ? '#c7cbff' : '#d9d7e6',
        '&:hover': { bgcolor: ativo ? '#e3e6ff' : '#f7f6fb' },
      }}
    >
      {rotulo}
    </Button>
  );

  return (
    // Fundo levemente pontilhado — reforça o "jeito de grupo" (só nesta tela, docs/43 §6 decisão 6).
    <Box
      sx={{
        mx: { xs: -1.5, sm: -3 },
        mb: { xs: -1.5, sm: -3 },
        px: { xs: 1.5, sm: 3 },
        pb: 6,
        minHeight: 'calc(100vh - 64px)',
        bgcolor: '#f1eff6',
        backgroundImage: 'radial-gradient(#e0dcec 1.1px, transparent 1.1px)',
        backgroundSize: '22px 22px',
      }}
    >
      {cabecalho}

      {/* Bloco central — feed + lateral com largura de rede social, centralizado na tela. */}
      <Box sx={{ maxWidth: 1080, mx: 'auto' }}>
      {/* Filtros — no celular viram uma faixa que rola de lado, em vez de quebrar em 3 linhas. */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          flexWrap: { xs: 'nowrap', md: 'wrap' },
          overflowX: { xs: 'auto', md: 'visible' },
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
          '& > *': { flexShrink: 0 },
          pt: 0.5,
          pb: 2,
        }}
      >
        <Button
          onClick={(e) => setEdicao({ tipo: 'periodo', anchorEl: e.currentTarget })}
          startIcon={<CalendarTodayOutlinedIcon sx={{ fontSize: '16px !important' }} />}
          variant="contained"
          disableElevation
          sx={{ height: 36, px: 1.75, borderRadius: 99, textTransform: 'none', fontSize: 14, fontWeight: 500 }}
        >
          {preset === 'personalizado'
            ? `${periodo.inicio.split('-').reverse().join('/')} – ${periodo.fim.split('-').reverse().join('/')}`
            : ROTULO_PERIODO[preset]}
        </Button>
        {pill(promotorSelecionado ? promotorSelecionado.nome : 'Promotor', !!promotorSelecionado, 'promotor')}
        {pill(lojaSelecionada ? lojaSelecionada.fantasia : 'Loja', !!lojaSelecionada, 'loja')}
        {pill(tipoSelecionado ? tipoSelecionado.descricao : 'Tipo de registro', !!tipoSelecionado, 'tipo')}
        {(promotorSelecionado || lojaSelecionada || tipoSelecionado) && (
          <Button
            size="small"
            onClick={() => {
              setUsuarioUuid(null);
              setPontoVendaUuid(null);
              setTipoRegistroUuid(null);
            }}
            sx={{ textTransform: 'none' }}
          >
            Limpar filtros
          </Button>
        )}
        <Box sx={{ width: '1px', height: 24, bgcolor: '#e4e3ee', mx: 0.5 }} />
        <ToggleButtonGroup
          exclusive
          value={vista}
          onChange={(_, v: Vista | null) => v && setVista(v)}
          sx={{
            p: '3px',
            borderRadius: 99,
            bgcolor: '#e9e7f2',
            '& .MuiToggleButton-root': {
              border: 0,
              borderRadius: '99px !important',
              height: 30,
              px: 1.75,
              textTransform: 'none',
              fontSize: 13,
              color: '#1a1830',
              gap: 0.75,
            },
            '& .Mui-selected': { bgcolor: '#fff !important', fontWeight: 600, boxShadow: '0 1px 2px rgba(20,18,50,0.14)' },
          }}
        >
          <ToggleButton value="tudo">Tudo</ToggleButton>
          {requerResolucao && (
            <ToggleButton value="pendentes">
              Pendentes
              {(resumo?.alertas.total ?? 0) > 0 && (
                <Box component="span" sx={{ minWidth: 18, height: 18, px: 0.6, borderRadius: 99, bgcolor: '#dc2626', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  {resumo!.alertas.total}
                </Box>
              )}
            </ToggleButton>
          )}
          <ToggleButton value="com_foto">Com foto</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Popover open={!!edicao} anchorEl={edicao?.anchorEl} onClose={() => setEdicao(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
        {edicao?.tipo === 'periodo' && (
          <Box sx={{ p: 1.5, width: 260, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {(['hoje', 'hoje_ontem', '7_dias'] as const).map((p) => (
              <Button
                key={p}
                onClick={() => {
                  setPreset(p);
                  setPeriodo(datasDoPreset(p));
                  setEdicao(null);
                }}
                sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: preset === p ? 700 : 400 }}
              >
                {ROTULO_PERIODO[p]}
              </Button>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ px: 1, pt: 1 }}>
              Personalizado
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, p: 1 }}>
              <TextField
                label="De"
                type="date"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={periodo.inicio}
                onChange={(e) => {
                  setPreset('personalizado');
                  setPeriodo((atual) => ({ ...atual, inicio: e.target.value }));
                }}
              />
              <TextField
                label="Até"
                type="date"
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                value={periodo.fim}
                onChange={(e) => {
                  setPreset('personalizado');
                  setPeriodo((atual) => ({ ...atual, fim: e.target.value }));
                }}
              />
            </Box>
          </Box>
        )}
        {edicao?.tipo === 'promotor' && (
          <Box sx={{ p: 2, width: 280 }}>
            <Autocomplete
              openOnFocus
              options={usuariosQuery.data?.usuarios ?? []}
              getOptionLabel={(o) => o.nome}
              value={promotorSelecionado ?? null}
              onChange={(_, v) => {
                setUsuarioUuid(v?.id ?? null);
                setEdicao(null);
              }}
              renderInput={(params) => <TextField {...params} label="Promotor" size="small" autoFocus />}
            />
          </Box>
        )}
        {edicao?.tipo === 'loja' && (
          <Box sx={{ p: 2, width: 300 }}>
            <Autocomplete
              openOnFocus
              options={pontosVendaQuery.data?.pontos_venda ?? []}
              getOptionLabel={(o) => o.fantasia}
              value={lojaSelecionada ?? null}
              onChange={(_, v) => {
                setPontoVendaUuid(v?.id ?? null);
                setEdicao(null);
              }}
              renderInput={(params) => <TextField {...params} label="Loja" size="small" autoFocus />}
            />
          </Box>
        )}
        {edicao?.tipo === 'tipo' && (
          <Box sx={{ p: 2, width: 280 }}>
            <Autocomplete
              openOnFocus
              options={tiposRegistroQuery.data?.tipos_registro ?? []}
              groupBy={(o) => (o.eh_alerta ? 'Alertas' : 'Formulários')}
              getOptionLabel={(o) => o.descricao}
              value={tipoSelecionado ?? null}
              onChange={(_, v) => {
                setTipoRegistroUuid(v?.id ?? null);
                setEdicao(null);
              }}
              renderInput={(params) => <TextField {...params} label="Tipo de registro" size="small" autoFocus />}
            />
          </Box>
        )}
      </Popover>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 700px) 340px' },
          justifyContent: 'center',
          gap: { xs: 2, lg: 4 },
          alignItems: 'start',
        }}
      >
        {/* Feed */}
        <Box component="main" sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, minWidth: 0 }}>
          {novas > 0 && (
            <Box sx={{ position: 'sticky', top: { xs: 68, sm: 76 }, zIndex: 3, display: 'flex', justifyContent: 'center', height: 0, overflow: 'visible' }}>
              <Button
                variant="contained"
                disableElevation
                onClick={mostrarNovas}
                sx={{ height: 34, borderRadius: 99, textTransform: 'none', fontWeight: 600, fontSize: 13, px: 2, boxShadow: '0 4px 12px rgba(79,70,229,0.30)' }}
              >
                ↑ {novas} {novas === 1 ? 'nova atividade' : 'novas atividades'}
              </Button>
            </Box>
          )}

          {eventosQuery.isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <CircularProgress />
            </Box>
          )}
          {eventosQuery.isError && (
            <Typography color="error" variant="body2">
              Não foi possível carregar o feed — você pode não ter permissão para isto, ou houve um problema de conexão.
            </Typography>
          )}
          {!eventosQuery.isLoading && !eventosQuery.isError && eventos.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 6, color: '#5b5873' }}>Nada por aqui ainda pros filtros escolhidos.</Box>
          )}

          <InfiniteScroll
            dataLength={eventos.length}
            next={() => void eventosQuery.fetchNextPage()}
            hasMore={eventosQuery.hasNextPage}
            scrollThreshold="300px"
            loader={
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            }
            style={{ overflow: 'visible' }}
          >
            {agruparPorDia(eventos).map((grupo) => {
              const dia = rotuloDoDia(grupo.eventos[0].ocorrido_em);
              return (
                <Box key={grupo.chave} sx={{ display: 'flex', flexDirection: 'column', gap: 1.75, mb: 1.75 }}>
                  {/* Separador de dia — pílula centralizada, grudada no topo ao rolar (64px = AppBar). */}
                  <Box sx={{ position: 'sticky', top: { xs: 56, sm: 64 }, zIndex: 2, display: 'flex', justifyContent: 'center', pt: 2, pb: 0.5 }}>
                    <Box sx={{ px: 1.75, py: 0.75, borderRadius: 99, bgcolor: '#fff', border: '1px solid #e7e5f0', fontSize: 13, fontWeight: 600 }}>
                      {dia.destaque}
                      {dia.resto && (
                        <Box component="span" sx={{ color: '#5b5873', fontWeight: 400 }}>
                          {' · '}
                          {dia.resto}
                        </Box>
                      )}
                    </Box>
                  </Box>
                  {grupo.eventos.map((evento) => (
                    <ItemFeed key={evento.id} evento={evento} acoes={acoes} />
                  ))}
                </Box>
              );
            })}
          </InfiniteScroll>
        </Box>

        {/* Coluna lateral — no desktop largo gruda ao rolar; abaixo disso vira um resumo
            recolhível em cima do feed (a coluna inteira empurrava o feed pra baixo da dobra). */}
        {telaLarga ? (
          <Box component="aside" sx={{ position: 'sticky', top: 80, pt: 2 }}>
            <ColunaLateral resumo={resumo} onAbrirAlerta={abrirAlerta} />
          </Box>
        ) : (
          <Box component="aside" sx={{ order: -1 }}>
            <Button
              fullWidth
              onClick={() => setLateralAberta((a) => !a)}
              endIcon={<KeyboardArrowDownIcon sx={{ transform: lateralAberta ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
              sx={{
                justifyContent: 'space-between',
                textTransform: 'none',
                color: '#1a1830',
                bgcolor: '#fff',
                border: '1px solid #e7e5f0',
                borderRadius: 1.5,
                px: 2,
                py: 1.25,
                fontSize: 14,
                '&:hover': { bgcolor: '#faf9fd' },
              }}
            >
              <Box component="span" sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#16a34a' }} />
                  <b>{resumo?.em_loja.length ?? 0}</b> em loja
                </Box>
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#dc2626' }} />
                  <b>{(resumo?.alertas.total ?? 0) + (resumo?.respostas_novas ?? 0)}</b> precisam de você
                </Box>
              </Box>
            </Button>
            <Collapse in={lateralAberta} unmountOnExit>
              <Box sx={{ pt: 1.5 }}>
                <ColunaLateral resumo={resumo} onAbrirAlerta={abrirAlerta} />
              </Box>
            </Collapse>
          </Box>
        )}
      </Box>
      </Box>

      {galeria && (
        <GaleriaDialog
          fotos={galeria.fotos}
          indice={galeria.indice}
          onNavegar={(i) => setGaleria({ fotos: galeria.fotos, indice: i })}
          onClose={() => setGaleria(null)}
        />
      )}

      <NovoPlanoAcaoDialog
        open={!!alertaPlano}
        alerta={alertaPlano}
        onClose={() => {
          setAlertaPlano(null);
          recarregarTudo();
        }}
      />
    </Box>
  );
}

function ItemFeed({ evento, acoes }: { evento: AtividadeEvento; acoes: AcoesFeed }) {
  switch (evento.tipo_evento) {
    case 'VISITA_INICIADA':
      return <LinhaChegada evento={evento} />;
    case 'VISITA_FINALIZADA':
      return <PostSaida evento={evento} acoes={acoes} />;
    case 'ALERTA':
      return evento.registro ? <PostAlerta evento={evento} acoes={acoes} /> : null;
    case 'FORMULARIO':
      return evento.registros?.length ? <PostFormulario evento={evento} acoes={acoes} /> : null;
    case 'COMENTARIO':
      return evento.comentario ? <LinhaComentario evento={evento} /> : null;
    default:
      return null;
  }
}

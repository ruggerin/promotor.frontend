import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import RoomIcon from '@mui/icons-material/Room';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControlLabel,
  Link as MuiLink,
  Paper,
  Popover,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState, useEffect } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Link as RouterLink } from 'react-router-dom';
import { GaleriaDialog } from '../../components/fotos/GaleriaDialog';
import { MosaicoImagens } from '../../components/fotos/MosaicoImagens';
import { achatarFotos, type FotoComRegistro } from '../../components/fotos/tipos';
import { MdiIcon } from '../../components/MdiIcon';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { listarAtividades, resolverAlerta } from '../../lib/api/atividades';
import { labelDoDia } from '../../lib/datas';
import { buscarAlertaRequerResolucao, buscarPollingAtividadesMs } from '../../lib/api/parametros';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { AtividadeEvento } from '../../types/api';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarData(iso: string): string {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

// Filtro em pill (Atividades.dc.html) — mesmo espírito do padrão em chip da Galeria de Fotos
// (docs/23-GALERIA-DE-FOTOS.md §5.1), só que aqui o período é sempre visível (não removível —
// a rotina sempre parte de uma janela de datas) e só 3 filtros de entidade existem.
type FiltroAtividade = 'periodo' | 'promotor' | 'ponto_venda' | 'tipo_alerta';

// Timeline única (check-in/checkout/alertas), estilo feed de rede social — avatar + conteúdo do
// evento (mosaico de fotos, mapinha do check-in) + link pro detalhe — pensada pra substituir o
// grupo de WhatsApp que o gestor usa hoje. Ver docs/19-PAINEL-ATIVIDADES.md.
export function AtividadesPage() {
  const queryClient = useQueryClient();
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [usuarioUuid, setUsuarioUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [tipoRegistroUuid, setTipoRegistroUuid] = useState<string | null>(null);
  const [apenasPendentes, setApenasPendentes] = useState(false);
  const [edicao, setEdicao] = useState<{ tipo: FiltroAtividade; anchorEl: HTMLElement } | null>(null);
  // Galeria aberta ao clicar numa foto — compartilhada entre todos os cards, guarda as fotos
  // (achatadas — ver achatarFotos) daquele evento específico + o índice atual (pra navegar
  // prev/próxima e mostrar a informação do registro junto da imagem).
  const [galeria, setGaleria] = useState<{ fotos: FotoComRegistro[]; indice: number } | null>(null);

  const usuariosQuery = useQuery({
    queryKey: ['usuarios', 'promotores'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR' }),
  });
  const pontosVendaQuery = useQuery({ queryKey: ['pontos-venda', 'filtro'], queryFn: () => listarPontosVenda() });
  const tiposRegistroQuery = useQuery({ queryKey: ['tipos-registro', 'filtro'], queryFn: () => listarTiposRegistro() });
  // Só tipos marcados como alerta fazem sentido aqui — check-in/checkout não carregam
  // tipo_registro nenhum, filtrar por um tipo comum sempre voltaria vazio.
  const tiposAlerta = useMemo(
    () => (tiposRegistroQuery.data?.tipos_registro ?? []).filter((t) => t.eh_alerta),
    [tiposRegistroQuery.data],
  );
  // Objeto selecionado (não só o uuid) — precisa do rótulo pra mostrar no pill do filtro
  // ("Promotor: João"), não só pra montar o payload da query.
  const promotorSelecionado = usuariosQuery.data?.usuarios.find((u) => u.id === usuarioUuid);
  const pontoVendaSelecionado = pontosVendaQuery.data?.pontos_venda.find((p) => p.id === pontoVendaUuid);
  const tipoAlertaSelecionado = tiposAlerta.find((t) => t.id === tipoRegistroUuid);

  const pollingQuery = useQuery({ queryKey: ['parametros', 'atividades-polling'], queryFn: buscarPollingAtividadesMs });
  const requerResolucaoQuery = useQuery({
    queryKey: ['parametros', 'atividades-requer-resolucao'],
    queryFn: buscarAlertaRequerResolucao,
  });
  const requerResolucao = requerResolucaoQuery.data ?? false;
  const pollingMs = pollingQuery.data ?? 30_000;

  const filtros = {
    data_inicio: dataInicio || undefined,
    data_fim: dataFim || undefined,
    usuario_uuid: usuarioUuid ?? undefined,
    ponto_venda_uuid: pontoVendaUuid ?? undefined,
    tipo_registro_uuid: tipoRegistroUuid ?? undefined,
    pendentes: apenasPendentes || undefined,
  };

  const eventosQuery = useInfiniteQuery({
    queryKey: ['atividades', filtros],
    queryFn: ({ pageParam }) => listarAtividades({ ...filtros, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (paginaAtual) =>
      paginaAtual.meta.current_page < paginaAtual.meta.last_page ? paginaAtual.meta.current_page + 1 : undefined,
    // Só atualiza sozinho enquanto o usuário ainda está só na primeira página — depois que ele
    // rola e carrega mais, o polling recarregaria TODAS as páginas já carregadas a cada
    // intervalo, o oposto de "não sobrecarregar o backend". Passa a depender só do botão de
    // recarregar manual a partir daí.
    refetchInterval: (query) => ((query.state.data?.pages.length ?? 1) <= 1 ? pollingMs : false),
  });
  const eventos = useMemo(() => eventosQuery.data?.pages.flatMap((pagina) => pagina.eventos) ?? [], [eventosQuery.data]);

  const resolverMutation = useMutation({
    mutationFn: ({ visitaUuid, registroUuid }: { visitaUuid: string; registroUuid: string }) =>
      resolverAlerta(visitaUuid, registroUuid),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['atividades'] }),
  });

  // Título da página — vai pro header (docs/24-TEMA-ADMIN-WEB.md), não a descrição (essa
  // continua no corpo, junto do botão de recarregar — só o título some do corpo pra ganhar
  // aquela linha de espaço vertical).
  const cabecalho = usePageHeader(
    <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
      Atividades
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      {/* "Ao vivo" + Atualizar — mesma peça do handoff de design (Atividades.dc.html), só que
          sem o h1 ao lado (esse já foi pro header, ver docs/24-TEMA-ADMIN-WEB.md). */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            fontSize: 12.5,
            fontWeight: 600,
            color: '#15803d',
            bgcolor: '#eafaf0',
            border: '1px solid #c9ecd8',
            borderRadius: 99,
            px: 1.75,
            py: 0.85,
          }}
        >
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e' }} />
          Ao vivo · atualiza a cada {Math.round(pollingMs / 1000)}s
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={eventosQuery.isFetching ? <CircularProgress size={14} /> : <RefreshIcon fontSize="small" />}
          disabled={eventosQuery.isFetching}
          onClick={() => void eventosQuery.refetch()}
        >
          Atualizar
        </Button>
      </Box>

      {/* Barra de filtros em pill — mesmo visual do handoff de design: período sempre visível
          (indigo, não removível) + um botão por filtro de entidade, que abre um popover com o
          Autocomplete. Mesmo padrão em chip já usado na Galeria de Fotos (doc 23 §5.1). */}
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 1,
          mb: 2,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 3.5,
          p: 1.5,
        }}
      >
        <Chip
          label={`${formatarData(dataInicio)} – ${formatarData(dataFim)}`}
          color="primary"
          onClick={(e) => setEdicao({ tipo: 'periodo', anchorEl: e.currentTarget })}
        />
        <Chip
          label={promotorSelecionado ? `Promotor: ${promotorSelecionado.nome}` : 'Promotor'}
          variant={promotorSelecionado ? 'filled' : 'outlined'}
          color={promotorSelecionado ? 'primary' : 'default'}
          onClick={(e) => setEdicao({ tipo: 'promotor', anchorEl: e.currentTarget })}
          onDelete={promotorSelecionado ? () => setUsuarioUuid(null) : undefined}
        />
        <Chip
          label={pontoVendaSelecionado ? `Ponto de venda: ${pontoVendaSelecionado.fantasia}` : 'Ponto de venda'}
          variant={pontoVendaSelecionado ? 'filled' : 'outlined'}
          color={pontoVendaSelecionado ? 'primary' : 'default'}
          onClick={(e) => setEdicao({ tipo: 'ponto_venda', anchorEl: e.currentTarget })}
          onDelete={pontoVendaSelecionado ? () => setPontoVendaUuid(null) : undefined}
        />
        <Chip
          label={tipoAlertaSelecionado ? `Tipo de alerta: ${tipoAlertaSelecionado.descricao}` : 'Tipo de alerta'}
          variant={tipoAlertaSelecionado ? 'filled' : 'outlined'}
          color={tipoAlertaSelecionado ? 'primary' : 'default'}
          onClick={(e) => setEdicao({ tipo: 'tipo_alerta', anchorEl: e.currentTarget })}
          onDelete={tipoAlertaSelecionado ? () => setTipoRegistroUuid(null) : undefined}
        />
        <Box sx={{ flex: 1, minWidth: 8 }} />
        {requerResolucao && (
          <FormControlLabel
            sx={{ mr: 0 }}
            control={<Switch checked={apenasPendentes} onChange={(e) => setApenasPendentes(e.target.checked)} />}
            label="Só pendentes"
          />
        )}
      </Box>

      <Popover
        open={!!edicao}
        anchorEl={edicao?.anchorEl}
        onClose={() => setEdicao(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {edicao?.tipo === 'periodo' && (
          <Box sx={{ p: 2, width: 260, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Data início"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <TextField
              label="Data fim"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </Box>
        )}
        {edicao?.tipo === 'promotor' && (
          <Box sx={{ p: 2, width: 260 }}>
            <Autocomplete
              openOnFocus
              options={usuariosQuery.data?.usuarios ?? []}
              getOptionLabel={(option) => option.nome}
              loading={usuariosQuery.isLoading}
              value={promotorSelecionado ?? null}
              onChange={(_, value) => {
                setUsuarioUuid(value?.id ?? null);
                if (value) setEdicao(null);
              }}
              renderInput={(params) => <TextField {...params} label="Promotor" size="small" autoFocus />}
            />
          </Box>
        )}
        {edicao?.tipo === 'ponto_venda' && (
          <Box sx={{ p: 2, width: 280 }}>
            <Autocomplete
              openOnFocus
              options={pontosVendaQuery.data?.pontos_venda ?? []}
              getOptionLabel={(option) => option.fantasia}
              loading={pontosVendaQuery.isLoading}
              value={pontoVendaSelecionado ?? null}
              onChange={(_, value) => {
                setPontoVendaUuid(value?.id ?? null);
                if (value) setEdicao(null);
              }}
              renderInput={(params) => <TextField {...params} label="Ponto de venda" size="small" autoFocus />}
            />
          </Box>
        )}
        {edicao?.tipo === 'tipo_alerta' && (
          <Box sx={{ p: 2, width: 260 }}>
            <Autocomplete
              openOnFocus
              options={tiposAlerta}
              getOptionLabel={(option) => option.descricao}
              loading={tiposRegistroQuery.isLoading}
              value={tipoAlertaSelecionado ?? null}
              onChange={(_, value) => {
                setTipoRegistroUuid(value?.id ?? null);
                if (value) setEdicao(null);
              }}
              renderInput={(params) => <TextField {...params} label="Tipo de alerta" size="small" autoFocus />}
            />
          </Box>
        )}
      </Popover>

      {eventosQuery.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {eventosQuery.isError && (
        <Typography color="error" variant="body2">
          Não foi possível carregar o feed — você pode não ter permissão para isto, ou houve um
          problema de conexão.
        </Typography>
      )}
      {!eventosQuery.isLoading && eventos.length === 0 && (
        <Typography color="text.secondary">Nada por aqui ainda pros filtros escolhidos.</Typography>
      )}

      <InfiniteScroll
        dataLength={eventos.length}
        next={() => void eventosQuery.fetchNextPage()}
        hasMore={eventosQuery.hasNextPage}
        scrollThreshold="200px"
        loader={
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        }
        style={{ overflow: 'visible' }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {agruparPorDia(eventos).map((grupo) => (
            <Box key={grupo.chave}>
              {/* Cabeçalho do dia — rótulo + contador + linha divisória, "grudado" no topo ao
                  rolar (estilo Google Fotos). Fundo com blur pra não ficar um retângulo seco
                  cortando os cards que passam por baixo. */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  position: 'sticky',
                  // 64px = altura da AppBar fixa (AppLayout) — sem isso o header gruda em top:0
                  // do documento, que fica ESCONDIDO atrás da AppBar (zIndex bem maior), não
                  // logo abaixo dela como devia.
                  top: 64,
                  zIndex: 2,
                  backdropFilter: 'blur(6px)',
                  bgcolor: (t) => alpha(t.palette.background.default, 0.85),
                  py: 0.75,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13.5 }}>
                  {grupo.label}
                </Typography>
                <Chip
                  size="small"
                  label={`${grupo.eventos.length} evento${grupo.eventos.length === 1 ? '' : 's'}`}
                  sx={{ height: 20, fontSize: 11, fontFamily: 'monospace', fontWeight: 600, bgcolor: 'action.hover' }}
                />
                <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
              </Box>
              {grupo.eventos.map((evento, indice) => (
                <EventoLinha
                  // Chave composta — o feed não tem um id próprio, é montado a partir de duas
                  // fontes diferentes (Visita e VisitaRegistro).
                  key={`${evento.tipo_evento}-${evento.visita.id}-${evento.ocorrido_em}-${indice}`}
                  evento={evento}
                  requerResolucao={requerResolucao}
                  resolvendo={resolverMutation.isPending}
                  onResolver={(visitaUuid, registroUuid) => resolverMutation.mutate({ visitaUuid, registroUuid })}
                  onAbrirImagem={(fotos, indiceImagem) => setGaleria({ fotos, indice: indiceImagem })}
                />
              ))}
            </Box>
          ))}
        </Box>
      </InfiniteScroll>

      {galeria && (
        <GaleriaDialog
          fotos={galeria.fotos}
          indice={galeria.indice}
          onNavegar={(novoIndice) => setGaleria({ fotos: galeria.fotos, indice: novoIndice })}
          onClose={() => setGaleria(null)}
        />
      )}
    </Box>
  );
}

const TIPO_CHIP: Record<'VISITA_INICIADA' | 'VISITA_FINALIZADA', { label: string }> = {
  VISITA_INICIADA: { label: 'Check-in' },
  VISITA_FINALIZADA: { label: 'Checkout' },
};

// Paleta por tipo de evento — reproduz o handoff de design ("Interface administrativa indigo e
// amber", arquivo Atividades.dc.html): cada tipo tem uma cor própria de "pill suave" (fundo
// tingido + borda + texto combinando), fora do palette semântico padrão do MUI
// (primary/success/error não têm esse visual). "Pedido" do mock não existe no nosso domínio
// (não há feature de pedido sugerido), por isso ficou fora daqui.
const CORES_EVENTO = {
  CHECKIN: { dot: '#4f46e5', bg: '#eef0ff', fg: '#3730a3', borda: '#d6d9ff' },
  CHECKOUT: { dot: '#8b88c9', bg: '#f2f2f9', fg: '#4a4766', borda: '#e2e1ee' },
  COMENTARIO: { dot: '#d97706', bg: '#fff7e6', fg: '#92400e', borda: '#fde3b0' },
  ALERTA_PENDENTE: { dot: '#dc2626', bg: '#fdeeee', fg: '#9f1239', borda: '#f6cfcf' },
  ALERTA_RESOLVIDO: { dot: '#15803d', bg: '#eafaf0', fg: '#166534', borda: '#c9ecd8' },
} as const;

type CorEvento = (typeof CORES_EVENTO)[keyof typeof CORES_EVENTO];

function corDoEvento(evento: AtividadeEvento): CorEvento {
  if (evento.tipo_evento === 'VISITA_INICIADA') return CORES_EVENTO.CHECKIN;
  if (evento.tipo_evento === 'VISITA_FINALIZADA') return CORES_EVENTO.CHECKOUT;
  if (evento.tipo_evento === 'COMENTARIO') return CORES_EVENTO.COMENTARIO;
  return evento.registro?.alerta_resolvido_em ? CORES_EVENTO.ALERTA_RESOLVIDO : CORES_EVENTO.ALERTA_PENDENTE;
}

// Agrupa por dia (chave = data local do evento) preservando a ordem cronológica que a API já
// devolve (mais recente primeiro) — mesmo padrão visual do mock, cada dia com seu próprio
// cabeçalho fixo.
function agruparPorDia(eventos: AtividadeEvento[]): { chave: string; label: string; eventos: AtividadeEvento[] }[] {
  const grupos = new Map<string, AtividadeEvento[]>();
  for (const evento of eventos) {
    const chave = new Date(evento.ocorrido_em).toLocaleDateString('en-CA'); // YYYY-MM-DD local
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(evento);
  }
  return Array.from(grupos.entries()).map(([chave, eventosDoDia]) => ({
    chave,
    label: labelDoDia(eventosDoDia[0].ocorrido_em),
    eventos: eventosDoDia,
  }));
}

// Linha da timeline: hora | bolinha+linha conectora | card do evento — layout do handoff de
// design (grid 3 colunas), diferente do card solto que existia antes.
function EventoLinha(props: {
  evento: AtividadeEvento;
  requerResolucao: boolean;
  resolvendo: boolean;
  onResolver: (visitaUuid: string, registroUuid: string) => void;
  onAbrirImagem: (fotos: FotoComRegistro[], indice: number) => void;
}) {
  const { evento } = props;
  const hora = new Date(evento.ocorrido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const cores = corDoEvento(evento);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '46px 20px minmax(0,1fr)', columnGap: 0.75 }}>
      <Typography
        variant="caption"
        sx={{ textAlign: 'right', pt: 1.5, fontSize: 11, fontFamily: 'monospace', color: 'text.secondary', fontWeight: 500 }}
      >
        {hora}
      </Typography>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: '2px', bgcolor: 'divider' }} />
        <Box
          sx={{
            position: 'relative',
            width: 9,
            height: 9,
            mt: 1.75,
            borderRadius: '50%',
            bgcolor: cores.dot,
            boxShadow: (t) => `0 0 0 3px ${t.palette.background.default}`,
          }}
        />
      </Box>
      <Box sx={{ pb: 1.25, minWidth: 0 }}>
        <EventoCard {...props} cores={cores} />
      </Box>
    </Box>
  );
}

function EventoCard({
  evento,
  requerResolucao,
  resolvendo,
  onResolver,
  onAbrirImagem,
  cores,
}: {
  evento: AtividadeEvento;
  requerResolucao: boolean;
  resolvendo: boolean;
  onResolver: (visitaUuid: string, registroUuid: string) => void;
  onAbrirImagem: (fotos: FotoComRegistro[], indice: number) => void;
  cores: CorEvento;
}) {
  const nome = evento.usuario?.nome ?? 'Alguém';
  const registro = evento.tipo_evento === 'ALERTA' ? evento.registro : undefined;
  const resolvido = !!registro?.alerta_resolvido_em;

  const fotosAlerta = registro ? achatarFotos([registro]) : [];
  const fotosFinalizada = achatarFotos(evento.imagens ?? []);

  // Indicador de comentários do card: soma dos registros da visita (finalizada) ou do registro do
  // evento (alerta/comentário). Os registros com foto abrem no lightbox, onde se comenta.
  const registrosDoCard =
    evento.tipo_evento === 'VISITA_FINALIZADA'
      ? [...new Map((evento.imagens ?? []).map((r) => [r.id, r])).values()]
      : registro
        ? [registro]
        : [];
  const totalComentarios =
    evento.tipo_evento === 'COMENTARIO'
      ? (evento.comentario?.comentarios_count ?? 0)
      : registrosDoCard.reduce((soma, r) => soma + (r.comentarios_count ?? 0), 0);
  const novosComentarios =
    evento.tipo_evento === 'COMENTARIO'
      ? (evento.comentario?.comentarios_novos ?? 0)
      : registrosDoCard.reduce((soma, r) => soma + (r.comentarios_novos ?? 0), 0);
  const fotosComentaveis = evento.tipo_evento === 'VISITA_FINALIZADA' ? fotosFinalizada : fotosAlerta;

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
      {/* Cabeçalho — avatar do autor + nome + loja, igual o topo de um post (a hora já aparece
          na régua da timeline, à esquerda do card — ver EventoLinha). */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, p: 1.25, pb: 1 }}>
        <UsuarioAvatar nome={nome} fotoUrl={evento.usuario?.foto_url} size={30} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {nome}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.3 }}>
            {evento.ponto_venda?.fantasia}
          </Typography>
        </Box>
        {evento.tipo_evento === 'ALERTA' && registro ? (
          <Chip
            icon={
              <MdiIcon icone={registro.tipo_registro.icone ?? 'alert'} size={14} sx={{ color: 'inherit !important' }} />
            }
            label={registro.tipo_registro.descricao}
            size="small"
            sx={{ height: 22, fontSize: 11, bgcolor: cores.bg, color: cores.fg, border: '1px solid', borderColor: cores.borda, fontWeight: 600 }}
          />
        ) : evento.tipo_evento === 'COMENTARIO' ? (
          <Chip
            icon={<ChatBubbleOutlinedIcon sx={{ fontSize: 14, color: 'inherit !important' }} />}
            label="Comentário"
            size="small"
            sx={{ height: 22, fontSize: 11, bgcolor: cores.bg, color: cores.fg, border: '1px solid', borderColor: cores.borda, fontWeight: 600 }}
          />
        ) : (
          <Chip
            icon={
              evento.tipo_evento === 'VISITA_FINALIZADA' ? (
                <LogoutIcon sx={{ fontSize: 14, color: 'inherit !important' }} />
              ) : (
                <LoginIcon sx={{ fontSize: 14, color: 'inherit !important' }} />
              )
            }
            label={TIPO_CHIP[evento.tipo_evento as 'VISITA_INICIADA' | 'VISITA_FINALIZADA'].label}
            size="small"
            sx={{ height: 22, fontSize: 11, bgcolor: cores.bg, color: cores.fg, border: '1px solid', borderColor: cores.borda, fontWeight: 600 }}
          />
        )}
      </Box>

      {/* Corpo — conteúdo específico do tipo de evento. */}
      {evento.tipo_evento === 'COMENTARIO' && evento.comentario && (
        <Box sx={{ px: 1.25, pb: 1 }}>
          {(evento.comentario.produto ?? evento.comentario.tipo_registro) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              Em: {evento.comentario.produto ?? evento.comentario.tipo_registro}
            </Typography>
          )}
          <Typography variant="body2" sx={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>
            {evento.comentario.texto}
          </Typography>
        </Box>
      )}

      {evento.tipo_evento === 'ALERTA' && registro?.observacao && (
        <Typography variant="body2" sx={{ px: 1.25, pb: 1, fontSize: 13 }}>
          {registro.observacao}
        </Typography>
      )}

      {evento.tipo_evento === 'ALERTA' && fotosAlerta.length > 0 && (
        <Box sx={{ px: 1.25, pb: 1.25 }}>
          <MosaicoImagens fotos={fotosAlerta} onAbrir={(i) => onAbrirImagem(fotosAlerta, i)} />
        </Box>
      )}

      {evento.tipo_evento === 'VISITA_INICIADA' && evento.localizacao && (
        <MapaCheckin
          latitude={evento.localizacao.latitude}
          longitude={evento.localizacao.longitude}
          distanciaMetros={evento.localizacao.distancia_metros}
        />
      )}

      {evento.tipo_evento === 'VISITA_FINALIZADA' && fotosFinalizada.length > 0 && (
        <Box sx={{ px: 1.25, pb: 1.25 }}>
          <MosaicoImagens fotos={fotosFinalizada} onAbrir={(i) => onAbrirImagem(fotosFinalizada, i)} />
        </Box>
      )}

      {/* Só INDICA que há comentário (docs/28 §3) — quem quer ler/responder abre a foto e comenta
          no registro. Sem foto (alerta sem imagem), o clique leva ao detalhe da visita. */}
      {totalComentarios > 0 && (
        <Box sx={{ px: 1.25, pb: 0.75 }}>
          <Chip
            icon={<ChatBubbleOutlinedIcon sx={{ fontSize: 14 }} />}
            label={`${totalComentarios} ${totalComentarios === 1 ? 'comentário' : 'comentários'}${novosComentarios > 0 ? ` · ${novosComentarios} ${novosComentarios === 1 ? 'novo' : 'novos'}` : ''}`}
            size="small"
            color={novosComentarios > 0 ? 'primary' : 'default'}
            variant={novosComentarios > 0 ? 'filled' : 'outlined'}
            clickable
            {...(fotosComentaveis.length > 0
              ? { onClick: () => onAbrirImagem(fotosComentaveis, Math.max(0, fotosComentaveis.findIndex((f) => (f.registro.comentarios_count ?? 0) > 0))) }
              : { component: RouterLink, to: `/visitas/${evento.visita.id}` })}
          />
        </Box>
      )}

      {/* Rodapé — ação contextual à esquerda, link pro detalhe da visita sempre à direita. */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 1.25,
          py: 0.75,
          borderTop: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box>
          {evento.tipo_evento === 'VISITA_FINALIZADA' && evento.resumo && (
            <Chip
              size="small"
              variant="outlined"
              label={`${evento.resumo.registros} registro(s)${evento.resumo.rupturas > 0 ? `, ${evento.resumo.rupturas} ruptura(s)` : ''}`}
            />
          )}
          {evento.tipo_evento === 'ALERTA' && registro && (
            <>
              {resolvido ? (
                <Chip
                  icon={<CheckCircleIcon />}
                  label={registro.resolvido_por ? `Resolvido por ${registro.resolvido_por.nome}` : 'Resolvido'}
                  color="success"
                  size="small"
                />
              ) : requerResolucao ? (
                <Button
                  size="small"
                  variant="outlined"
                  color="error"
                  disabled={resolvendo}
                  onClick={() => onResolver(evento.visita.id, registro.id)}
                >
                  Resolver
                </Button>
              ) : null}
            </>
          )}
        </Box>
        <Button size="small" component={RouterLink} to={`/visitas/${evento.visita.id}`} endIcon={<ArrowForwardIcon fontSize="small" />}>
          Ver detalhes da visita
        </Button>
      </Box>
    </Paper>
  );
}

// Sem lib de mapa no projeto — embed público do próprio OpenStreetMap (o mesmo widget do botão
// "Compartilhar" em openstreetmap.org), sem chave de API nem dependência nova.
function urlMapaEmbed(lat: number, lon: number): string {
  const delta = 0.003;
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].join('%2C');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
}

function urlMapaCompleto(lat: number, lon: number): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}`;
}

/**
 * O mapa é um iframe de origem cruzada (openstreetmap.org) — não dá pra configurar o Leaflet lá
 * dentro pra só dar zoom com Ctrl+scroll (sem acesso ao JS da página de fora). Em vez disso, uma
 * camada transparente por cima intercepta o scroll normal (a página rola por baixo dela sem
 * nada acontecer no mapa) e só fica "vazada" — deixando o wheel passar direto pro iframe — enquanto
 * Ctrl está pressionado. Mesmo truque usado em embeds de Google Maps pela web afora.
 */
function useZoomSoComCtrl() {
  const [ctrlPressionado, setCtrlPressionado] = useState(false);
  const [mostrarDica, setMostrarDica] = useState(false);
  const timeoutDicaRef = useRef<number | null>(null);

  useEffect(() => {
    function aoApertarTecla(e: KeyboardEvent) {
      if (e.key === 'Control' || e.key === 'Meta') setCtrlPressionado(true);
    }
    function aoSoltarTecla(e: KeyboardEvent) {
      if (e.key === 'Control' || e.key === 'Meta') setCtrlPressionado(false);
    }
    // Sem isso, trocar de janela/aba com Ctrl ainda pressionado nunca dispara o keyup e o mapa
    // fica "destravado" pra sempre.
    function aoPerderFoco() {
      setCtrlPressionado(false);
    }

    window.addEventListener('keydown', aoApertarTecla);
    window.addEventListener('keyup', aoSoltarTecla);
    window.addEventListener('blur', aoPerderFoco);
    return () => {
      window.removeEventListener('keydown', aoApertarTecla);
      window.removeEventListener('keyup', aoSoltarTecla);
      window.removeEventListener('blur', aoPerderFoco);
    };
  }, []);

  function aoRolarSemCtrl() {
    setMostrarDica(true);
    if (timeoutDicaRef.current) window.clearTimeout(timeoutDicaRef.current);
    timeoutDicaRef.current = window.setTimeout(() => setMostrarDica(false), 1200);
  }

  return { ctrlPressionado, mostrarDica, aoRolarSemCtrl };
}

// Mapa só monta sob demanda (docs/30-CRITICA-UX-ADMIN-WEB.md §2) — um feed com muitos eventos de
// check-in não carrega mais um iframe de origem cruzada por card de cara; a distância em texto já
// cobre a leitura rápida, o mapa interativo é pra quem clica querendo conferir de verdade.
function MapaCheckin({
  latitude,
  longitude,
  distanciaMetros,
}: {
  latitude: number;
  longitude: number;
  distanciaMetros: number | null;
}) {
  const [mapaAberto, setMapaAberto] = useState(false);
  const { ctrlPressionado, mostrarDica, aoRolarSemCtrl } = useZoomSoComCtrl();

  return (
    <Box sx={{ px: 1.25, pb: 1.25 }}>
      {mapaAberto && (
        <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden', mb: 0.5 }}>
          <Box
            component="iframe"
            title="Localização do check-in"
            src={urlMapaEmbed(latitude, longitude)}
            loading="lazy"
            sx={{ width: '100%', height: 140, border: 0, display: 'block' }}
          />
          {/* pointerEvents 'none' com Ctrl pressionado deixa o wheel passar direto pro iframe por
              baixo (o mapa some da hit-test do navegador nesse instante) — sem isso, todo scroll
              vira zoom no mapa em vez de rolar a página. */}
          <Box
            onWheel={ctrlPressionado ? undefined : aoRolarSemCtrl}
            sx={{ position: 'absolute', inset: 0, pointerEvents: ctrlPressionado ? 'none' : 'auto' }}
          />
          {mostrarDica && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0,0,0,0.5)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                px: 2,
                fontSize: 13,
                fontWeight: 600,
                pointerEvents: 'none',
              }}
            >
              Use Ctrl + scroll pra dar zoom no mapa
            </Box>
          )}
        </Box>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RoomIcon sx={{ fontSize: 14 }} />
          {distanciaMetros !== null ? `A ${distanciaMetros}m do ponto de venda` : 'Localização do check-in'}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <MuiLink
            component="button"
            type="button"
            variant="caption"
            onClick={() => setMapaAberto((atual) => !atual)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}
          >
            {mapaAberto ? 'Ocultar mapa' : 'Ver no mapa'}
          </MuiLink>
          <MuiLink
            href={urlMapaCompleto(latitude, longitude)}
            target="_blank"
            rel="noopener noreferrer"
            variant="caption"
            sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}
          >
            Abrir no mapa <OpenInNewIcon sx={{ fontSize: 12 }} />
          </MuiLink>
        </Box>
      </Box>
    </Box>
  );
}


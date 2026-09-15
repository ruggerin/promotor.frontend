import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
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
  Dialog,
  FormControlLabel,
  IconButton,
  Link as MuiLink,
  Paper,
  Skeleton,
  Switch,
  TextField,
  Tooltip,
  Typography,
  type SxProps,
  type Theme,
} from '@mui/material';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import InfiniteScroll from 'react-infinite-scroll-component';
import { Link as RouterLink } from 'react-router-dom';
import { MdiIcon } from '../../components/MdiIcon';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { apiClient } from '../../lib/api/client';
import { listarAtividades, resolverAlerta } from '../../lib/api/atividades';
import { buscarAlertaRequerResolucao, buscarPollingAtividadesMs } from '../../lib/api/parametros';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { AtividadeEvento, VisitaRegistro } from '../../types/api';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Um registro pode ter várias fotos agora (ver docs/21-EVIDENCIA-EM-FOTOS.md) — mosaico e
// galeria trabalham em cima de 1 entrada por FOTO, não por registro, carregando de volta o
// registro dono pra continuar mostrando tipo/vínculo/observação junto da imagem.
interface FotoComRegistro {
  registro: VisitaRegistro;
  imagem: { id: string; url: string };
}

function achatarFotos(registros: VisitaRegistro[]): FotoComRegistro[] {
  return registros.flatMap((registro) => registro.imagens.map((imagem) => ({ registro, imagem })));
}

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

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Atividades
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Tudo que rolou nas visitas — todos os promotores, todas as lojas, em ordem cronológica.
          Atualiza sozinho a cada {Math.round(pollingMs / 1000)}s.
        </Typography>
        <Tooltip title="Recarregar agora">
          <span>
            <IconButton size="small" onClick={() => void eventosQuery.refetch()} disabled={eventosQuery.isFetching}>
              {eventosQuery.isFetching ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
        <Autocomplete
          size="small"
          sx={{ width: 220 }}
          options={usuariosQuery.data?.usuarios ?? []}
          getOptionLabel={(option) => option.nome}
          loading={usuariosQuery.isLoading}
          onChange={(_, value) => setUsuarioUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Promotor" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 240 }}
          options={pontosVendaQuery.data?.pontos_venda ?? []}
          getOptionLabel={(option) => option.fantasia}
          loading={pontosVendaQuery.isLoading}
          onChange={(_, value) => setPontoVendaUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Ponto de venda" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 220 }}
          options={tiposAlerta}
          getOptionLabel={(option) => option.descricao}
          loading={tiposRegistroQuery.isLoading}
          onChange={(_, value) => setTipoRegistroUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Tipo de alerta" />}
        />
        {requerResolucao && (
          <FormControlLabel
            control={<Switch checked={apenasPendentes} onChange={(e) => setApenasPendentes(e.target.checked)} />}
            label="Só pendentes"
          />
        )}
      </Paper>

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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {eventos.map((evento, indice) => (
            <EventoCard
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

const TIPO_CHIP: Record<'VISITA_INICIADA' | 'VISITA_FINALIZADA', { label: string; cor: 'primary' | 'success' }> = {
  VISITA_INICIADA: { label: 'Check-in', cor: 'primary' },
  VISITA_FINALIZADA: { label: 'Checkout', cor: 'success' },
};

function EventoCard({
  evento,
  requerResolucao,
  resolvendo,
  onResolver,
  onAbrirImagem,
}: {
  evento: AtividadeEvento;
  requerResolucao: boolean;
  resolvendo: boolean;
  onResolver: (visitaUuid: string, registroUuid: string) => void;
  onAbrirImagem: (fotos: FotoComRegistro[], indice: number) => void;
}) {
  const hora = new Date(evento.ocorrido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const nome = evento.usuario?.nome ?? 'Alguém';
  const registro = evento.tipo_evento === 'ALERTA' ? evento.registro : undefined;
  const resolvido = !!registro?.alerta_resolvido_em;

  const fotosAlerta = registro ? achatarFotos([registro]) : [];
  const fotosFinalizada = achatarFotos(evento.imagens ?? []);

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      {/* Cabeçalho — avatar do autor + nome + loja/hora, igual o topo de um post. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, pb: 1.5 }}>
        <UsuarioAvatar nome={nome} fotoUrl={evento.usuario?.foto_url} size={40} />
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap>
            {nome}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {evento.ponto_venda?.fantasia} · {hora}
          </Typography>
        </Box>
        {evento.tipo_evento === 'ALERTA' && registro ? (
          <Chip
            icon={<MdiIcon icone={registro.tipo_registro.icone ?? 'alert'} size={16} sx={{ color: 'inherit' }} />}
            label={registro.tipo_registro.descricao}
            color={resolvido ? 'success' : 'error'}
            size="small"
          />
        ) : (
          <Chip
            icon={evento.tipo_evento === 'VISITA_FINALIZADA' ? <LogoutIcon /> : <LoginIcon />}
            label={TIPO_CHIP[evento.tipo_evento as 'VISITA_INICIADA' | 'VISITA_FINALIZADA'].label}
            color={TIPO_CHIP[evento.tipo_evento as 'VISITA_INICIADA' | 'VISITA_FINALIZADA'].cor}
            size="small"
            variant="outlined"
          />
        )}
      </Box>

      {/* Corpo — conteúdo específico do tipo de evento. */}
      {evento.tipo_evento === 'ALERTA' && registro?.observacao && (
        <Typography variant="body2" sx={{ px: 2, pb: 1.5 }}>
          {registro.observacao}
        </Typography>
      )}

      {evento.tipo_evento === 'ALERTA' && fotosAlerta.length > 0 && (
        <MosaicoImagens fotos={fotosAlerta} onAbrir={(i) => onAbrirImagem(fotosAlerta, i)} />
      )}

      {evento.tipo_evento === 'VISITA_INICIADA' && evento.localizacao && (
        <MapaCheckin
          latitude={evento.localizacao.latitude}
          longitude={evento.localizacao.longitude}
          distanciaMetros={evento.localizacao.distancia_metros}
        />
      )}

      {evento.tipo_evento === 'VISITA_FINALIZADA' && fotosFinalizada.length > 0 && (
        <MosaicoImagens fotos={fotosFinalizada} onAbrir={(i) => onAbrirImagem(fotosFinalizada, i)} />
      )}

      {/* Rodapé — ação contextual à esquerda, link pro detalhe da visita sempre à direita. */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 2,
          py: 1,
          mt: 1,
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

// Grade de fotos estilo post de rede social: 1 foto ocupa a largura toda, 2+ vira grade 2
// colunas, e a partir da 5ª um "+N" cobre a última miniatura visível em vez de esticar a grade.
function MosaicoImagens({
  fotos,
  onAbrir,
}: {
  fotos: FotoComRegistro[];
  onAbrir: (indice: number) => void;
}) {
  const MAX_VISIVEIS = 4;
  const visiveis = fotos.slice(0, MAX_VISIVEIS);
  const restante = fotos.length - visiveis.length;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: visiveis.length === 1 ? '1fr' : 'repeat(2, 1fr)',
        gap: 0.5,
        // Contido, não a largura toda do card — miniaturas pequenas e proporcionais, igual
        // anexo de foto num post de rede social, não um banner dominando o card.
        maxWidth: visiveis.length === 1 ? 140 : 220,
        px: 2,
        pb: 2,
      }}
    >
      {visiveis.map((foto, indice) => (
        <Box
          key={foto.imagem.id}
          sx={{ position: 'relative', cursor: 'pointer', borderRadius: 1, overflow: 'hidden' }}
          onClick={() => onAbrir(indice)}
        >
          <AutenticatedImage
            url={foto.imagem.url}
            alt={foto.registro.tipo_registro.descricao}
            sx={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
          />
          {indice === MAX_VISIVEIS - 1 && restante > 0 && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              +{restante}
            </Box>
          )}
        </Box>
      ))}
    </Box>
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

function MapaCheckin({
  latitude,
  longitude,
  distanciaMetros,
}: {
  latitude: number;
  longitude: number;
  distanciaMetros: number | null;
}) {
  const { ctrlPressionado, mostrarDica, aoRolarSemCtrl } = useZoomSoComCtrl();

  return (
    <Box sx={{ px: 2, pb: 2 }}>
      <Box sx={{ position: 'relative', borderRadius: 1, overflow: 'hidden' }}>
        <Box
          component="iframe"
          title="Localização do check-in"
          src={urlMapaEmbed(latitude, longitude)}
          loading="lazy"
          sx={{ width: '100%', height: 180, border: 0, display: 'block' }}
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RoomIcon sx={{ fontSize: 14 }} />
          {distanciaMetros !== null ? `A ${distanciaMetros}m do ponto de venda` : 'Localização do check-in'}
        </Typography>
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
  );
}

/**
 * A rota de imagem exige Authorization: Bearer — uma <img src> comum não manda esse header,
 * então baixa via Axios (que já injeta o token pelo interceptor) e vira uma blob URL. Mesma
 * técnica de RegistroImagem (VisitaDetailPage.tsx) e UsuarioAvatar, generalizada aqui pro
 * mosaico/galeria.
 */
function AutenticatedImage({
  url,
  alt,
  sx,
  onClick,
}: {
  url: string;
  alt: string;
  sx?: SxProps<Theme>;
  onClick?: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setBlobUrl(null);
    let objectUrl: string | null = null;
    let cancelado = false;

    apiClient
      .get<Blob>(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        // Falha silenciosa — o card segue mostrando o resto normalmente.
      });

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!blobUrl) {
    return <Skeleton variant="rectangular" sx={sx} />;
  }

  return <Box component="img" src={blobUrl} alt={alt} onClick={onClick} sx={sx} />;
}

// Galeria (lightbox) — abre a foto clicada em tamanho grande, com seta pra navegar entre as
// outras fotos da mesma visita quando houver mais de uma, e a informação do registro embaixo
// (tipo, vínculo, observação, campos customizados, quando) — mesmo conjunto de campos que
// RegistroCard mostra em VisitaDetailPage.tsx, só reorganizado pro formato de lightbox.
function GaleriaDialog({
  fotos,
  indice,
  onNavegar,
  onClose,
}: {
  fotos: FotoComRegistro[];
  indice: number;
  onNavegar: (indice: number) => void;
  onClose: () => void;
}) {
  const foto = fotos[indice];
  if (!foto) return null;
  const registro = foto.registro;

  const vinculo =
    registro.produto_auditoria?.descricao ??
    registro.secao?.descricao ??
    registro.departamento?.descricao ??
    registro.marca?.descricao;
  const camposPreenchidos = Object.entries(registro.valores_campos ?? {}).filter(([, valor]) => valor !== '' && valor != null);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <Box sx={{ position: 'relative', bgcolor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 320 }}>
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: 4, right: 4, color: '#fff', zIndex: 1 }}>
          <CloseIcon />
        </IconButton>
        {indice > 0 && (
          <IconButton
            onClick={() => onNavegar(indice - 1)}
            sx={{ position: 'absolute', left: 4, color: '#fff', zIndex: 1 }}
          >
            <ChevronLeftIcon fontSize="large" />
          </IconButton>
        )}
        <AutenticatedImage
          key={foto.imagem.id}
          url={foto.imagem.url}
          alt={registro.tipo_registro.descricao}
          sx={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain' }}
        />
        {indice < fotos.length - 1 && (
          <IconButton
            onClick={() => onNavegar(indice + 1)}
            sx={{ position: 'absolute', right: 4, color: '#fff', zIndex: 1 }}
          >
            <ChevronRightIcon fontSize="large" />
          </IconButton>
        )}
      </Box>

      <Box sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<MdiIcon icone={registro.tipo_registro.icone ?? 'image'} size={16} sx={{ color: 'inherit' }} />}
            label={registro.tipo_registro.descricao}
            size="small"
          />
          {registro.ruptura && <Chip label="Ruptura" color="error" size="small" />}
        </Box>
        {vinculo && (
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
            {vinculo}
          </Typography>
        )}
        {registro.observacao && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {registro.observacao}
          </Typography>
        )}
        {camposPreenchidos.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
            {camposPreenchidos.map(([chave, valor]) => (
              <Chip key={chave} label={`${chave}: ${valor}`} size="small" variant="outlined" />
            ))}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {new Date(registro.created_at).toLocaleString('pt-BR')}
          {fotos.length > 1 && ` · ${indice + 1} de ${fotos.length}`}
        </Typography>
      </Box>
    </Dialog>
  );
}

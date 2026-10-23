import PauseRounded from '@mui/icons-material/PauseRounded';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { ZoomComCtrl } from '../../components/mapa/ZoomComCtrl';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { buscarRotaDoDia, listarPromotoresRota, type DeslocamentoRota, type DesvioRota, type RotaDoDia } from '../../lib/api/rotas';
import type { AfastamentoTrecho } from '../../types/api';
import { horus } from '../../theme';

// Rota do dia — por onde o promotor passou num dia: trajeto seguindo as ruas, visitas numeradas
// com chegada/saída, paradas fora de loja e trechos sem sinal. docs/48-ROTA-DO-DIA.md; protótipo
// aprovado em https://claude.ai/artifact/Suz8gHAQg15H72e73nqeZf. Saída da loja no meio da visita
// (trecho vermelho, selo no pino): docs/49-AFASTAMENTO-DURANTE-VISITA.md. Recorte no expediente,
// deslocamentos com horário, régua do dia e trechos fora da área do roteiro (magenta): docs/93,
// protótipo em https://claude.ai/artifact/9ciZNT5hU19e4N2SL1HMzg.

const COR = {
  rota: '#4f46e5',
  gap: '#8a87a3',
  parada: '#ea580c',
  inicio: '#15803d',
  fora: '#dc2626',
  desvio: '#c026d3',
  foraExpediente: '#8f8ca8',
};

type Visita = RotaDoDia['visitas'][number];
type Parada = RotaDoDia['paradas'][number];
type SemSinal = RotaDoDia['sem_sinal'][number];
type LatLng = [number, number];

function hoje(): string {
  return new Date().toLocaleDateString('en-CA');
}

function hora(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

function horaMs(ms: number): string {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

const ms = (iso: string) => new Date(iso).getTime();

function duracao(minutos: number | null): string {
  if (minutos === null) return 'em andamento';
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

function distancia(metros: number): string {
  return metros < 1000 ? `${metros} m` : `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}

// "Tarumã → Colônia Terra Nova → Lagoa Azul" (no máximo 4, o resto vira reticências).
function bairrosTexto(bairros: string[]): string {
  return bairros.length > 4 ? `${bairros.slice(0, 4).join(' → ')}…` : bairros.join(' → ');
}

// Uma linha por saída — "saiu às 10:12 sem checkout, foi até 3,2 km, voltou às 10:55 (43 min fora)".
function textoAfastamento(a: AfastamentoTrecho): string {
  const volta = a.fim ? `voltou às ${hora(a.fim)}` : 'não voltou antes do checkout';
  return `Saiu às ${hora(a.inicio)} sem checkout, foi até ${distancia(a.distancia_max_metros)}, ${volta} (${duracao(a.minutos)} fora)`;
}

// `alerta` = selo vermelho "!" no canto: a visita teve saída da loja (docs/49).
function pino(cor: string, texto: string, alerta = false): L.DivIcon {
  const selo = alerta
    ? `<div style="position:absolute;top:-6px;right:-6px;width:16px;height:16px;border-radius:50%;background:${COR.fora};border:2px solid #fff;color:#fff;font:800 10px 'IBM Plex Sans',sans-serif;display:flex;align-items:center;justify-content:center">!</div>`
    : '';
  return L.divIcon({
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -14],
    html: `<div style="position:relative;width:30px;height:30px;border-radius:50%;background:${cor};border:3px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35);color:#fff;font:700 13px 'IBM Plex Sans',sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${texto}${selo}</div>`,
  });
}

// Loja da agenda que não foi visitada: anel tracejado, sem número.
const pinoAgenda = L.divIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -10],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#fff;border:2.5px dashed ${COR.rota};box-sizing:border-box"></div>`,
});

// Horário escrito em cima do trajeto.
function etiquetaHora(texto: string): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [44, 18],
    iconAnchor: [-4, 20],
    html: `<span style="display:inline-block;font:600 11px 'IBM Plex Mono',monospace;color:#1a1830;background:#fff;border:1px solid #c9c6e4;border-radius:4px;padding:0 4px;box-shadow:0 1px 3px rgba(15,23,42,.25);white-space:nowrap">${texto}</span>`,
  });
}

// Onde o promotor estava na hora da régua.
function pinoAgora(inicial: string, semPosicao: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div style="width:26px;height:26px;border-radius:50%;background:${semPosicao ? '#fff' : '#1a1830'};border:2.5px ${semPosicao ? `dashed ${COR.gap}` : 'solid #fff'};box-shadow:0 0 0 6px rgba(26,24,48,.18);color:${semPosicao ? COR.gap : '#fff'};font:700 12px 'IBM Plex Sans',sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${inicial}</div>`,
  });
}

// Distância aproximada em metros — só pra decidir se duas etiquetas ficariam uma em cima da outra.
function metrosAprox(a: LatLng, b: LatLng): number {
  const dLat = (a[0] - b[0]) * 111_320;
  const dLng = (a[1] - b[1]) * 111_320 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

// Recorte no expediente (docs/93): a parte de um intervalo que cai dentro (ou fora) da janela.
type Intervalo = { inicio: string; fim: string; minutos: number };
function cortar<T extends Intervalo>(item: T, de: number, ate: number): (T & { cortado: boolean }) | null {
  const inicio = Math.max(ms(item.inicio), de);
  const fim = Math.min(ms(item.fim), ate);
  if (fim <= inicio) return null;
  const cortado = inicio !== ms(item.inicio) || fim !== ms(item.fim);
  return {
    ...item,
    inicio: new Date(inicio).toISOString(),
    fim: new Date(fim).toISOString(),
    minutos: cortado ? Math.round((fim - inicio) / 60_000) : item.minutos,
    cortado,
  };
}

type Lado = 'antes' | 'depois' | null;

type Evento = (
  | { chave: string; tipo: 'inicio'; em: string; lat: number; lng: number; detalhe: string }
  | { chave: string; tipo: 'visita'; em: string; v: Visita }
  | { chave: string; tipo: 'afastamento'; em: string; v: Visita; a: AfastamentoTrecho }
  | { chave: string; tipo: 'parada'; em: string; p: Parada & { cortado?: boolean } }
  | { chave: string; tipo: 'gap'; em: string; g: SemSinal & { cortado?: boolean } }
  | { chave: string; tipo: 'deslocamento'; em: string; d: DeslocamentoRota & { cortado?: boolean } }
  | { chave: string; tipo: 'desvio'; em: string; d: DesvioRota }
  | { chave: string; tipo: 'marco'; em: string; titulo: string; detalhe: string }
) & { lado: Lado };

// Janela do que a tela mostra: o dia inteiro, ou só o expediente (docs/93).
interface Janela {
  recortado: boolean;
  podeAbrir: boolean;
  inicio: number;
  fim: number;
}

function janelaDaRota(rota: RotaDoDia): Janela {
  const recorte = rota.expediente?.recorte ?? 'DIA_INTEIRO';
  return {
    recortado: recorte !== 'DIA_INTEIRO',
    podeAbrir: recorte === 'EXPEDIENTE',
    inicio: rota.expediente ? ms(rota.expediente.inicio) : 0,
    fim: rota.expediente ? ms(rota.expediente.fim) : 0,
  };
}

function eventosDaRota(rota: RotaDoDia, janela: Janela): Evento[] {
  const eventos: Evento[] = [];
  const { recortado, inicio: de, fim: ate } = janela;
  const lado = (inicio: string, fim: string): Lado => (!recortado ? null : ms(fim) <= de ? 'antes' : ms(inicio) >= ate ? 'depois' : null);

  // Parada, sem sinal e deslocamento que atravessam a borda viram dois pedaços: o de dentro (na
  // lista) e o de fora (nos blocos recolhidos).
  function pedacos<T extends Intervalo>(item: T): { item: T & { cortado?: boolean }; lado: Lado }[] {
    if (!recortado) return [{ item, lado: null }];
    return (
      [
        [cortar(item, -Infinity, de), 'antes'],
        [cortar(item, de, ate), null],
        [cortar(item, ate, Infinity), 'depois'],
      ] as const
    )
      .filter(([pedaco]) => pedaco)
      .map(([pedaco, l]) => ({ item: pedaco!, lado: l }));
  }

  const primeiro = recortado ? (rota.pontos.find((p) => ms(p.em) >= de && ms(p.em) <= ate) ?? rota.pontos[0]) : rota.pontos[0];
  if (primeiro) {
    eventos.push({
      chave: 'inicio',
      tipo: 'inicio',
      em: primeiro.em,
      lat: primeiro.latitude,
      lng: primeiro.longitude,
      detalhe: recortado ? 'Primeira posição no expediente' : 'Primeira posição do dia',
      lado: lado(primeiro.em, primeiro.em),
    });
  }
  rota.visitas.forEach((v) => {
    eventos.push({ chave: `v-${v.id}`, tipo: 'visita', em: v.inicio, v, lado: lado(v.inicio, v.fim ?? v.inicio) });
    v.afastamentos.forEach((a, i) => eventos.push({ chave: `a-${v.id}-${i}`, tipo: 'afastamento', em: a.inicio, v, a, lado: lado(a.inicio, a.fim ?? a.inicio) }));
  });
  rota.paradas.forEach((p, i) =>
    pedacos(p).forEach(({ item, lado: l }) => eventos.push({ chave: `p-${i}${l ? `-${l}` : ''}`, tipo: 'parada', em: item.inicio, p: item, lado: l })),
  );
  rota.sem_sinal.forEach((g, i) =>
    pedacos(g).forEach(({ item, lado: l }) => eventos.push({ chave: `g-${i}${l ? `-${l}` : ''}`, tipo: 'gap', em: item.inicio, g: item, lado: l })),
  );
  (rota.deslocamentos ?? []).forEach((d, i) =>
    pedacos(d).forEach(({ item, lado: l }) => eventos.push({ chave: `desl-${i}${l ? `-${l}` : ''}`, tipo: 'deslocamento', em: item.inicio, d: item, lado: l })),
  );
  (rota.desvios ?? []).forEach((d, i) => eventos.push({ chave: `desv-${i}`, tipo: 'desvio', em: d.inicio, d, lado: null }));

  if (recortado) {
    const de_ = new Date(de).toISOString();
    const ate_ = new Date(ate).toISOString();
    eventos.push({ chave: 'm-inicio', tipo: 'marco', em: de_, titulo: 'Início do expediente', detalhe: 'horário da empresa', lado: null });
    eventos.push({ chave: 'm-fim', tipo: 'marco', em: ate_, titulo: 'Fim do expediente', detalhe: 'horário da empresa', lado: null });
  }

  // Mesmo horário: o deslocamento vem depois do resto (a chegada antes da saída seguinte), e os
  // marcos do expediente na frente do que começa junto.
  const peso = (e: Evento) => (e.tipo === 'marco' ? (e.chave === 'm-inicio' ? -1 : 2) : e.tipo === 'deslocamento' ? 1 : 0);
  return eventos.sort((a, b) => ms(a.em) - ms(b.em) || peso(a) - peso(b));
}

// Pontos brutos (com horário) entre dois instantes — o desenho do trecho selecionado.
function pontosEntre(rota: RotaDoDia, inicio: string, fim: string): LatLng[] {
  const de = ms(inicio);
  const ate = ms(fim);
  return rota.pontos.filter((p) => ms(p.em) >= de && ms(p.em) <= ate).map((p) => [p.latitude, p.longitude] as LatLng);
}

// O trecho que a seleção destaca no mapa (saída da loja, desvio ou deslocamento).
function trechoSelecionado(rota: RotaDoDia, eventos: Evento[], chave: string | null): { pontos: LatLng[]; cor: string; inicio: string; fim: string } | null {
  const ev = chave ? eventos.find((e) => e.chave === chave) : null;
  if (!ev) return null;
  if (ev.tipo === 'afastamento') return { pontos: ev.a.pontos, cor: COR.fora, inicio: ev.a.inicio, fim: ev.a.fim ?? ev.v.fim ?? ev.a.inicio };
  if (ev.tipo === 'desvio') return { pontos: ev.d.pontos, cor: COR.desvio, inicio: ev.d.inicio, fim: ev.d.fim };
  if (ev.tipo === 'deslocamento') return { pontos: pontosEntre(rota, ev.d.inicio, ev.d.fim), cor: COR.rota, inicio: ev.d.inicio, fim: ev.d.fim };
  return null;
}

// Onde abrir o item no Google Maps (clique duplo na linha do tempo): a loja da visita, o ponto
// mais longe a que o promotor chegou na saída, onde ficou parado e onde o sinal caiu.
function coordenadaDoEvento(evento: Evento): [number, number] | null {
  switch (evento.tipo) {
    case 'inicio':
      return [evento.lat, evento.lng];
    case 'visita':
      return [evento.v.latitude, evento.v.longitude];
    case 'afastamento': {
      const { latitude, longitude } = evento.v;
      const longe = evento.a.pontos.reduce<[number, number] | null>((melhor, ponto) => {
        const d = (ponto[0] - latitude) ** 2 + (ponto[1] - longitude) ** 2;
        return !melhor || d > (melhor[0] - latitude) ** 2 + (melhor[1] - longitude) ** 2 ? ponto : melhor;
      }, null);
      return longe ?? [latitude, longitude];
    }
    case 'parada':
      return [evento.p.latitude, evento.p.longitude];
    case 'gap':
      return [evento.g.de.latitude, evento.g.de.longitude];
    case 'desvio':
      return evento.d.pontos[Math.floor(evento.d.pontos.length / 2)] ?? null;
    default:
      return null;
  }
}

function abrirNoGoogleMaps(evento: Evento) {
  const coordenada = coordenadaDoEvento(evento);
  if (!coordenada) return;
  window.open(`https://www.google.com/maps/search/?api=1&query=${coordenada[0]},${coordenada[1]}`, '_blank', 'noopener,noreferrer');
}

// Enquadra a rota ao carregar e leva o mapa até o item escolhido na linha do tempo.
function ControleMapa({
  rota,
  eventos,
  selecionado,
  marcadores,
}: {
  rota: RotaDoDia;
  eventos: Evento[];
  selecionado: string | null;
  marcadores: React.RefObject<Record<string, L.Marker | null>>;
}) {
  const mapa = useMap();
  const chaveRota = `${rota.promotor.id}|${rota.data}|${rota.pontos.length}`;

  useEffect(() => {
    const coords: L.LatLngExpression[] = [
      ...rota.linhas.filter((_, i) => !rota.linhas_fora_expediente?.[i]).flat(),
      ...rota.visitas.map((v) => [v.latitude, v.longitude] as LatLng),
      ...rota.paradas.map((p) => [p.latitude, p.longitude] as LatLng),
    ];
    if (coords.length === 1) mapa.setView(coords[0], 16);
    else if (coords.length > 1) mapa.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, chaveRota]);

  useEffect(() => {
    if (!selecionado) return;
    const gap = eventos.find((e) => e.chave === selecionado && e.tipo === 'gap');
    if (gap && gap.tipo === 'gap') {
      const g = gap.g;
      mapa.fitBounds(L.latLngBounds([g.de.latitude, g.de.longitude], [g.ate.latitude, g.ate.longitude]), { padding: [60, 60], maxZoom: 16 });
      return;
    }
    const trecho = trechoSelecionado(rota, eventos, selecionado);
    if (trecho && trecho.pontos.length > 0) {
      mapa.fitBounds(L.latLngBounds(trecho.pontos), { padding: [60, 60], maxZoom: 16 });
      return;
    }
    // Pedaço de parada recortado ("p-0-depois") usa o marcador da parada inteira.
    const marcador = marcadores.current?.[selecionado.replace(/-(antes|depois)$/, '')];
    if (marcador) {
      mapa.setView(marcador.getLatLng(), Math.max(mapa.getZoom(), 15));
      marcador.openPopup();
    }
  }, [mapa, selecionado, rota, eventos, marcadores]);

  return null;
}

// Passando o mouse perto do trajeto, mostra a hora e onde ele estava (docs/93).
function HoraAoPassar({ pontos }: { pontos: RotaDoDia['pontos'] }) {
  const mapa = useMap();
  useEffect(() => {
    if (typeof mapa.on !== 'function' || typeof mapa.latLngToContainerPoint !== 'function') return;
    const dica = L.tooltip({ direction: 'top', offset: [0, -6], className: '' });
    function mover(e: L.LeafletMouseEvent) {
      let melhor: RotaDoDia['pontos'][number] | null = null;
      let menor = 14;
      for (const p of pontos) {
        const pt = mapa.latLngToContainerPoint([p.latitude, p.longitude]);
        const d = Math.hypot(pt.x - e.containerPoint.x, pt.y - e.containerPoint.y);
        if (d < menor) {
          menor = d;
          melhor = p;
        }
      }
      if (!melhor) {
        dica.remove();
        return;
      }
      dica.setLatLng([melhor.latitude, melhor.longitude]).setContent(`<strong>${hora(melhor.em)}</strong>`);
      if (!mapa.hasLayer(dica)) dica.addTo(mapa);
    }
    function sair() {
      dica.remove();
    }
    mapa.on('mousemove', mover);
    mapa.on('mouseout', sair);
    return () => {
      mapa.off('mousemove', mover);
      mapa.off('mouseout', sair);
      dica.remove();
    };
  }, [mapa, pontos]);
  return null;
}

function Kpi({ titulo, valor, alerta, cor = COR.parada }: { titulo: string; valor: string; alerta?: boolean; cor?: string }) {
  return (
    <Paper
      variant="outlined"
      sx={{ px: 1.75, py: 1.25, borderRadius: 1.25, borderColor: alerta ? cor : undefined, bgcolor: alerta ? `${cor}10` : undefined }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {titulo}
      </Typography>
      <Typography sx={{ fontSize: 20, fontWeight: 700, color: alerta ? cor : undefined, fontVariantNumeric: 'tabular-nums' }}>
        {valor}
      </Typography>
    </Paper>
  );
}

export function RotaDoDiaPage() {
  // ?usuario=&data= — atalhos do Mapa ao vivo e do detalhe da visita abrem já filtrado.
  const [params, setParams] = useSearchParams();
  const usuarioUuid = params.get('usuario');
  const data = params.get('data') ?? hoje();
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [mostrarFora, setMostrarFora] = useState(false);
  const [mostrarArea, setMostrarArea] = useState(true);
  const [horaRegua, setHoraRegua] = useState<number | null>(null);
  const [tocando, setTocando] = useState(false);
  const marcadores = useRef<Record<string, L.Marker | null>>({});

  const promotoresQuery = useQuery({ queryKey: ['rotas', 'promotores'], queryFn: listarPromotoresRota });
  const rotaQuery = useQuery({
    queryKey: ['rotas', usuarioUuid, data],
    queryFn: () => buscarRotaDoDia(usuarioUuid!, data),
    enabled: !!usuarioUuid,
  });
  const rota = rotaQuery.data;
  const janela = useMemo(() => (rota ? janelaDaRota(rota) : null), [rota]);
  const eventos = useMemo(() => (rota && janela ? eventosDaRota(rota, janela) : []), [rota, janela]);
  const semPermissao =
    (axios.isAxiosError(promotoresQuery.error) && promotoresQuery.error.response?.status === 403) ||
    (axios.isAxiosError(rotaQuery.error) && rotaQuery.error.response?.status === 403);

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Rota do dia" />);

  function filtrar(novoUsuario: string | null, novaData: string) {
    const p = new URLSearchParams();
    if (novoUsuario) p.set('usuario', novoUsuario);
    p.set('data', novaData);
    setParams(p, { replace: true });
    setSelecionado(null);
    setHoraRegua(null);
    setTocando(false);
  }

  // Fora do expediente só aparece no mapa quando o gestor abre (recorte EXPEDIENTE).
  const verFora = !!janela && (!janela.recortado || (janela.podeAbrir && mostrarFora));
  const visivel = (iso: string) => !janela?.recortado || verFora || (ms(iso) >= janela.inicio && ms(iso) <= janela.fim);
  const foraDaJanela = (iso: string) => !!janela?.recortado && (ms(iso) < janela.inicio || ms(iso) > janela.fim);

  // Régua do dia: vai do início ao fim do que está à mostra.
  const limitesRegua = useMemo<[number, number] | null>(() => {
    if (!rota || !janela) return null;
    if (janela.recortado && !verFora) return [janela.inicio, janela.fim];
    const inicioDia = new Date(`${rota.data}T00:00:00`).getTime();
    const primeiro = rota.pontos[0] ? ms(rota.pontos[0].em) : inicioDia;
    const ultimo = rota.pontos.length ? ms(rota.pontos[rota.pontos.length - 1].em) : inicioDia + 86_399_000;
    return [Math.min(primeiro, janela.recortado ? janela.inicio : primeiro), Math.max(ultimo, janela.recortado ? janela.fim : ultimo)];
  }, [rota, janela, verFora]);

  useEffect(() => {
    if (!tocando || !limitesRegua) return;
    const id = window.setInterval(() => {
      setHoraRegua((atual) => {
        const proxima = (atual ?? limitesRegua[0]) + 3 * 60_000;
        if (proxima >= limitesRegua[1]) {
          setTocando(false);
          return limitesRegua[1];
        }
        return proxima;
      });
    }, 60);
    return () => window.clearInterval(id);
  }, [tocando, limitesRegua]);

  const promotores = promotoresQuery.data ?? [];
  const vazio = rota && rota.pontos.length === 0 && rota.visitas.length === 0;
  const trecho = rota ? trechoSelecionado(rota, eventos, selecionado) : null;
  const etiquetas = rota && janela ? etiquetasDeHora(rota, eventos, trecho, visivel) : [];
  const posicaoRegua = rota && horaRegua !== null ? posicaoNaHora(rota, horaRegua) : null;
  const raioArea = rota?.area_roteiro?.raio_metros ?? 0;

  return (
    <Box>
      {cabecalho}

      {semPermissao ? (
        <Alert severity="warning">Seu perfil não tem a permissão "Ver a rota do dia".</Alert>
      ) : (
        <>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Autocomplete
              size="small"
              sx={{ width: 280 }}
              options={promotores}
              loading={promotoresQuery.isLoading}
              getOptionLabel={(o) => o.nome}
              value={promotores.find((p) => p.id === usuarioUuid) ?? null}
              onChange={(_, v) => filtrar(v?.id ?? null, data)}
              renderInput={(p) => <TextField {...p} label="Promotor" />}
            />
            <TextField
              size="small"
              type="date"
              label="Dia"
              value={data}
              onChange={(e) => e.target.value && filtrar(usuarioUuid, e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: hoje() } }}
            />
            {rota && janela?.recortado && (
              <Box
                sx={{ px: 1.5, height: 40, display: 'flex', alignItems: 'center', borderRadius: 1, bgcolor: horus.indigoClaro, color: COR.rota, fontWeight: 600, fontSize: 13 }}
              >
                Expediente {hora(rota.expediente.inicio)}–{hora(rota.expediente.fim)}
              </Box>
            )}
          </Box>

          {!usuarioUuid && (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
              <Typography color="text.secondary">
                Escolha um promotor pra ver por onde ele passou no dia: o trajeto, as lojas visitadas com os horários e
                as paradas fora de loja.
              </Typography>
            </Paper>
          )}

          {usuarioUuid && rotaQuery.isLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress />
            </Box>
          )}
          {rotaQuery.isError && !semPermissao && <Alert severity="error">Não foi possível carregar a rota desse dia.</Alert>}

          {rota && janela && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.25, mb: 2 }}>
                <Kpi titulo="Visitas" valor={String(rota.resumo.visitas)} />
                <Kpi titulo="Tempo em loja" valor={duracao(rota.resumo.tempo_em_loja_minutos)} />
                <Kpi
                  titulo={janela.recortado ? 'Distância no expediente' : 'Distância percorrida'}
                  valor={`${rota.resumo.distancia_km.toLocaleString('pt-BR')} km`}
                />
                {raioArea > 0 && (
                  <Kpi
                    titulo="Fora da área do roteiro"
                    valor={duracao(rota.resumo.fora_da_area_minutos ?? 0)}
                    alerta={(rota.resumo.fora_da_area_minutos ?? 0) > 0}
                    cor={COR.desvio}
                  />
                )}
                <Kpi
                  titulo="Fora da loja durante visita"
                  valor={duracao(rota.resumo.fora_da_loja_minutos)}
                  alerta={rota.resumo.fora_da_loja_minutos > 0}
                  cor={COR.fora}
                />
                <Kpi titulo="Parado fora de loja" valor={duracao(rota.resumo.parado_fora_minutos)} alerta={rota.resumo.parado_fora_minutos > 0} />
                <Kpi titulo="Sem sinal" valor={duracao(rota.resumo.sem_sinal_minutos)} />
              </Box>

              {rota.aproximada && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  Linha aproximada: o serviço que encaixa o trajeto nas ruas não respondeu agora, então a linha liga as
                  posições em reta. Recarregue mais tarde.
                </Alert>
              )}

              {vazio ? (
                <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
                  <Typography color="text.secondary">
                    Nenhuma posição nem visita registrada nesse dia. A rota só existe quando o rastreamento estava ligado
                    no aplicativo do promotor (e o histórico começou a ser guardado em 30/09/2026).
                  </Typography>
                </Paper>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 360px' }, gap: 2, alignItems: 'start' }}>
                  <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
                    {(janela.podeAbrir || raioArea > 0) && (
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', px: 1.5, py: 0.25, borderBottom: '1px solid', borderColor: 'divider' }}>
                        {janela.podeAbrir && (
                          <FormControlLabel
                            control={<Checkbox size="small" checked={mostrarFora} onChange={(e) => setMostrarFora(e.target.checked)} />}
                            label={<Typography variant="body2">Mostrar fora do expediente</Typography>}
                          />
                        )}
                        {raioArea > 0 && (
                          <FormControlLabel
                            control={<Checkbox size="small" checked={mostrarArea} onChange={(e) => setMostrarArea(e.target.checked)} />}
                            label={<Typography variant="body2">Área do roteiro</Typography>}
                          />
                        )}
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', display: { xs: 'none', md: 'block' } }}>
                          Passe o mouse no trajeto pra ver o horário
                        </Typography>
                      </Box>
                    )}
                    <MapContainer center={[-3.1, -60.0]} zoom={13} scrollWheelZoom={false} style={{ height: 560, width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <ZoomComCtrl />
                      <ControleMapa rota={rota} eventos={eventos} selecionado={selecionado} marcadores={marcadores} />
                      <HoraAoPassar pontos={rota.pontos.filter((p) => visivel(p.em))} />

                      {/* Área do roteiro: raio em volta das lojas do dia (docs/93). */}
                      {mostrarArea &&
                        raioArea > 0 &&
                        rota.area_roteiro.lojas.map((l, i) => (
                          <Circle
                            key={`area-${i}`}
                            center={[l.latitude, l.longitude]}
                            radius={raioArea}
                            interactive={false}
                            pathOptions={{ color: COR.rota, weight: 0, fillOpacity: 0.06 }}
                          />
                        ))}

                      {rota.linhas.map((linha, i) => {
                        const fora = !!rota.linhas_fora_expediente?.[i];
                        if (fora && !verFora) return null;
                        return (
                          <Polyline
                            key={`l-${i}`}
                            positions={linha}
                            pathOptions={
                              fora
                                ? { color: COR.foraExpediente, weight: 3, opacity: 0.8, dashArray: '1 7' }
                                : { color: COR.rota, weight: 5, opacity: trecho ? 0.35 : 0.85 }
                            }
                          />
                        );
                      })}
                      {rota.sem_sinal.map((g, i) =>
                        visivel(g.inicio) && visivel(g.fim) ? (
                          <Polyline
                            key={`g-${i}`}
                            positions={[[g.de.latitude, g.de.longitude], [g.ate.latitude, g.ate.longitude]]}
                            pathOptions={{ color: COR.gap, weight: 4, dashArray: '8 8' }}
                          />
                        ) : null,
                      )}
                      {/* Fora da área do roteiro — magenta, por cima do trajeto (pontos brutos). */}
                      {(rota.desvios ?? []).map((d, i) => (
                        <Polyline
                          key={`desv-${i}`}
                          positions={d.pontos}
                          pathOptions={{ color: COR.desvio, weight: 6, opacity: 0.9 }}
                          eventHandlers={{ click: () => setSelecionado(`desv-${i}`) }}
                        />
                      ))}
                      {/* Saída da loja durante a visita — por cima do trajeto (pontos brutos, não casados nas ruas). */}
                      {rota.visitas.flatMap((v) =>
                        v.afastamentos.map((a, i) => (
                          <Polyline
                            key={`a-${v.id}-${i}`}
                            positions={a.pontos}
                            pathOptions={{ color: COR.fora, weight: 6, opacity: 0.9 }}
                            eventHandlers={{ click: () => setSelecionado(`a-${v.id}-${i}`) }}
                          />
                        )),
                      )}
                      {/* Trecho escolhido na linha do tempo, com contorno branco pra destacar. */}
                      {trecho && trecho.pontos.length > 1 && (
                        <>
                          <Polyline positions={trecho.pontos} pathOptions={{ color: '#ffffff', weight: 11, opacity: 0.9 }} />
                          <Polyline positions={trecho.pontos} pathOptions={{ color: trecho.cor, weight: 6, opacity: 1 }} />
                        </>
                      )}

                      {etiquetas.map((e) => (
                        <Marker key={`h-${e.em}`} position={e.posicao} icon={etiquetaHora(e.texto)} interactive={false} />
                      ))}

                      {(() => {
                        const inicio = eventos.find((e) => e.tipo === 'inicio');
                        if (!inicio || inicio.tipo !== 'inicio') return null;
                        return (
                          <Marker
                            position={[inicio.lat, inicio.lng]}
                            icon={pino(COR.inicio, '')}
                            ref={(m) => {
                              marcadores.current.inicio = m;
                            }}
                          >
                            <Popup>
                              <strong>Início</strong>
                              <br />
                              Primeira posição{janela.recortado ? ' no expediente' : ''} às {hora(inicio.em)}
                            </Popup>
                          </Marker>
                        );
                      })()}

                      {/* Loja da agenda que não foi visitada (entra na área do roteiro). */}
                      {mostrarArea &&
                        raioArea > 0 &&
                        rota.area_roteiro.lojas
                          .filter((l) => !l.visitada)
                          .map((l, i) => (
                            <Marker key={`ag-${i}`} position={[l.latitude, l.longitude]} icon={pinoAgenda}>
                              <Popup>
                                <strong>{l.fantasia ?? 'Loja da agenda'}</strong>
                                <br />
                                Na agenda do dia, não visitada. Ir pra perto dela não conta como desvio.
                              </Popup>
                            </Marker>
                          ))}

                      {rota.visitas.map((v) => (
                        <Marker
                          key={v.id}
                          position={[v.latitude, v.longitude]}
                          icon={pino(COR.rota, String(v.ordem), v.afastamentos.length > 0)}
                          ref={(m) => {
                            marcadores.current[`v-${v.id}`] = m;
                          }}
                          eventHandlers={{ click: () => setSelecionado(`v-${v.id}`) }}
                        >
                          <Popup>
                            <strong>
                              {v.ordem} · {v.ponto_venda?.fantasia ?? 'Visita'}
                            </strong>
                            <br />
                            Chegou: {hora(v.inicio)}
                            <br />
                            Saiu: {v.fim ? hora(v.fim) : 'ainda na loja'}
                            <br />
                            Ficou: {duracao(v.minutos)}
                            {v.minutos_fora > 0 && ` · ${duracao(v.minutos_fora)} fora`}
                            {v.afastamentos.map((a, i) => (
                              <span key={i} style={{ display: 'block', color: COR.fora, fontWeight: 600, marginTop: 4 }}>
                                {textoAfastamento(a)}
                              </span>
                            ))}
                            <br />
                            <Link to={`/visitas/${v.id}`}>Ver visita</Link>
                          </Popup>
                        </Marker>
                      ))}

                      {rota.paradas.map((p, i) => {
                        const dentro = !janela.recortado || (ms(p.fim) > janela.inicio && ms(p.inicio) < janela.fim);
                        if (!dentro && !verFora) return null;
                        return (
                          <Marker
                            key={`p-${i}`}
                            position={[p.latitude, p.longitude]}
                            icon={pino(dentro ? COR.parada : COR.foraExpediente, 'P')}
                            ref={(m) => {
                              marcadores.current[`p-${i}`] = m;
                            }}
                            eventHandlers={{ click: () => setSelecionado(`p-${i}`) }}
                          >
                            <Popup>
                              <strong>Parado fora de loja</strong>
                              <br />
                              Das {hora(p.inicio)} às {hora(p.fim)} ({duracao(p.minutos)})
                              {p.bairro && (
                                <>
                                  <br />
                                  {p.bairro}
                                </>
                              )}
                              <br />
                              Nenhuma loja cadastrada num raio de 300 m
                              <br />
                              <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer">
                                Ver endereço no Google Maps
                              </a>
                            </Popup>
                          </Marker>
                        );
                      })}

                      {posicaoRegua && (
                        <Marker
                          position={posicaoRegua.posicao}
                          icon={pinoAgora(rota.promotor.nome.charAt(0).toUpperCase(), posicaoRegua.semPosicao)}
                          interactive={false}
                          zIndexOffset={1000}
                        />
                      )}
                    </MapContainer>

                    {limitesRegua && limitesRegua[1] > limitesRegua[0] && (
                      <ReguaDoDia
                        rota={rota}
                        eventos={eventos}
                        limites={limitesRegua}
                        janela={janela}
                        valor={horaRegua}
                        tocando={tocando}
                        foraDaJanela={foraDaJanela}
                        onMudar={(v) => {
                          setTocando(false);
                          setHoraRegua(v);
                        }}
                        onTocar={() => {
                          if (!tocando && (horaRegua === null || horaRegua >= limitesRegua[1])) setHoraRegua(limitesRegua[0]);
                          setTocando(!tocando);
                        }}
                      />
                    )}

                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', px: 1.75, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Legenda cor={COR.rota} texto={rota.aproximada ? 'Trajeto (aproximado)' : 'Trajeto seguindo as ruas'} linha />
                      {raioArea > 0 && (
                        <Legenda
                          cor={COR.desvio}
                          texto={`Fora da área do roteiro (mais de ${distancia(raioArea)} das lojas do dia por ${rota.parametros.desvio_minutos} min)`}
                          linha
                        />
                      )}
                      <Legenda cor={COR.gap} texto="Sem sinal" tracejada />
                      {janela.recortado && verFora && <Legenda cor={COR.foraExpediente} texto="Fora do expediente" pontilhada />}
                      <Legenda cor={COR.rota} texto="Visita, na ordem" />
                      {raioArea > 0 && rota.area_roteiro.lojas.some((l) => !l.visitada) && <Legenda cor={COR.rota} texto="Na agenda, não visitada" oca />}
                      <Legenda cor={COR.parada} texto={`Parado fora de loja (${rota.parametros.parada_minutos} min ou mais)`} />
                      <Legenda
                        cor={COR.fora}
                        texto={`Saiu da loja durante a visita (mais de ${distancia(rota.parametros.afastamento_metros)} por ${rota.parametros.afastamento_minutos} min)`}
                        linha
                      />
                    </Box>
                  </Paper>

                  <Paper variant="outlined" sx={{ borderRadius: 1.5, overflow: 'hidden' }}>
                    <Box sx={{ px: 1.75, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <Typography sx={{ fontWeight: 700 }}>Linha do tempo</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(`${rota.data}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      </Typography>
                    </Box>
                    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, py: 0.75, maxHeight: 720, overflowY: 'auto' }}>
                      {(() => {
                        const itens = (lista: Evento[], esmaecido = false) =>
                          lista.map((ev, i) => (
                            <ItemLinhaDoTempo
                              key={ev.chave}
                              evento={ev}
                              ultimo={i === lista.length - 1}
                              selecionado={selecionado === ev.chave}
                              esmaecido={esmaecido}
                              onClick={() => {
                                if (ev.lado) setMostrarFora(true);
                                setSelecionado(ev.chave);
                              }}
                              onDoubleClick={() => abrirNoGoogleMaps(ev)}
                            />
                          ));
                        if (!janela.recortado) return itens(eventos);
                        const antes = eventos.filter((e) => e.lado === 'antes');
                        const depois = eventos.filter((e) => e.lado === 'depois');
                        const dentro = eventos.filter((e) => !e.lado);
                        return (
                          <>
                            <GrupoForaDoExpediente
                              titulo={`Antes do expediente · até ${hora(rota.expediente.inicio)}`}
                              resumo={rota.fora_do_expediente?.antes ?? null}
                              podeAbrir={janela.podeAbrir}
                              aberto={mostrarFora}
                              onAlternar={() => setMostrarFora(!mostrarFora)}
                            />
                            {janela.podeAbrir && mostrarFora && itens(antes, true)}
                            {itens(dentro)}
                            <GrupoForaDoExpediente
                              titulo={`Depois do expediente · a partir de ${hora(rota.expediente.fim)}`}
                              resumo={rota.fora_do_expediente?.depois ?? null}
                              podeAbrir={janela.podeAbrir}
                              aberto={mostrarFora}
                              onAlternar={() => setMostrarFora(!mostrarFora)}
                            />
                            {janela.podeAbrir && mostrarFora && itens(depois, true)}
                          </>
                        );
                      })()}
                      {rota.resumo.ultima_posicao_em && !janela.recortado && (
                        <Box component="li" sx={{ px: 1.75, pt: 1, color: 'text.secondary', fontSize: 12 }}>
                          Última posição às {hora(rota.resumo.ultima_posicao_em)}
                        </Box>
                      )}
                    </Box>
                  </Paper>
                </Box>
              )}
            </>
          )}
        </>
      )}
    </Box>
  );
}

// Horários escritos no trajeto: de hora em hora no dia (só em movimento) ou de 15 em 15 min no
// trecho selecionado. Etiqueta perto demais de outra (menos de 300 m) não entra.
function etiquetasDeHora(
  rota: RotaDoDia,
  eventos: Evento[],
  trecho: ReturnType<typeof trechoSelecionado>,
  visivel: (iso: string) => boolean,
): { em: string; posicao: LatLng; texto: string }[] {
  if (rota.pontos.length < 2) return [];
  const passo = (trecho ? 15 : 60) * 60_000;
  const de = trecho ? ms(trecho.inicio) : ms(rota.pontos[0].em);
  const ate = trecho ? ms(trecho.fim) : ms(rota.pontos[rota.pontos.length - 1].em);
  const parado = (t: number) =>
    eventos.some((e) => (e.tipo === 'visita' && t >= ms(e.v.inicio) && t <= ms(e.v.fim ?? e.v.inicio)) || (e.tipo === 'parada' && t >= ms(e.p.inicio) && t <= ms(e.p.fim)));

  const resultado: { em: string; posicao: LatLng; texto: string }[] = [];
  let i = 0;
  for (let t = Math.ceil(de / passo) * passo; t <= ate; t += passo) {
    while (i < rota.pontos.length && ms(rota.pontos[i].em) < t) i++;
    const p = rota.pontos[i];
    // Só usa o ponto se chegou até 5 min depois da hora cheia (sem sinal não inventa posição).
    if (!p || ms(p.em) - t > 5 * 60_000 || !visivel(p.em)) continue;
    if (!trecho && parado(t)) continue;
    const posicao: LatLng = [p.latitude, p.longitude];
    if (resultado.some((r) => metrosAprox(r.posicao, posicao) < 300)) continue;
    resultado.push({ em: p.em, posicao, texto: horaMs(t) });
  }
  return resultado;
}

// Última posição conhecida na hora da régua; `semPosicao` = caiu num buraco sem sinal.
function posicaoNaHora(rota: RotaDoDia, t: number): { posicao: LatLng; semPosicao: boolean } | null {
  let ultimo: RotaDoDia['pontos'][number] | null = null;
  for (const p of rota.pontos) {
    if (ms(p.em) > t) break;
    ultimo = p;
  }
  if (!ultimo) return null;
  const semPosicao = rota.sem_sinal.some((g) => t > ms(g.inicio) && t < ms(g.fim));
  return { posicao: [ultimo.latitude, ultimo.longitude], semPosicao };
}

// Situação numa hora — a frase embaixo da régua e a cor da faixa.
type Situacao = 'fora-expediente' | 'gap' | 'afastamento' | 'visita' | 'desvio' | 'parada' | 'deslocamento' | 'nada';
const COR_SITUACAO: Record<Situacao, string> = {
  'fora-expediente': COR.foraExpediente,
  gap: COR.gap,
  afastamento: COR.fora,
  visita: COR.rota,
  desvio: COR.desvio,
  parada: COR.parada,
  deslocamento: '#a5b4fc',
  nada: 'transparent',
};

function situacaoNaHora(eventos: Evento[], t: number, foraDaJanela: (iso: string) => boolean): { situacao: Situacao; evento: Evento | null } {
  if (foraDaJanela(new Date(t).toISOString())) return { situacao: 'fora-expediente', evento: null };
  const dentro = (inicio: string, fim: string | null) => t >= ms(inicio) && t <= ms(fim ?? inicio);
  const ordem: [Situacao, (e: Evento) => boolean][] = [
    ['gap', (e) => e.tipo === 'gap' && t > ms(e.g.inicio) && t < ms(e.g.fim)],
    ['afastamento', (e) => e.tipo === 'afastamento' && dentro(e.a.inicio, e.a.fim ?? e.v.fim)],
    ['visita', (e) => e.tipo === 'visita' && dentro(e.v.inicio, e.v.fim ?? new Date().toISOString())],
    ['desvio', (e) => e.tipo === 'desvio' && dentro(e.d.inicio, e.d.fim)],
    ['parada', (e) => e.tipo === 'parada' && dentro(e.p.inicio, e.p.fim)],
    ['deslocamento', (e) => e.tipo === 'deslocamento' && dentro(e.d.inicio, e.d.fim)],
  ];
  for (const [situacao, cobre] of ordem) {
    const evento = eventos.find(cobre);
    if (evento) return { situacao, evento };
  }
  return { situacao: 'nada', evento: null };
}

function ReguaDoDia({
  rota,
  eventos,
  limites,
  janela,
  valor,
  tocando,
  foraDaJanela,
  onMudar,
  onTocar,
}: {
  rota: RotaDoDia;
  eventos: Evento[];
  limites: [number, number];
  janela: Janela;
  valor: number | null;
  tocando: boolean;
  foraDaJanela: (iso: string) => boolean;
  onMudar: (v: number) => void;
  onTocar: () => void;
}) {
  const [de, ate] = limites;
  const pct = (t: number) => ((t - de) / (ate - de)) * 100;

  // Faixa colorida: um pedaço por minuto agrupado em blocos da mesma situação.
  const faixas = useMemo(() => {
    const blocos: { de: number; ate: number; situacao: Situacao }[] = [];
    const passo = Math.max(60_000, Math.round((ate - de) / 600));
    for (let t = de; t <= ate; t += passo) {
      const { situacao } = situacaoNaHora(eventos, t, foraDaJanela);
      const ultimo = blocos[blocos.length - 1];
      if (ultimo && ultimo.situacao === situacao) ultimo.ate = t + passo;
      else blocos.push({ de: t, ate: t + passo, situacao });
    }
    return blocos;
  }, [eventos, de, ate, foraDaJanela]);

  const horas = useMemo(() => {
    const passo = ate - de > 14 * 3_600_000 ? 3 * 3_600_000 : 3_600_000;
    const lista: number[] = [];
    for (let t = Math.ceil(de / passo) * passo; t <= ate; t += passo) lista.push(t);
    return lista;
  }, [de, ate]);

  const atual = valor ?? ate;
  const { situacao, evento } = situacaoNaHora(eventos, atual, foraDaJanela);
  const posicao = posicaoNaHora(rota, atual);
  const frase = (() => {
    switch (situacao) {
      case 'fora-expediente':
        return 'Fora do expediente';
      case 'gap':
        return 'Sem sinal';
      case 'afastamento':
        return evento?.tipo === 'afastamento' ? `Longe da loja durante a visita · ${evento.v.ponto_venda?.fantasia ?? ''}` : '';
      case 'visita':
        return evento?.tipo === 'visita' ? `Em visita · ${evento.v.ponto_venda?.fantasia ?? 'loja'}` : '';
      case 'desvio':
        return evento?.tipo === 'desvio' ? `Fora da área do roteiro${evento.d.bairros.length ? ` · ${bairrosTexto(evento.d.bairros)}` : ''}` : '';
      case 'parada':
        return evento?.tipo === 'parada' ? `Parado fora de loja${evento.p.bairro ? ` · ${evento.p.bairro}` : ''}` : '';
      case 'deslocamento':
        return evento?.tipo === 'deslocamento' ? `Em deslocamento${evento.d.bairros.length ? ` · ${bairrosTexto(evento.d.bairros)}` : ''}` : '';
      default:
        return posicao ? 'Sem visita nem deslocamento registrado' : 'Ainda sem posição';
    }
  })();

  return (
    <Box sx={{ px: 1.75, pt: 1.25, pb: 1, borderTop: '1px solid', borderColor: 'divider' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr)', columnGap: 1.5, alignItems: 'center' }}>
        <IconButton size="small" onClick={onTocar} aria-label={tocando ? 'Pausar' : 'Reproduzir o dia'} sx={{ border: '1px solid', borderColor: 'divider' }}>
          {tocando ? <PauseRounded fontSize="small" /> : <PlayArrowRounded fontSize="small" />}
        </IconButton>
        {/* zIndex acima das camadas do Leaflet (painéis 400–700, controles 1000): o balão do horário
            do Slider sobe por cima do mapa e, sem isso, ficava escondido atrás dele. */}
        <Box sx={{ position: 'relative', height: 30, zIndex: 1100 }}>
          {faixas.map((f, i) => (
            <Box
              key={i}
              sx={{
                position: 'absolute',
                top: 10,
                height: 10,
                left: `${pct(f.de)}%`,
                width: `${Math.max(0.2, pct(Math.min(f.ate, ate)) - pct(f.de))}%`,
                bgcolor: COR_SITUACAO[f.situacao],
                opacity: f.situacao === 'fora-expediente' ? 0.35 : 1,
              }}
            />
          ))}
          {janela.recortado && de < janela.inicio && (
            <Box
              sx={{
                position: 'absolute',
                top: 6,
                height: 18,
                left: `${pct(janela.inicio)}%`,
                width: `${pct(Math.min(janela.fim, ate)) - pct(janela.inicio)}%`,
                border: `1.5px solid ${COR.rota}`,
                borderRadius: 0.5,
                pointerEvents: 'none',
              }}
            />
          )}
          <Slider
            size="small"
            min={de}
            max={ate}
            step={60_000}
            value={atual}
            onChange={(_, v) => onMudar(v as number)}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => horaMs(v)}
            aria-label="Horário do dia"
            sx={{
              position: 'absolute',
              inset: 0,
              py: 0,
              height: 30,
              color: 'text.primary',
              '& .MuiSlider-rail, & .MuiSlider-track': { opacity: 0 },
              '& .MuiSlider-thumb': { width: 4, height: 28, borderRadius: 1 },
            }}
          />
        </Box>
        <Box />
        <Box sx={{ position: 'relative', height: 14 }}>
          {horas.map((t) => (
            <Typography
              key={t}
              component="span"
              sx={{ position: 'absolute', left: `${pct(t)}%`, transform: 'translateX(-50%)', fontFamily: '"IBM Plex Mono", monospace', fontSize: 10, color: 'text.secondary' }}
            >
              {horaMs(t)}
            </Typography>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap', mt: 0.75 }}>
        <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 600 }}>{horaMs(atual)}</Typography>
        <Typography variant="body2" sx={{ color: situacao === 'desvio' ? COR.desvio : situacao === 'afastamento' ? COR.fora : 'text.primary', fontWeight: situacao === 'desvio' || situacao === 'afastamento' ? 600 : 400 }}>
          {rota.promotor.nome}: {frase}
        </Typography>
        {valor === null && (
          <Typography variant="caption" color="text.secondary">
            arraste a régua ou aperte ▶ pra ver onde ele estava em cada horário
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function GrupoForaDoExpediente({
  titulo,
  resumo,
  podeAbrir,
  aberto,
  onAlternar,
}: {
  titulo: string;
  resumo: { distancia_km: number; parado_fora_minutos: number; sem_sinal_minutos: number; posicoes: number } | null;
  podeAbrir: boolean;
  aberto: boolean;
  onAlternar: () => void;
}) {
  const partes = resumo
    ? [
        resumo.parado_fora_minutos > 0 && `${duracao(resumo.parado_fora_minutos)} parado`,
        resumo.sem_sinal_minutos > 0 && `${duracao(resumo.sem_sinal_minutos)} sem sinal`,
        resumo.distancia_km >= 0.5 && `${resumo.distancia_km.toLocaleString('pt-BR')} km rodados`,
      ].filter(Boolean)
    : [];
  const texto = !podeAbrir
    ? 'Não aparece: a empresa mostra só o expediente'
    : resumo && resumo.posicoes === 0 && partes.length === 0
      ? 'Sem posições'
      : partes.join(' · ') || 'Algumas posições, sem parada nem deslocamento';
  return (
    <Box
      component="li"
      sx={{ mx: 1.25, my: 0.5, px: 1.25, py: 0.75, border: '1px dashed', borderColor: 'divider', borderRadius: 1, display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {texto}
        </Typography>
      </Box>
      {podeAbrir && (
        <Button size="small" variant="outlined" onClick={onAlternar} sx={{ flex: 'none' }}>
          {aberto ? 'Esconder' : 'Ver'}
        </Button>
      )}
    </Box>
  );
}

function Legenda({
  cor,
  texto,
  linha,
  tracejada,
  pontilhada,
  oca,
}: {
  cor: string;
  texto: string;
  linha?: boolean;
  tracejada?: boolean;
  pontilhada?: boolean;
  oca?: boolean;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary' }}>
      {linha || tracejada || pontilhada ? (
        <Box sx={{ width: 22, borderTop: `${linha ? 4 : 3}px ${tracejada ? 'dashed' : pontilhada ? 'dotted' : 'solid'} ${cor}` }} />
      ) : oca ? (
        <Box sx={{ width: 14, height: 14, borderRadius: '50%', border: `2px dashed ${cor}`, boxSizing: 'border-box' }} />
      ) : (
        <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: cor }} />
      )}
      {texto}
    </Box>
  );
}

function ItemLinhaDoTempo({
  evento,
  ultimo,
  selecionado,
  esmaecido,
  onClick,
  onDoubleClick,
}: {
  evento: Evento;
  ultimo: boolean;
  selecionado: boolean;
  esmaecido?: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const leve = evento.tipo === 'deslocamento';
  const bola = (() => {
    switch (evento.tipo) {
      case 'inicio':
        return { bg: COR.inicio, texto: '', borda: undefined };
      case 'visita':
        return { bg: COR.rota, texto: String(evento.v.ordem), borda: undefined };
      case 'parada':
        return { bg: evento.lado ? COR.foraExpediente : COR.parada, texto: 'P', borda: undefined };
      case 'afastamento':
        return { bg: COR.fora, texto: '!', borda: undefined };
      case 'desvio':
        return { bg: COR.desvio, texto: '↗', borda: undefined };
      case 'deslocamento':
        return { bg: 'background.paper', texto: '', borda: `2px solid ${COR.rota}` };
      case 'marco':
        return { bg: horus.indigoClaro, texto: '', borda: `2px solid ${COR.rota}` };
      default:
        return { bg: 'transparent', texto: '', borda: `2px dashed ${COR.gap}` };
    }
  })();

  // Pedaço cortado na borda do expediente: avisa que segue do outro lado.
  const notaCorte = (() => {
    const cortado =
      (evento.tipo === 'parada' && evento.p.cortado) || (evento.tipo === 'gap' && evento.g.cortado) || (evento.tipo === 'deslocamento' && evento.d.cortado);
    if (!cortado) return '';
    if (evento.lado === 'antes') return ' · continua no expediente';
    if (evento.lado === 'depois') return ' · começou no expediente';
    return ' · cortado no horário do expediente';
  })();

  const [titulo, detalhe, tag, corTag] = ((): [string, string, string | null, 'parada' | 'fora' | 'desvio' | 'neutra'] => {
    switch (evento.tipo) {
      case 'inicio':
        return ['Início', evento.detalhe, null, 'neutra'];
      case 'visita':
        return [
          evento.v.ponto_venda?.fantasia ?? 'Visita',
          (evento.v.fim ? `até ${hora(evento.v.fim)} · ficou ${duracao(evento.v.minutos)}` : 'ainda na loja') +
            (evento.v.minutos_fora > 0 ? ` · ${duracao(evento.v.minutos_fora)} fora` : ''),
          null,
          'neutra',
        ];
      case 'afastamento':
        return [
          'Saiu da loja durante a visita',
          `${evento.v.ponto_venda?.fantasia ?? 'Visita'} · ${evento.a.fim ? `voltou às ${hora(evento.a.fim)}` : 'não voltou antes do checkout'} · foi até ${distancia(evento.a.distancia_max_metros)}`,
          `${duracao(evento.a.minutos)} fora`,
          'fora',
        ];
      case 'desvio':
        return [
          'Fora da área do roteiro',
          `das ${hora(evento.d.inicio)} às ${hora(evento.d.fim)} · até ${distancia(evento.d.distancia_max_metros)} da loja mais próxima` +
            (evento.d.bairros.length ? ` · passou por ${evento.d.bairros.join(', ')}` : ''),
          `${duracao(evento.d.minutos)} fora da área`,
          'desvio',
        ];
      case 'deslocamento':
        return [
          `Deslocamento · ${duracao(evento.d.minutos)} · ${distancia(evento.d.distancia_metros)}${evento.d.bairros.length > 1 ? ` · ${bairrosTexto(evento.d.bairros)}` : ''}${notaCorte}`,
          '',
          null,
          'neutra',
        ];
      case 'parada':
        return [
          'Parado fora de loja',
          `até ${hora(evento.p.fim)} · ${evento.p.bairro ? `${evento.p.bairro} · ` : ''}nenhuma loja num raio de 300 m${notaCorte}`,
          `${duracao(evento.p.minutos)} parado`,
          'parada',
        ];
      case 'marco':
        return [evento.titulo, evento.detalhe, null, 'neutra'];
      default:
        return ['Sem sinal', `até ${hora(evento.g.fim)}${notaCorte}`, `${duracao(evento.g.minutos)} sem posição`, 'neutra'];
    }
  })();

  const coresTag = {
    parada: { bg: horus.ambarClaro, fg: COR.parada },
    fora: { bg: horus.problemaClaro, fg: COR.fora },
    desvio: { bg: `${COR.desvio}1f`, fg: COR.desvio },
    neutra: { bg: 'action.hover', fg: 'text.secondary' },
  }[corTag];

  return (
    <Box
      component="li"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      title="Clique duplo para abrir no Google Maps"
      sx={{
        display: 'grid',
        gridTemplateColumns: '48px 22px minmax(0, 1fr)',
        columnGap: 0.75,
        px: 1.5,
        py: leve ? 0.25 : 0.75,
        cursor: 'pointer',
        userSelect: 'none',
        opacity: esmaecido ? 0.65 : 1,
        borderLeft: '3px solid',
        borderLeftColor: selecionado ? COR.rota : 'transparent',
        bgcolor: selecionado ? horus.indigoClaro : 'transparent',
        '&:hover': { bgcolor: selecionado ? horus.indigoClaro : 'action.hover' },
      }}
    >
      <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: 'text.secondary', pt: 0.25 }}>{hora(evento.em)}</Typography>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!ultimo && <Box sx={{ position: 'absolute', top: 4, bottom: -12, width: '2px', bgcolor: 'divider' }} />}
        <Box
          sx={{
            position: 'relative',
            width: leve ? 10 : 20,
            height: leve ? 10 : 20,
            mt: leve ? 0.6 : 0,
            borderRadius: '50%',
            bgcolor: bola.bg,
            border: bola.borda,
            boxSizing: 'border-box',
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {bola.texto}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant={leve ? 'caption' : 'body2'}
          sx={{ fontWeight: leve ? 500 : 600, color: leve ? 'text.secondary' : evento.tipo === 'marco' ? COR.rota : undefined, display: 'block' }}
          noWrap={!leve}
        >
          {titulo}
        </Typography>
        {detalhe && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {detalhe}
          </Typography>
        )}
        {tag && (
          <Box
            component="span"
            sx={{ display: 'inline-block', mt: 0.25, fontSize: 11, fontWeight: 700, px: 1, borderRadius: 99, bgcolor: coresTag.bg, color: coresTag.fg }}
          >
            {tag}
          </Box>
        )}
      </Box>
    </Box>
  );
}

import { Alert, Autocomplete, Box, CircularProgress, Paper, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { Link, useSearchParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { ZoomComCtrl } from '../../components/mapa/ZoomComCtrl';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { buscarRotaDoDia, listarPromotoresRota, type RotaDoDia } from '../../lib/api/rotas';
import type { AfastamentoTrecho } from '../../types/api';

// Rota do dia — por onde o promotor passou num dia: trajeto seguindo as ruas, visitas numeradas
// com chegada/saída, paradas fora de loja e trechos sem sinal. docs/48-ROTA-DO-DIA.md; protótipo
// aprovado em https://claude.ai/artifact/Suz8gHAQg15H72e73nqeZf. Saída da loja no meio da visita
// (trecho vermelho, selo no pino): docs/49-AFASTAMENTO-DURANTE-VISITA.md.

const COR = { rota: '#4f46e5', gap: '#8a87a3', parada: '#ea580c', inicio: '#15803d', fora: '#dc2626' };

type Visita = RotaDoDia['visitas'][number];

function hoje(): string {
  return new Date().toLocaleDateString('en-CA');
}

function hora(iso: string | null): string {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

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

type Evento =
  | { chave: string; tipo: 'inicio'; em: string; lat: number; lng: number }
  | { chave: string; tipo: 'visita'; em: string; v: Visita }
  | { chave: string; tipo: 'afastamento'; em: string; v: Visita; a: AfastamentoTrecho }
  | { chave: string; tipo: 'parada'; em: string; p: RotaDoDia['paradas'][number] }
  | { chave: string; tipo: 'gap'; em: string; g: RotaDoDia['sem_sinal'][number] };

function eventosDaRota(rota: RotaDoDia): Evento[] {
  const eventos: Evento[] = [];
  const primeiro = rota.pontos[0];
  if (primeiro) eventos.push({ chave: 'inicio', tipo: 'inicio', em: primeiro.em, lat: primeiro.latitude, lng: primeiro.longitude });
  rota.visitas.forEach((v) => {
    eventos.push({ chave: `v-${v.id}`, tipo: 'visita', em: v.inicio, v });
    v.afastamentos.forEach((a, i) => eventos.push({ chave: `a-${v.id}-${i}`, tipo: 'afastamento', em: a.inicio, v, a }));
  });
  rota.paradas.forEach((p, i) => eventos.push({ chave: `p-${i}`, tipo: 'parada', em: p.inicio, p }));
  rota.sem_sinal.forEach((g, i) => eventos.push({ chave: `g-${i}`, tipo: 'gap', em: g.inicio, g }));
  return eventos.sort((a, b) => new Date(a.em).getTime() - new Date(b.em).getTime());
}

// Enquadra a rota ao carregar e leva o mapa até o item escolhido na linha do tempo.
function ControleMapa({
  rota,
  selecionado,
  marcadores,
}: {
  rota: RotaDoDia;
  selecionado: string | null;
  marcadores: React.RefObject<Record<string, L.Marker | null>>;
}) {
  const mapa = useMap();
  const chaveRota = `${rota.promotor.id}|${rota.data}|${rota.pontos.length}`;

  useEffect(() => {
    const coords: L.LatLngExpression[] = [
      ...rota.linhas.flat(),
      ...rota.visitas.map((v) => [v.latitude, v.longitude] as [number, number]),
      ...rota.paradas.map((p) => [p.latitude, p.longitude] as [number, number]),
    ];
    if (coords.length === 1) mapa.setView(coords[0], 16);
    else if (coords.length > 1) mapa.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapa, chaveRota]);

  useEffect(() => {
    if (!selecionado) return;
    const gap = selecionado.startsWith('g-') ? rota.sem_sinal[Number(selecionado.slice(2))] : null;
    if (gap) {
      mapa.fitBounds(L.latLngBounds([gap.de.latitude, gap.de.longitude], [gap.ate.latitude, gap.ate.longitude]), { padding: [60, 60], maxZoom: 16 });
      return;
    }
    const afastamento = selecionado.startsWith('a-') ? trechoDoAfastamento(rota, selecionado) : null;
    if (afastamento && afastamento.pontos.length > 0) {
      mapa.fitBounds(L.latLngBounds(afastamento.pontos), { padding: [60, 60], maxZoom: 16 });
      return;
    }
    const marcador = marcadores.current?.[selecionado];
    if (marcador) {
      mapa.setView(marcador.getLatLng(), Math.max(mapa.getZoom(), 15));
      marcador.openPopup();
    }
  }, [mapa, selecionado, rota, marcadores]);

  return null;
}

// chave "a-{visitaUuid}-{índice}" — o uuid tem hífens, então o índice é o que vem depois do último.
function trechoDoAfastamento(rota: RotaDoDia, chave: string): AfastamentoTrecho | null {
  const corte = chave.lastIndexOf('-');
  const visita = rota.visitas.find((v) => v.id === chave.slice(2, corte));
  return visita?.afastamentos[Number(chave.slice(corte + 1))] ?? null;
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
  const marcadores = useRef<Record<string, L.Marker | null>>({});

  const promotoresQuery = useQuery({ queryKey: ['rotas', 'promotores'], queryFn: listarPromotoresRota });
  const rotaQuery = useQuery({
    queryKey: ['rotas', usuarioUuid, data],
    queryFn: () => buscarRotaDoDia(usuarioUuid!, data),
    enabled: !!usuarioUuid,
  });
  const rota = rotaQuery.data;
  const eventos = useMemo(() => (rota ? eventosDaRota(rota) : []), [rota]);
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
  }

  const promotores = promotoresQuery.data ?? [];
  const vazio = rota && rota.pontos.length === 0 && rota.visitas.length === 0;

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

          {rota && (
            <>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1.25, mb: 2 }}>
                <Kpi titulo="Visitas" valor={String(rota.resumo.visitas)} />
                <Kpi titulo="Tempo em loja" valor={duracao(rota.resumo.tempo_em_loja_minutos)} />
                <Kpi titulo="Distância percorrida" valor={`${rota.resumo.distancia_km.toLocaleString('pt-BR')} km`} />
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
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 1fr) 340px' }, gap: 2, alignItems: 'start' }}>
                  <Paper variant="outlined" sx={{ overflow: 'hidden', borderRadius: 1.5 }}>
                    <MapContainer center={[-3.1, -60.0]} zoom={13} scrollWheelZoom={false} style={{ height: 560, width: '100%' }}>
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <ZoomComCtrl />
                      <ControleMapa rota={rota} selecionado={selecionado} marcadores={marcadores} />

                      {rota.linhas.map((linha, i) => (
                        <Polyline key={`l-${i}`} positions={linha} pathOptions={{ color: COR.rota, weight: 5, opacity: 0.85 }} />
                      ))}
                      {rota.sem_sinal.map((g, i) => (
                        <Polyline
                          key={`g-${i}`}
                          positions={[[g.de.latitude, g.de.longitude], [g.ate.latitude, g.ate.longitude]]}
                          pathOptions={{ color: COR.gap, weight: 4, dashArray: '8 8' }}
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

                      {rota.pontos[0] && (
                        <Marker
                          position={[rota.pontos[0].latitude, rota.pontos[0].longitude]}
                          icon={pino(COR.inicio, '')}
                          ref={(m) => {
                            marcadores.current.inicio = m;
                          }}
                        >
                          <Popup>
                            <strong>Início</strong>
                            <br />
                            Primeira posição às {hora(rota.pontos[0].em)}
                          </Popup>
                        </Marker>
                      )}

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

                      {rota.paradas.map((p, i) => (
                        <Marker
                          key={`p-${i}`}
                          position={[p.latitude, p.longitude]}
                          icon={pino(COR.parada, 'P')}
                          ref={(m) => {
                            marcadores.current[`p-${i}`] = m;
                          }}
                          eventHandlers={{ click: () => setSelecionado(`p-${i}`) }}
                        >
                          <Popup>
                            <strong>Parado fora de loja</strong>
                            <br />
                            Das {hora(p.inicio)} às {hora(p.fim)} ({duracao(p.minutos)})
                            <br />
                            Nenhuma loja cadastrada num raio de 300 m
                            <br />
                            <a href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`} target="_blank" rel="noopener noreferrer">
                              Ver endereço no Google Maps
                            </a>
                          </Popup>
                        </Marker>
                      ))}
                    </MapContainer>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', px: 1.75, py: 1.25, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Legenda cor={COR.rota} texto={rota.aproximada ? 'Trajeto (aproximado)' : 'Trajeto seguindo as ruas'} linha />
                      <Legenda cor={COR.gap} texto="Sem sinal" tracejada />
                      <Legenda cor={COR.rota} texto="Visita, na ordem" />
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
                    <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, py: 0.75, maxHeight: 560, overflowY: 'auto' }}>
                      {eventos.map((ev, i) => (
                        <ItemLinhaDoTempo
                          key={ev.chave}
                          evento={ev}
                          ultimo={i === eventos.length - 1}
                          selecionado={selecionado === ev.chave}
                          onClick={() => setSelecionado(ev.chave)}
                        />
                      ))}
                      {rota.resumo.ultima_posicao_em && (
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

function Legenda({ cor, texto, linha, tracejada }: { cor: string; texto: string; linha?: boolean; tracejada?: boolean }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12, color: 'text.secondary' }}>
      {linha || tracejada ? (
        <Box sx={{ width: 22, borderTop: `${tracejada ? 3 : 4}px ${tracejada ? 'dashed' : 'solid'} ${cor}` }} />
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
  onClick,
}: {
  evento: Evento;
  ultimo: boolean;
  selecionado: boolean;
  onClick: () => void;
}) {
  const bola = (() => {
    switch (evento.tipo) {
      case 'inicio':
        return { bg: COR.inicio, texto: '', borda: undefined };
      case 'visita':
        return { bg: COR.rota, texto: String(evento.v.ordem), borda: undefined };
      case 'parada':
        return { bg: COR.parada, texto: 'P', borda: undefined };
      case 'afastamento':
        return { bg: COR.fora, texto: '!', borda: undefined };
      default:
        return { bg: 'transparent', texto: '', borda: `2px dashed ${COR.gap}` };
    }
  })();

  const [titulo, detalhe, tag] = (() => {
    switch (evento.tipo) {
      case 'inicio':
        return ['Início', 'Primeira posição do dia', null];
      case 'visita':
        return [
          evento.v.ponto_venda?.fantasia ?? 'Visita',
          (evento.v.fim ? `até ${hora(evento.v.fim)} · ficou ${duracao(evento.v.minutos)}` : 'ainda na loja') +
            (evento.v.minutos_fora > 0 ? ` · ${duracao(evento.v.minutos_fora)} fora` : ''),
          null,
        ];
      case 'afastamento':
        return [
          'Saiu da loja durante a visita',
          `${evento.v.ponto_venda?.fantasia ?? 'Visita'} · ${evento.a.fim ? `voltou às ${hora(evento.a.fim)}` : 'não voltou antes do checkout'} · foi até ${distancia(evento.a.distancia_max_metros)}`,
          `${duracao(evento.a.minutos)} fora`,
        ];
      case 'parada':
        return ['Parado fora de loja', `até ${hora(evento.p.fim)} · nenhuma loja num raio de 300 m`, `${duracao(evento.p.minutos)} parado`];
      default:
        return ['Sem sinal', `até ${hora(evento.g.fim)}`, `${duracao(evento.g.minutos)} sem posição`];
    }
  })();

  return (
    <Box
      component="li"
      onClick={onClick}
      sx={{
        display: 'grid',
        gridTemplateColumns: '48px 22px minmax(0, 1fr)',
        columnGap: 0.75,
        px: 1.5,
        py: 0.75,
        cursor: 'pointer',
        borderLeft: '3px solid',
        borderLeftColor: selecionado ? COR.rota : 'transparent',
        bgcolor: selecionado ? '#eef0ff' : 'transparent',
        '&:hover': { bgcolor: selecionado ? '#eef0ff' : 'action.hover' },
      }}
    >
      <Typography sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 12, color: 'text.secondary', pt: 0.25 }}>{hora(evento.em)}</Typography>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!ultimo && <Box sx={{ position: 'absolute', top: 4, bottom: -12, width: '2px', bgcolor: 'divider' }} />}
        <Box
          sx={{
            position: 'relative',
            width: 20,
            height: 20,
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
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {detalhe}
        </Typography>
        {tag && (
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              mt: 0.25,
              fontSize: 11,
              fontWeight: 700,
              px: 1,
              borderRadius: 99,
              bgcolor: evento.tipo === 'parada' ? '#ffedd5' : evento.tipo === 'afastamento' ? '#fee2e2' : 'action.hover',
              color: evento.tipo === 'parada' ? COR.parada : evento.tipo === 'afastamento' ? COR.fora : 'text.secondary',
            }}
          >
            {tag}
          </Box>
        )}
      </Box>
    </Box>
  );
}

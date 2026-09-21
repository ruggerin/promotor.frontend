import { Alert, Box, Chip, CircularProgress, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { ZoomComCtrl } from '../../components/mapa/ZoomComCtrl';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { listarLocalizacoes, type LocalizacaoPromotor } from '../../lib/api/localizacoes';

// Polling, não WebSocket (decisão 5 de docs/11-RASTREAMENTO-TEMPO-REAL.md): o projeto não tem
// infra de tempo real, e 20s é "ao vivo o suficiente" pra um mapa de supervisão.
const INTERVALO_POLLING_MS = 20_000;

const COR_ATIVO = '#16a34a';
const COR_INATIVO = '#9ca3af';

// Mesmo pin "gota" em CSS do Planejador de Visitas — evita o problema clássico de ícone padrão do
// Leaflet com bundler (Vite não resolve os caminhos de imagem do pacote).
function iconePin(cor: string, ativo: boolean): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${cor};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45);transform:rotate(-45deg);opacity:${ativo ? 1 : 0.7}"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    popupAnchor: [0, -26],
  });
}

function haQuantoTempo(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutos < 1) return 'agora mesmo';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
}

// Enquadra todos os pinos só na PRIMEIRA carga — refazer o fitBounds a cada polling brigaria com o
// pan/zoom que o gestor acabou de fazer. Trocar o promotor em foco (clique na lista) usa `foco`.
function AjustarMapa({ localizacoes, foco }: { localizacoes: LocalizacaoPromotor[]; foco: LocalizacaoPromotor | null }) {
  const mapa = useMap();
  const [enquadrou, setEnquadrou] = useState(false);

  useEffect(() => {
    if (enquadrou || localizacoes.length === 0) return;
    if (localizacoes.length === 1) {
      mapa.setView([localizacoes[0].latitude, localizacoes[0].longitude], 14);
    } else {
      mapa.fitBounds(localizacoes.map((l) => [l.latitude, l.longitude] as [number, number]), { padding: [40, 40] });
    }
    setEnquadrou(true);
  }, [mapa, localizacoes, enquadrou]);

  useEffect(() => {
    if (foco) mapa.setView([foco.latitude, foco.longitude], Math.max(mapa.getZoom(), 15));
  }, [mapa, foco]);

  return null;
}

export function RastreamentoPage() {
  const [focoId, setFocoId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['localizacoes'],
    queryFn: listarLocalizacoes,
    refetchInterval: INTERVALO_POLLING_MS,
  });
  const localizacoes = useMemo(() => query.data ?? [], [query.data]);
  const ativos = localizacoes.filter((l) => l.ativo_agora).length;
  const foco = localizacoes.find((l) => l.id === focoId) ?? null;

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Mapa ao vivo
    </Typography>,
  );

  const semPermissao = axios.isAxiosError(query.error) && query.error.response?.status === 403;

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Posição mais recente de cada promotor que está compartilhando localização. Atualiza sozinho a
        cada 20 segundos. Pino verde = visto nos últimos 5 minutos; cinza = visto há mais tempo.
      </Typography>

      {query.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {semPermissao && <Alert severity="warning">Você não tem permissão pra ver o mapa ao vivo.</Alert>}
      {query.isError && !semPermissao && <Alert severity="error">Não foi possível carregar as posições agora.</Alert>}

      {query.isSuccess && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'stretch' }}>
          <Paper variant="outlined" sx={{ flex: '3 1 480px', minWidth: 0, height: 560, overflow: 'hidden' }}>
            {localizacoes.length === 0 ? (
              <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  Nenhum promotor compartilhou a localização ainda. O rastreamento precisa estar habilitado
                  na empresa (parâmetro RASTREAMENTO_INTERVALO_SEGUNDOS) e o app aberto no aparelho.
                </Typography>
              </Box>
            ) : (
              <MapContainer center={[-3.1, -60.0]} zoom={11} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomComCtrl />
                <AjustarMapa localizacoes={localizacoes} foco={foco} />
                {localizacoes.map((l) => (
                  <Marker
                    key={l.id}
                    position={[l.latitude, l.longitude]}
                    icon={iconePin(l.ativo_agora ? COR_ATIVO : COR_INATIVO, l.ativo_agora)}
                  >
                    <Popup>
                      <strong>{l.nome}</strong>
                      <br />
                      Visto {haQuantoTempo(l.ultima_localizacao_em)}
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </Paper>

          <Paper variant="outlined" sx={{ flex: '1 1 260px', minWidth: 240, maxHeight: 560, overflowY: 'auto' }}>
            <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Promotores
              </Typography>
              <Chip size="small" color={ativos > 0 ? 'success' : 'default'} label={`${ativos} ativo${ativos === 1 ? '' : 's'} agora`} />
            </Box>
            <List dense disablePadding>
              {localizacoes.map((l) => (
                <ListItemButton key={l.id} selected={l.id === focoId} onClick={() => setFocoId(l.id)} sx={{ gap: 1.25 }}>
                  <UsuarioAvatar nome={l.nome} fotoUrl={l.foto_url} size={28} />
                  <ListItemText
                    primary={l.nome}
                    secondary={`${l.ativo_agora ? 'Ativo' : 'Inativo'} · visto ${haQuantoTempo(l.ultima_localizacao_em)}`}
                  />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.ativo_agora ? COR_ATIVO : COR_INATIVO, flexShrink: 0 }} />
                </ListItemButton>
              ))}
            </List>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

import AltRouteIcon from '@mui/icons-material/AltRoute';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { Link as RouterLink } from 'react-router-dom';
import { ZoomComCtrl } from '../../components/mapa/ZoomComCtrl';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import type { LinhaEquipeOperacaoDoDia } from '../../lib/api/operacaoDoDia';
import { tempoDesde } from '../../lib/formatarData';
import { MOTIVO_RASTREAMENTO } from '../rastreamento/motivosRastreamento';

// "Onde o promotor está" direto da Operação do dia: clique no "Sinal" da equipe abre a última
// posição conhecida num mapa, sem sair da tela (o Mapa ao vivo mostra todos de uma vez).

const COR_ATIVO = '#4f46e5';
const COR_SEM_SINAL = '#dc2626';

function pinoPromotor(nome: string, semSinal: boolean): L.DivIcon {
  const inicial = (nome.trim()[0] ?? '?').toUpperCase();
  const cor = semSinal ? COR_SEM_SINAL : COR_ATIVO;
  return L.divIcon({
    className: '',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    html: `<div style="width:36px;height:36px;border-radius:50%;background:${cor};border:3px solid #fff;box-shadow:0 2px 8px rgba(15,23,42,.4);color:#fff;font:700 15px 'IBM Plex Sans',sans-serif;display:flex;align-items:center;justify-content:center;box-sizing:border-box">${inicial}</div>`,
  });
}

export function LocalizacaoPromotorDialog({ linha, onClose }: { linha: LinhaEquipeOperacaoDoDia | null; onClose: () => void }) {
  const posicao = linha?.ultima_localizacao ?? null;
  const em = linha?.ultima_localizacao_em ?? null;
  const situacao = posicao?.situacao && posicao.situacao !== 'ATIVO' ? MOTIVO_RASTREAMENTO[posicao.situacao] ?? posicao.situacao : null;
  const hojeLocal = new Date().toLocaleDateString('en-CA');

  return (
    <Dialog open={!!linha} onClose={onClose} maxWidth="md" fullWidth>
      {linha && (
        <>
          <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <UsuarioAvatar nome={linha.usuario.nome} fotoUrl={linha.usuario.foto_url} size={36} />
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }}>{linha.usuario.nome}</Typography>
              <Typography variant="caption" color="text.secondary">
                {em
                  ? `Última posição às ${new Date(em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} · há ${tempoDesde(em)}`
                  : 'Nunca mandou posição'}
                {linha.ponto_venda_atual ? ` · em visita no ${linha.ponto_venda_atual.fantasia}` : ''}
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0 }}>
            {(linha.sem_sinal || situacao) && (
              <Alert severity="warning" sx={{ borderRadius: 0 }}>
                {linha.sem_sinal ? 'Sem sinal agora: o ponto no mapa é a última posição que chegou, não onde ele está neste momento.' : ''}
                {situacao ? ` O app informou: ${situacao}.` : ''}
              </Alert>
            )}
            {posicao ? (
              <MapContainer center={[posicao.latitude, posicao.longitude]} zoom={16} scrollWheelZoom={false} style={{ height: 420, width: '100%' }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ZoomComCtrl />
                <Marker position={[posicao.latitude, posicao.longitude]} icon={pinoPromotor(linha.usuario.nome, linha.sem_sinal)} />
              </MapContainer>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">
                  {em
                    ? 'Seu perfil não tem a permissão de ver o Mapa ao vivo.'
                    : 'Esse promotor ainda não mandou nenhuma posição — o rastreamento precisa estar ligado no aplicativo dele.'}
                </Typography>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {posicao && (
                <Button
                  size="small"
                  startIcon={<OpenInNewIcon />}
                  href={`https://www.google.com/maps?q=${posicao.latitude},${posicao.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Maps
                </Button>
              )}
              <Button size="small" startIcon={<AltRouteIcon />} component={RouterLink} to={`/rota-do-dia?usuario=${linha.usuario.id}&data=${hojeLocal}`}>
                Rota do dia
              </Button>
            </Box>
            <Button onClick={onClose}>Fechar</Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}

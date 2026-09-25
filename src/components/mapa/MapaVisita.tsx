import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { Circle, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { CORES_MAPA_VISITA } from './coresMapaVisita';
import { ZoomComCtrl } from './ZoomComCtrl';

// Mapa do detalhe da visita (docs/06-PENDENCIAS.md §3 "Mapa no Detalhe da Visita"): a loja, o
// ponto onde o promotor fez check-in e onde fez checkout, com a cerca do raio de check-in em volta
// da loja e uma linha tracejada ligando cada ponto à loja — dá pra ver de relance se a visita
// aconteceu "no lugar certo". Checkout forçado pelo admin não tem GPS, então não vira pino.

// Paths de ícones Material (Store, Login, Logout) — inline pra não depender de renderizar React
// dentro de um L.divIcon (que só aceita HTML string).
const ICONE_SVG = {
  loja: 'M20 4H4v2h16V4zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6h1zm-9 4H6v-4h6v4z',
  checkin: 'M11 7 9.6 8.4l2.6 2.6H2v2h10.2l-2.6 2.6L11 17l5-5-5-5zm9 12h-8v2h8c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-8v2h8v14z',
  checkout: 'm17 7-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z',
};

// `deslocamentoX` só muda onde o pino é DESENHADO (em pixels), não a coordenada — usado quando
// pontos quase coincidem (ex.: check-in a 0 m da loja) e um pino esconderia o outro.
function iconePin(cor: string, path: string, deslocamentoX = 0): L.DivIcon {
  return L.divIcon({
    className: '',
    iconSize: [34, 42],
    iconAnchor: [17 - deslocamentoX, 40],
    tooltipAnchor: [deslocamentoX, -36],
    html: `
      <div style="position:relative;width:34px;height:42px;">
        <div style="width:34px;height:34px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);
                    background:${cor};box-shadow:0 2px 6px rgba(15,23,42,.35);border:2px solid #fff;"></div>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="#fff"
             style="position:absolute;left:8px;top:8px;"><path d="${path}"/></svg>
      </div>`,
  });
}

export interface PontoMapaVisita {
  latitude: number;
  longitude: number;
  rotulo: string;
  detalhe?: string;
}

function Enquadrar({ pontos }: { pontos: [number, number][] }) {
  const mapa = useMap();
  // Só reenquadra quando as coordenadas mudam de verdade (o array é novo a cada render) — o
  // effect depende da chave serializada e reconstrói os pontos a partir dela.
  const chave = pontos.map((p) => p.join(',')).join('|');
  useEffect(() => {
    if (!chave) return;
    const coords = chave.split('|').map((p) => p.split(',').map(Number) as [number, number]);
    if (coords.length === 1) {
      mapa.setView(coords[0], 17);
    } else {
      mapa.fitBounds(coords, { padding: [48, 48], maxZoom: 18 });
    }
  }, [mapa, chave]);
  return null;
}

export function MapaVisita({
  loja,
  checkin,
  checkout,
  raioMetros,
  altura = 360,
}: {
  loja: PontoMapaVisita | null;
  checkin: PontoMapaVisita | null;
  checkout: PontoMapaVisita | null;
  raioMetros?: number | null;
  altura?: number;
}) {
  // Pontos a menos de 15 m um do outro se sobrepõem no zoom normal — abre em leque (loja no
  // meio, check-in à esquerda, checkout à direita) só quando isso acontece.
  const sobreposto = (a: PontoMapaVisita | null, b: PontoMapaVisita | null) =>
    !!a && !!b && L.latLng(a.latitude, a.longitude).distanceTo(L.latLng(b.latitude, b.longitude)) < 15;
  const checkinSobreposto = sobreposto(checkin, loja) || sobreposto(checkin, checkout);
  const checkoutSobreposto = sobreposto(checkout, loja) || sobreposto(checkout, checkin);

  const icones = useMemo(
    () => ({
      loja: iconePin(CORES_MAPA_VISITA.loja, ICONE_SVG.loja),
      checkin: iconePin(CORES_MAPA_VISITA.checkin, ICONE_SVG.checkin, checkinSobreposto ? -26 : 0),
      checkout: iconePin(CORES_MAPA_VISITA.checkout, ICONE_SVG.checkout, checkoutSobreposto ? 26 : 0),
    }),
    [checkinSobreposto, checkoutSobreposto],
  );

  const pontos = [loja, checkin, checkout]
    .filter((p): p is PontoMapaVisita => p !== null)
    .map((p) => [p.latitude, p.longitude] as [number, number]);
  const centro = pontos[0] ?? ([-15.78, -47.93] as [number, number]);
  const linha = { color: '#64748b', weight: 2, dashArray: '4 6', opacity: 0.8 };

  return (
    <MapContainer center={centro} zoom={16} style={{ height: altura, width: '100%' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ZoomComCtrl />
      <Enquadrar pontos={pontos} />

      {loja && raioMetros != null && (
        <Circle
          center={[loja.latitude, loja.longitude]}
          radius={raioMetros}
          pathOptions={{ color: CORES_MAPA_VISITA.loja, weight: 1.5, dashArray: '6 6', fillOpacity: 0.06 }}
        />
      )}
      {loja && checkin && (
        <Polyline positions={[[loja.latitude, loja.longitude], [checkin.latitude, checkin.longitude]]} pathOptions={linha} />
      )}
      {loja && checkout && (
        <Polyline positions={[[loja.latitude, loja.longitude], [checkout.latitude, checkout.longitude]]} pathOptions={linha} />
      )}

      {(
        [
          ['loja', loja],
          ['checkin', checkin],
          ['checkout', checkout],
        ] as const
      ).map(([tipo, ponto]) =>
        ponto ? (
          <Marker
            key={tipo}
            position={[ponto.latitude, ponto.longitude]}
            icon={icones[tipo]}
            // Loja por cima quando empilha — é a referência do mapa.
            zIndexOffset={tipo === 'loja' ? 1000 : 0}
          >
            <Tooltip direction="top">
              <strong>{ponto.rotulo}</strong>
              {ponto.detalhe && (
                <>
                  <br />
                  {ponto.detalhe}
                </>
              )}
            </Tooltip>
          </Marker>
        ) : null,
      )}
    </MapContainer>
  );
}

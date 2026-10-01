import type { ReactNode } from 'react';
import { vi } from 'vitest';

// react-leaflet de mentira pros testes — jsdom não tem layout/canvas pro Leaflet desenhar. Cada
// peça vira um <div> com o que importa pra conferir (cor da linha, conteúdo do popup), e o mapa
// aceita as chamadas de enquadrar sem fazer nada. Uso: vi.mock('react-leaflet', () => import(...)).

const mapaFalso = {
  fitBounds: vi.fn(),
  setView: vi.fn(),
  getZoom: () => 13,
  getContainer: () => document.createElement('div'),
  scrollWheelZoom: { enable: vi.fn(), disable: vi.fn() },
};

export function MapContainer({ children }: { children?: ReactNode }) {
  return <div data-testid="mapa">{children}</div>;
}

export function TileLayer() {
  return null;
}

export function Marker({ children }: { children?: ReactNode }) {
  return <div data-testid="marcador">{children}</div>;
}

export function Popup({ children }: { children?: ReactNode }) {
  return <div data-testid="popup">{children}</div>;
}

export function Polyline({ pathOptions }: { pathOptions?: { color?: string; dashArray?: string } }) {
  return <div data-testid="linha" data-cor={pathOptions?.color} data-tracejada={pathOptions?.dashArray ? 'sim' : 'nao'} />;
}

// Só roda em teste — fast refresh não se aplica; o react-leaflet de verdade também exporta o hook.
// eslint-disable-next-line react/only-export-components
export function useMap() {
  return mapaFalso;
}

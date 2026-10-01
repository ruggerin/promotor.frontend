import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LinhaEquipeOperacaoDoDia } from '../../lib/api/operacaoDoDia';
import { LocalizacaoPromotorDialog } from './LocalizacaoPromotorDialog';

vi.mock('react-leaflet', () => import('../../test/reactLeafletFalso'));
vi.mock('../../components/mapa/ZoomComCtrl', () => ({ ZoomComCtrl: () => null }));

function linha(extra: Partial<LinhaEquipeOperacaoDoDia> = {}): LinhaEquipeOperacaoDoDia {
  return {
    usuario: { id: 'u-1', nome: 'Carlos Eduardo Silva', foto_url: null },
    status: 'DESLOCAMENTO',
    ponto_venda_atual: null,
    checkin_em: null,
    visitas: { feitas: 2, total: 3 },
    rupturas: 0,
    ultima_localizacao_em: '2026-09-30T14:48:00Z',
    ultima_localizacao: { latitude: -3.1, longitude: -60.02, situacao: 'ATIVO' },
    sem_sinal: false,
    blocos_jornada: [],
    ...extra,
  } as LinhaEquipeOperacaoDoDia;
}

function abrir(l: LinhaEquipeOperacaoDoDia) {
  return render(
    <MemoryRouter>
      <LocalizacaoPromotorDialog linha={l} onClose={() => {}} />
    </MemoryRouter>,
  );
}

describe('LocalizacaoPromotorDialog (Operação do dia → onde o promotor está)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-30T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('mostra o mapa com o promotor, há quanto tempo e os atalhos', () => {
    abrir(linha());

    expect(screen.getByText('Carlos Eduardo Silva')).toBeInTheDocument();
    expect(screen.getByText(/há 12 min/)).toBeInTheDocument();
    expect(screen.getByTestId('marcador')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Google Maps/ })).toHaveAttribute('href', 'https://www.google.com/maps?q=-3.1,-60.02');
    expect(screen.getByRole('link', { name: /Rota do dia/ }).getAttribute('href')).toMatch(/^\/rota-do-dia\?usuario=u-1&data=\d{4}-\d{2}-\d{2}$/);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sem sinal: avisa que é a última posição e mostra o motivo que o app informou', () => {
    abrir(
      linha({
        sem_sinal: true,
        ultima_localizacao_em: '2026-09-25T15:00:00Z',
        ultima_localizacao: { latitude: -3.1, longitude: -60.02, situacao: 'GPS_DESLIGADO' },
      }),
    );

    expect(screen.getByText(/há 5 dias/)).toBeInTheDocument();
    const aviso = screen.getByRole('alert');
    expect(aviso).toHaveTextContent('não onde ele está neste momento');
    expect(aviso).toHaveTextContent('GPS do celular desligado');
  });

  it('sem a permissão do Mapa ao vivo, explica em vez de mostrar o mapa', () => {
    abrir(linha({ ultima_localizacao: null }));

    expect(screen.queryByTestId('mapa')).not.toBeInTheDocument();
    expect(screen.getByText(/não tem a permissão de ver o Mapa ao vivo/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Google Maps/ })).not.toBeInTheDocument();
  });

  it('promotor que nunca mandou posição', () => {
    abrir(linha({ ultima_localizacao: null, ultima_localizacao_em: null }));

    expect(screen.getByText('Nunca mandou posição')).toBeInTheDocument();
    expect(screen.getByText(/ainda não mandou nenhuma posição/)).toBeInTheDocument();
  });
});

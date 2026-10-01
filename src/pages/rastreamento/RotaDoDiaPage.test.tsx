import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RotaDoDia } from '../../lib/api/rotas';
import { criarQueryClientDeTeste } from '../../test/renderWithProviders';
import { RotaDoDiaPage } from './RotaDoDiaPage';

vi.mock('react-leaflet', () => import('../../test/reactLeafletFalso'));
vi.mock('../../components/mapa/ZoomComCtrl', () => ({ ZoomComCtrl: () => null }));
vi.mock('../../lib/api/rotas');

import * as rotasApi from '../../lib/api/rotas';

const VERMELHO = '#dc2626';

// Mesmo cenário do AfastamentoVisitaTest do backend: visita 08:00–10:00, saiu 08:35, voltou 09:20.
function rota(comAfastamento: boolean): RotaDoDia {
  const afastamentos = comAfastamento
    ? [
        {
          inicio: '2026-09-29T08:35:00+00:00',
          fim: '2026-09-29T09:20:00+00:00',
          minutos: 45,
          distancia_max_metros: 3002,
          pontos: [
            [-3.1, -60.0],
            [-3.127, -60.0],
            [-3.1, -60.0],
          ] as [number, number][],
        },
      ]
    : [];
  return {
    promotor: { id: 'u-1', nome: 'Juliana', foto_url: null },
    data: '2026-09-29',
    parametros: { parada_minutos: 30, tolerancia_sem_sinal_minutos: 5, afastamento_metros: 300, afastamento_minutos: 10 },
    pontos: [
      { latitude: -3.1, longitude: -60.0, em: '2026-09-29T08:00:00+00:00' },
      { latitude: -3.1, longitude: -60.0, em: '2026-09-29T10:00:00+00:00' },
    ],
    linhas: [
      [
        [-3.1, -60.0],
        [-3.127, -60.0],
      ],
    ],
    aproximada: false,
    sem_sinal: [],
    visitas: [
      {
        id: 'v-1',
        ordem: 1,
        status: 'FINALIZADA',
        ponto_venda: { id: 'pdv-1', fantasia: 'Mercantil' },
        latitude: -3.1,
        longitude: -60.0,
        inicio: '2026-09-29T08:00:00+00:00',
        fim: '2026-09-29T10:00:00+00:00',
        minutos: 120,
        afastamentos,
        minutos_fora: comAfastamento ? 45 : 0,
        sem_sinal_minutos: 0,
      },
    ],
    paradas: [],
    resumo: {
      visitas: 1,
      tempo_em_loja_minutos: comAfastamento ? 75 : 120,
      fora_da_loja_minutos: comAfastamento ? 45 : 0,
      distancia_km: 6.2,
      parado_fora_minutos: 0,
      sem_sinal_minutos: 0,
      primeira_posicao_em: '2026-09-29T08:00:00+00:00',
      ultima_posicao_em: '2026-09-29T10:00:00+00:00',
    },
  };
}

function abrir() {
  return render(
    <QueryClientProvider client={criarQueryClientDeTeste()}>
      <MemoryRouter initialEntries={['/rota-do-dia?usuario=u-1&data=2026-09-29']}>
        <RotaDoDiaPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function kpi(titulo: string): HTMLElement {
  return screen.getByText(titulo).parentElement as HTMLElement;
}

describe('RotaDoDiaPage — saiu da loja durante a visita (docs/49)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(rotasApi.listarPromotoresRota).mockResolvedValue([{ id: 'u-1', nome: 'Juliana', foto_url: null }]);
  });

  it('mostra a saída: KPI, trecho vermelho, item na linha do tempo e popup da visita', async () => {
    vi.mocked(rotasApi.buscarRotaDoDia).mockResolvedValue(rota(true));
    abrir();

    expect(await screen.findByText('Fora da loja durante visita')).toBeInTheDocument();
    expect(within(kpi('Fora da loja durante visita')).getByText('45 min')).toBeInTheDocument();
    // Tempo em loja já descontado (120 − 45).
    expect(within(kpi('Tempo em loja')).getByText('1h15')).toBeInTheDocument();

    const vermelhas = screen.getAllByTestId('linha').filter((l) => l.dataset.cor === VERMELHO);
    expect(vermelhas).toHaveLength(1);

    expect(screen.getByText('Saiu da loja durante a visita')).toBeInTheDocument();
    expect(screen.getByText(/Mercantil · voltou às .* · foi até 3 km/)).toBeInTheDocument();
    expect(screen.getAllByText('45 min fora').length).toBeGreaterThan(0);

    const popup = screen.getAllByTestId('popup').find((p) => p.textContent?.includes('Mercantil'))!;
    expect(popup).toHaveTextContent(/Saiu às .* sem checkout, foi até 3 km, voltou às .* \(45 min fora\)/);
    expect(popup).toHaveTextContent('Ficou: 2h · 45 min fora');

    expect(rotasApi.buscarRotaDoDia).toHaveBeenCalledWith('u-1', '2026-09-29');
  });

  it('visita sem saída: nada vermelho e sem item de afastamento', async () => {
    vi.mocked(rotasApi.buscarRotaDoDia).mockResolvedValue(rota(false));
    abrir();

    expect(await screen.findByText('Fora da loja durante visita')).toBeInTheDocument();
    expect(within(kpi('Fora da loja durante visita')).getByText('0 min')).toBeInTheDocument();
    expect(screen.getAllByTestId('linha').filter((l) => l.dataset.cor === VERMELHO)).toHaveLength(0);
    expect(screen.queryByText('Saiu da loja durante a visita')).not.toBeInTheDocument();
    // A legenda explica a regra com os parâmetros da empresa.
    expect(screen.getByText(/mais de 300 m por 10 min/)).toBeInTheDocument();
  });
});

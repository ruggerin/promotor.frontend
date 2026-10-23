import { QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
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
const MAGENTA = '#c026d3';
const CINZA_FORA = '#8f8ca8';

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
    parametros: {
      parada_minutos: 30,
      tolerancia_sem_sinal_minutos: 5,
      afastamento_metros: 300,
      afastamento_minutos: 10,
      desvio_raio_metros: 0,
      desvio_minutos: 10,
    },
    expediente: { recorte: 'DIA_INTEIRO', inicio: '2026-09-29T07:00:00+00:00', fim: '2026-09-29T17:00:00+00:00', intervalo: null },
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
    linhas_fora_expediente: [false],
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
    deslocamentos: [],
    desvios: [],
    area_roteiro: { raio_metros: 0, lojas: [] },
    fora_do_expediente: null,
    resumo: {
      visitas: 1,
      tempo_em_loja_minutos: comAfastamento ? 75 : 120,
      fora_da_loja_minutos: comAfastamento ? 45 : 0,
      distancia_km: 6.2,
      parado_fora_minutos: 0,
      sem_sinal_minutos: 0,
      fora_da_area_minutos: 0,
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

// docs/93: o mesmo dia, com a noite em casa antes do expediente, o deslocamento depois da visita
// e um trecho fora da área do roteiro.
function rotaDoc93(recorte: RotaDoDia['expediente']['recorte']): RotaDoDia {
  const base = rota(false);
  return {
    ...base,
    parametros: { ...base.parametros, desvio_raio_metros: 3000, desvio_minutos: 10 },
    expediente: { ...base.expediente, recorte },
    pontos: [
      { latitude: -3.13, longitude: -59.99, em: '2026-09-29T04:00:00+00:00' },
      { latitude: -3.13, longitude: -59.99, em: '2026-09-29T05:00:00+00:00' },
      ...base.pontos,
      { latitude: -3.03, longitude: -60.0, em: '2026-09-29T11:00:00+00:00' },
    ],
    linhas: [
      [
        [-3.13, -59.99],
        [-3.13, -59.99],
      ],
      ...base.linhas,
    ],
    linhas_fora_expediente: [recorte !== 'DIA_INTEIRO', false],
    paradas: [
      { inicio: '2026-09-29T04:00:00+00:00', fim: '2026-09-29T05:00:00+00:00', minutos: 60, latitude: -3.13, longitude: -59.99, bairro: 'Tancredo Neves' },
    ],
    deslocamentos: [
      {
        inicio: '2026-09-29T10:00:00+00:00',
        fim: '2026-09-29T11:00:00+00:00',
        minutos: 60,
        distancia_metros: 12400,
        fora_expediente: false,
        bairros: ['Chapada', 'Tarumã', 'Lagoa Azul'],
      },
    ],
    desvios: [
      {
        inicio: '2026-09-29T10:20:00+00:00',
        fim: '2026-09-29T11:00:00+00:00',
        minutos: 40,
        distancia_max_metros: 7800,
        distancia_metros: 9000,
        bairros: ['Tarumã', 'Lagoa Azul'],
        pontos: [
          [-3.08, -60.0],
          [-3.03, -60.0],
        ],
      },
    ],
    area_roteiro: {
      raio_metros: 3000,
      lojas: [
        { id: 'pdv-1', fantasia: 'Mercantil', latitude: -3.1, longitude: -60.0, visitada: true },
        { id: 'pdv-2', fantasia: 'Atacadão Flores', latitude: -3.1, longitude: -59.98, visitada: false },
      ],
    },
    fora_do_expediente:
      recorte === 'EXPEDIENTE'
        ? {
            antes: { posicoes: 2, distancia_km: 0, parado_fora_minutos: 60, sem_sinal_minutos: 0 },
            depois: { posicoes: 0, distancia_km: 0, parado_fora_minutos: 0, sem_sinal_minutos: 0 },
          }
        : null,
    resumo: { ...base.resumo, fora_da_area_minutos: 40, parado_fora_minutos: recorte === 'DIA_INTEIRO' ? 60 : 0 },
  };
}

describe('RotaDoDiaPage — expediente, deslocamento e área do roteiro (docs/93)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    vi.mocked(rotasApi.listarPromotoresRota).mockResolvedValue([{ id: 'u-1', nome: 'Juliana', foto_url: null }]);
  });

  it('desvio: KPI, trecho magenta, item com horário e bairros, área desenhada', async () => {
    vi.mocked(rotasApi.buscarRotaDoDia).mockResolvedValue(rotaDoc93('DIA_INTEIRO'));
    abrir();

    // O título aparece no KPI (primeiro) e no item da linha do tempo.
    const [tituloKpi] = await screen.findAllByText('Fora da área do roteiro');
    expect(within(tituloKpi.parentElement as HTMLElement).getByText('40 min')).toBeInTheDocument();
    expect(screen.getAllByTestId('linha').filter((l) => l.dataset.cor === MAGENTA)).toHaveLength(1);
    expect(screen.getByText(/até 7,8 km da loja mais próxima · passou por Tarumã, Lagoa Azul/)).toBeInTheDocument();
    expect(screen.getByText('40 min fora da área')).toBeInTheDocument();
    expect(screen.getAllByTestId('circulo')).toHaveLength(2);
    // Deslocamento com duração, distância e bairros.
    expect(screen.getByText(/Deslocamento · 1h · 12,4 km · Chapada → Tarumã → Lagoa Azul/)).toBeInTheDocument();
  });

  it('dia inteiro: a noite aparece normal, sem blocos de fora do expediente', async () => {
    vi.mocked(rotasApi.buscarRotaDoDia).mockResolvedValue(rotaDoc93('DIA_INTEIRO'));
    abrir();

    expect(await screen.findByText('Distância percorrida')).toBeInTheDocument();
    expect(screen.queryByText(/Antes do expediente/)).not.toBeInTheDocument();
    expect(screen.getAllByText('Parado fora de loja').length).toBeGreaterThan(0);
  });

  it('expediente: noite recolhida no bloco, linha de fora escondida até o gestor abrir', async () => {
    vi.mocked(rotasApi.buscarRotaDoDia).mockResolvedValue(rotaDoc93('EXPEDIENTE'));
    abrir();

    expect(await screen.findByText('Distância no expediente')).toBeInTheDocument();
    expect(screen.getByText(/Antes do expediente/)).toBeInTheDocument();
    expect(screen.getByText('1h parado')).toBeInTheDocument();
    expect(screen.getAllByTestId('linha').filter((l) => l.dataset.cor === CINZA_FORA)).toHaveLength(0);
    // A parada da noite (e o bairro dela) ainda não aparece na linha do tempo.
    expect(screen.queryByText(/Tancredo Neves · nenhuma loja/)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver' })[0]);

    expect(screen.getByText(/Tancredo Neves · nenhuma loja/)).toBeInTheDocument();
    expect(screen.getAllByTestId('linha').filter((l) => l.dataset.cor === CINZA_FORA)).toHaveLength(1);
  });

  it('intervalo desconsiderado (docs/95): bloco no meio do dia, parada do almoço escondida até abrir', async () => {
    const base = rotaDoc93('DIA_INTEIRO');
    vi.mocked(rotasApi.buscarRotaDoDia).mockResolvedValue({
      ...base,
      expediente: { ...base.expediente, intervalo: { inicio: '2026-09-29T12:00:00+00:00', fim: '2026-09-29T13:30:00+00:00' } },
      paradas: [
        ...base.paradas,
        { inicio: '2026-09-29T12:05:00+00:00', fim: '2026-09-29T13:20:00+00:00', minutos: 75, latitude: -3.03, longitude: -60.0, bairro: 'Lagoa Azul' },
      ],
      fora_do_expediente: { intervalo: { posicoes: 75, distancia_km: 0, parado_fora_minutos: 75, sem_sinal_minutos: 0 } },
    });
    abrir();

    expect(await screen.findByText(/Intervalo · /)).toBeInTheDocument();
    expect(screen.getByText('1h15 parado')).toBeInTheDocument();
    expect(screen.getByText('Distância (sem o intervalo)')).toBeInTheDocument();
    expect(screen.queryByText(/Lagoa Azul · nenhuma loja/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ver' }));

    expect(screen.getByText(/Lagoa Azul · nenhuma loja/)).toBeInTheDocument();
  });

  it('só expediente: avisa que o resto não aparece e não oferece abrir', async () => {
    vi.mocked(rotasApi.buscarRotaDoDia).mockResolvedValue(rotaDoc93('SO_EXPEDIENTE'));
    abrir();

    expect(await screen.findAllByText('Não aparece: a empresa mostra só o expediente')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Ver' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Mostrar fora do expediente')).not.toBeInTheDocument();
  });
});

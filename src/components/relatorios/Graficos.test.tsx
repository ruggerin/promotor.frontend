import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GraficoCumprimento, GraficoTempo } from './Graficos';

describe('Graficos dos relatórios padrão', () => {
  it('mostra mensagem amigável quando não há dados', () => {
    render(<GraficoCumprimento linhas={[]} />);

    expect(screen.getByText(/Não temos dados para montar o gráfico/)).toBeTruthy();
  });

  it('tempo: sem linhas também cai na mensagem amigável', () => {
    render(<GraficoTempo linhas={[]} comparando={false} />);

    expect(screen.getByText(/Não temos dados para montar o gráfico/)).toBeTruthy();
  });

  it('com dados, renderiza o gráfico com descrição acessível', () => {
    render(
      <GraficoCumprimento
        linhas={[
          {
            data: '2026-10-01', promotor: null, planejadas: 3, cumpridas: 2, em_andamento: 0, atrasadas: 1, a_vencer: 0,
            canceladas: 1, canceladas_promotor: 1, espontaneas: 0, percentual_cumprimento: 67, percentual_cumprimento_ajustado: 50,
          },
        ]}
      />,
    );

    expect(screen.getByRole('img', { name: /visitas por dia/i })).toBeTruthy();
  });
});

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BarraAcoesEmMassa } from './BarraAcoesEmMassa';

describe('BarraAcoesEmMassa', () => {
  it('não aparece sem seleção', () => {
    render(<BarraAcoesEmMassa quantidade={0} acoes={[]} onLimpar={() => {}} />);
    expect(screen.queryByText(/selecionado/)).toBeNull();
  });

  it('mostra a contagem e dispara as ações', () => {
    const atribuir = vi.fn();
    const limpar = vi.fn();
    render(
      <BarraAcoesEmMassa
        quantidade={3}
        acoes={[{ rotulo: 'Atribuir promotor', icone: null, onClick: atribuir }]}
        onLimpar={limpar}
      />,
    );
    expect(screen.getByText('3 selecionado(s)')).toBeTruthy();
    fireEvent.click(screen.getByText('Atribuir promotor'));
    expect(atribuir).toHaveBeenCalled();
    fireEvent.click(screen.getByLabelText('Limpar seleção'));
    expect(limpar).toHaveBeenCalled();
  });
});

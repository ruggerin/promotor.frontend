import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { PermissoesPorTela } from './PermissoesPorTela';

function Formulario({ inicial = [] as string[], aoMudar }: { inicial?: string[]; aoMudar?: (v: string[]) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <PermissoesPorTela
      valor={valor}
      pedidosVendaHabilitado={false}
      onChange={(v) => {
        setValor(v);
        aoMudar?.(v);
      }}
    />
  );
}

describe('PermissoesPorTela — regras de visita (docs/74)', () => {
  it('a sequência só libera com a agenda marcada', async () => {
    const usuario = userEvent.setup();
    render(<Formulario />);

    const sequencia = screen.getByRole('checkbox', { name: /Segue a sequência do dia/ });
    expect(sequencia).toBeDisabled();

    await usuario.click(screen.getByRole('checkbox', { name: /Só inicia visita pela agenda/ }));
    expect(sequencia).toBeEnabled();
  });

  it('desmarcar a agenda desmarca a sequência junto', async () => {
    const usuario = userEvent.setup();
    let ultimo: string[] = [];
    render(<Formulario inicial={['visitas.exigir_agenda', 'visitas.exigir_sequencia']} aoMudar={(v) => (ultimo = v)} />);

    await usuario.click(screen.getByRole('checkbox', { name: /Só inicia visita pela agenda/ }));

    expect(ultimo).not.toContain('visitas.exigir_agenda');
    expect(ultimo).not.toContain('visitas.exigir_sequencia');
  });
});

import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as usuariosApi from '../../lib/api/usuarios';
import { renderComProviders } from '../../test/renderWithProviders';
import type { Usuario } from '../../types/api';
import { ReincidenciaCheckoutPanel } from './ReincidenciaCheckoutPanel';

vi.mock('../../lib/api/usuarios');

const usuario = { id: 'prom-1', nome: 'Juliana', user_type: 'PROMOTOR' } as unknown as Usuario;

describe('ReincidenciaCheckoutPanel (docs/92 §9)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(usuariosApi.buscarReincidenciaCheckout).mockResolvedValue({
      dias: 30, visitas_finalizadas: 12, saida_detectada: 4, automatico: 2, fora_do_raio: 1, forcado_pelo_gestor: 0, esqueceu: 6,
    });
  });

  it('mostra os números e troca o período', async () => {
    const pessoa = userEvent.setup();
    renderComProviders(<ReincidenciaCheckoutPanel usuario={usuario} />);

    expect(await screen.findByText('esqueceu o checkout')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText(/De 12 visitas finalizadas/)).toBeInTheDocument();
    expect(usuariosApi.buscarReincidenciaCheckout).toHaveBeenCalledWith('prom-1', 30);

    await pessoa.click(screen.getByRole('combobox', { name: 'Período' }));
    await pessoa.click(await screen.findByRole('option', { name: 'Últimos 90 dias' }));
    await waitFor(() => expect(usuariosApi.buscarReincidenciaCheckout).toHaveBeenLastCalledWith('prom-1', 90));
  });
});

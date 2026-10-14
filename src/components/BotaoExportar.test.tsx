import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../test/renderWithProviders';
import { BotaoExportar } from './BotaoExportar';

vi.mock('../lib/api/exportacoes');
vi.mock('../lib/csv', () => ({ baixarBlob: vi.fn() }));

import { exportar } from '../lib/api/exportacoes';
import { baixarBlob } from '../lib/csv';

describe('BotaoExportar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pede ao servidor a rotina, os filtros e o formato escolhido, e baixa o arquivo', async () => {
    vi.mocked(exportar).mockResolvedValue({ blob: new Blob(['x']), nome: 'registros-2026-10-13.xlsx', linhas: 1234 });
    const user = userEvent.setup();
    renderComProviders(<BotaoExportar rotina="registros" filtros={{ ruptura: true }} descricaoFiltros="Só rupturas" />);

    await user.click(screen.getByRole('button', { name: /Exportar/ }));
    await user.click(await screen.findByText('Excel (.xlsx)'));

    await waitFor(() =>
      expect(exportar).toHaveBeenCalledWith({ rotina: 'registros', formato: 'xlsx', filtros: { ruptura: true }, descricaoFiltros: 'Só rupturas' }),
    );
    await waitFor(() => expect(baixarBlob).toHaveBeenCalledWith('registros-2026-10-13.xlsx', expect.any(Blob)));
    expect(await screen.findByText(/1\.234 linhas exportadas/)).toBeInTheDocument();
  });

  it('mostra a mensagem do servidor quando recusa (ex.: passou do teto) e não baixa nada', async () => {
    vi.mocked(exportar).mockRejectedValue(new Error('Esta exportação passa de 20.000 linhas. Refine o filtro.'));
    const user = userEvent.setup();
    renderComProviders(<BotaoExportar rotina="visitas" />);

    await user.click(screen.getByRole('button', { name: /Exportar/ }));
    await user.click(await screen.findByText('CSV (.csv)'));

    expect(await screen.findByText(/Refine o filtro/)).toBeInTheDocument();
    expect(baixarBlob).not.toHaveBeenCalled();
  });
});

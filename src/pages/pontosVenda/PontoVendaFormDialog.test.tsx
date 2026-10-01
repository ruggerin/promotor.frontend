import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../../test/renderWithProviders';
import type { PontoVenda } from '../../types/api';
import { PontoVendaFormDialog } from './PontoVendaFormDialog';

vi.mock('../../lib/api/pontosVenda');
vi.mock('../../lib/api/redesLojas');
vi.mock('../../lib/api/ramosAtividade');

import * as pontosVendaApi from '../../lib/api/pontosVenda';
import * as ramosApi from '../../lib/api/ramosAtividade';
import * as redesApi from '../../lib/api/redesLojas';

const meta = { current_page: 1, last_page: 1, per_page: 15, total: 0 };

function loja(fuso: string | null): PontoVenda {
  return {
    id: 'pdv-1',
    codigo_externo: null,
    cnpj: null,
    razao_social: 'Mercantil Ltda',
    fantasia: 'Mercantil',
    latitude: -3.1,
    longitude: -60.0,
    endereco: 'Av. Djalma Batista',
    numero: '100',
    bairro: 'Chapada',
    cidade: 'Manaus',
    cep: null,
    telefone: null,
    email: null,
    rede_loja: null,
    ramo_atividade: null,
    numero_checkouts: null,
    fuso,
    ativo: true,
  } as unknown as PontoVenda;
}

describe('PontoVendaFormDialog — fuso da loja (docs/50 §4.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(redesApi.listarRedesLojas).mockResolvedValue({ redes_lojas: [], meta } as never);
    vi.mocked(ramosApi.listarRamosAtividade).mockResolvedValue({ ramos_atividade: [], meta } as never);
    vi.mocked(pontosVendaApi.atualizarPontoVenda).mockResolvedValue({ ponto_venda: loja(null) } as never);
  });

  it('padrão "O mesmo da empresa" manda fuso null (herda)', async () => {
    const user = userEvent.setup();
    renderComProviders(<PontoVendaFormDialog open pontoVenda={loja(null)} onClose={() => {}} />);

    expect(await screen.findByText('O mesmo da empresa')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(pontosVendaApi.atualizarPontoVenda).toHaveBeenCalledTimes(1));
    expect(vi.mocked(pontosVendaApi.atualizarPontoVenda).mock.calls[0][1]).toMatchObject({ fuso: null });
  });

  it('loja em outro fuso: escolhe Acre e manda America/Rio_Branco', async () => {
    const user = userEvent.setup();
    renderComProviders(<PontoVendaFormDialog open pontoVenda={loja(null)} onClose={() => {}} />);

    await user.click(await screen.findByRole('combobox', { name: 'Fuso horário da loja' }));
    await user.click(within(screen.getByRole('listbox')).getByText(/^Acre \(UTC−5\)/));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(pontosVendaApi.atualizarPontoVenda).toHaveBeenCalledTimes(1));
    expect(vi.mocked(pontosVendaApi.atualizarPontoVenda).mock.calls[0][1]).toMatchObject({ fuso: 'America/Rio_Branco' });
  });

  it('abre com o fuso já gravado da loja', async () => {
    renderComProviders(<PontoVendaFormDialog open pontoVenda={loja('America/Manaus')} onClose={() => {}} />);

    expect(await screen.findByText(/^Amazonas \(UTC−4\)/)).toBeInTheDocument();
  });
});

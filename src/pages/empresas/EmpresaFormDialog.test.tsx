import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../../test/renderWithProviders';
import type { Empresa } from '../../types/api';
import { EmpresaFormDialog } from './EmpresaFormDialog';

vi.mock('../../lib/api/empresas');

import * as empresasApi from '../../lib/api/empresas';

function empresa(fuso: string): Empresa {
  return {
    id: 'emp-1',
    razao_social: 'Trade Norte Ltda',
    nome_fantasia: 'Trade Norte',
    cnpj: '12345678000199',
    plano: 'PRO',
    limite_usuarios: null,
    limite_pontos_venda: null,
    limite_licencas: null,
    pedidos_venda_habilitado: false,
    fuso,
    ativo: true,
    created_at: '',
    updated_at: '',
  } as Empresa;
}

describe('EmpresaFormDialog — fuso da empresa (docs/50 §4.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(empresasApi.atualizarEmpresaSuperadmin).mockResolvedValue({ empresa: empresa('America/Manaus') });
    vi.mocked(empresasApi.criarEmpresaSuperadmin).mockResolvedValue({ empresa: empresa('America/Sao_Paulo'), usuario: {} } as never);
  });

  it('troca Brasília por Amazonas e manda America/Manaus', async () => {
    const user = userEvent.setup();
    renderComProviders(<EmpresaFormDialog open empresa={empresa('America/Sao_Paulo')} onClose={() => {}} />);

    await user.click(await screen.findByRole('combobox', { name: 'Fuso horário' }));
    await user.click(within(screen.getByRole('listbox')).getByText(/^Amazonas \(UTC−4\)/));
    await user.click(screen.getByRole('button', { name: /Salvar/ }));

    await waitFor(() => expect(empresasApi.atualizarEmpresaSuperadmin).toHaveBeenCalledTimes(1));
    expect(vi.mocked(empresasApi.atualizarEmpresaSuperadmin).mock.calls[0][1]).toMatchObject({ fuso: 'America/Manaus' });
  });

  it('empresa nova já vem com Brasília selecionado', async () => {
    renderComProviders(<EmpresaFormDialog open empresa={null} onClose={() => {}} />);

    expect(await screen.findByText(/^Brasília \(UTC−3\)/)).toBeInTheDocument();
  });
});

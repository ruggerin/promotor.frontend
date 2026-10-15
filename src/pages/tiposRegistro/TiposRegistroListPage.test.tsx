import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../../test/renderWithProviders';
import type { TipoRegistro } from '../../types/api';
import { TiposRegistroListPage } from './TiposRegistroListPage';

vi.mock('../../lib/api/tiposRegistro');
vi.mock('../../lib/api/empresas');

import * as tiposApi from '../../lib/api/tiposRegistro';

const meta = { current_page: 1, last_page: 1, per_page: 15, total: 2 };

function tipo(id: string, descricao: string, espontaneo: boolean): TipoRegistro {
  return {
    id,
    descricao,
    icone: null,
    ordem: 0,
    exige_foto: false,
    permite_vincular_catalogo: false,
    acao_obrigatoria: false,
    escopo_acao: null,
    campanha_auditoria_uuid: null,
    granularidade_padrao: null,
    produtos_predefinidos: [],
    excecoes_granularidade: [],
    eh_ruptura: false,
    eh_alerta: false,
    usa_pontuacao: false,
    disponivel_registro_livre: espontaneo,
    campos: [],
    ativo: true,
  } as unknown as TipoRegistro;
}

describe('TiposRegistroListPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(tiposApi.listarTiposRegistro).mockResolvedValue({
      tipos_registro: [tipo('t1', 'Foto', true), tipo('t2', 'Auditoria de gôndola', false)],
      meta,
    } as never);
  });

  it('mostra se o formulário é de registro espontâneo', async () => {
    renderComProviders(<TiposRegistroListPage />);
    const foto = (await screen.findByText('Foto')).closest('tr')!;
    const auditoria = screen.getByText('Auditoria de gôndola').closest('tr')!;
    expect(within(foto).getByText('Sim')).toBeInTheDocument();
    expect(within(auditoria).getAllByText('Não').length).toBeGreaterThan(1);
  });

  it('filtra por registro espontâneo e trava o reordenar enquanto filtra', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<TiposRegistroListPage />);
    await screen.findByText('Foto');

    await usuario.click(screen.getByRole('combobox', { name: 'Registro espontâneo' }));
    await usuario.click(await screen.findByRole('option', { name: 'Não, só quando pedido' }));

    await waitFor(() =>
      expect(tiposApi.listarTiposRegistro).toHaveBeenLastCalledWith(expect.objectContaining({ disponivel_registro_livre: false })),
    );
    // O Tooltip põe o nome no <span> em volta (o botão desabilitado não recebe eventos).
    await waitFor(() => expect(screen.getAllByLabelText('Mover para baixo')[0].querySelector('button')).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Limpar filtros' })).toBeInTheDocument();
  });
});

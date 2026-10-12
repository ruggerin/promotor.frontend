import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as agendasApi from '../../lib/api/agendasVisita';
import * as pontosVendaApi from '../../lib/api/pontosVenda';
import * as usuariosApi from '../../lib/api/usuarios';
import { renderComProviders } from '../../test/renderWithProviders';
import { AgendasVisitaListPage } from './AgendasVisitaListPage';

vi.mock('../../lib/api/agendasVisita');
vi.mock('../../lib/api/pontosVenda');
vi.mock('../../lib/api/usuarios');

const META = { current_page: 1, last_page: 1, per_page: 15, total: 0 };

describe('AgendasVisitaListPage — filtros', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(agendasApi.listarAgendasVisita).mockResolvedValue({ agendas_visita: [], meta: META });
    vi.mocked(pontosVendaApi.listarPontosVenda).mockResolvedValue({
      pontos_venda: [{ id: 'loja-1', fantasia: 'Hortifruti São José' }],
      meta: META,
    } as unknown as Awaited<ReturnType<typeof pontosVendaApi.listarPontosVenda>>);
    vi.mocked(usuariosApi.listarUsuarios).mockResolvedValue({
      usuarios: [{ id: 'prom-1', nome: 'Juliana Ramos Costa' }],
      meta: META,
    } as unknown as Awaited<ReturnType<typeof usuariosApi.listarUsuarios>>);
  });

  it('manda loja, promotor, dia da semana (inclusive domingo) e situação pra API, e limpa tudo', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<AgendasVisitaListPage />, { rota: '/agendas-visita' });

    await usuario.click(await screen.findByRole('combobox', { name: 'Loja' }));
    await usuario.click(await screen.findByRole('option', { name: 'Hortifruti São José' }));
    await usuario.click(screen.getByRole('combobox', { name: 'Promotor' }));
    await usuario.click(await screen.findByRole('option', { name: 'Juliana Ramos Costa' }));
    await usuario.click(screen.getByRole('combobox', { name: 'Dia da semana' }));
    await usuario.click(await screen.findByRole('option', { name: 'Domingo' }));
    await usuario.click(screen.getByRole('combobox', { name: 'Situação' }));
    await usuario.click(await screen.findByRole('option', { name: 'Inativas' }));

    await waitFor(() =>
      expect(agendasApi.listarAgendasVisita).toHaveBeenLastCalledWith({
        page: 1,
        ponto_venda_uuid: 'loja-1',
        usuario_uuid: 'prom-1',
        dia_semana: 0,
        ativo: false,
      }),
    );
    expect(await screen.findByText('Nenhuma agenda com esses filtros.')).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Limpar filtros' }));
    await waitFor(() =>
      expect(agendasApi.listarAgendasVisita).toHaveBeenLastCalledWith({
        page: 1,
        ponto_venda_uuid: undefined,
        usuario_uuid: undefined,
        dia_semana: undefined,
        ativo: undefined,
      }),
    );
  }, 15_000);
});

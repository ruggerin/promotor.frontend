import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AreaConfiguracao, ItemConfiguracao } from '../../lib/api/parametros';
import { renderComProviders } from '../../test/renderWithProviders';
import { ConfiguracoesPage } from './ConfiguracoesPage';

vi.mock('../../lib/api/parametros');

import * as api from '../../lib/api/parametros';

function item(extra: Partial<ItemConfiguracao>): ItemConfiguracao {
  return {
    chave: 'X', area: 'visitas', rotulo: 'Item', ajuda: 'Ajuda do item', descricao_tecnica: '', tipo: 'bool', unidade: null,
    min: null, max: null, opcoes: null, depende_de: null, grupo: null, ativo_significa: null,
    padrao: 'false', valor: 'false', ativo: true, cadastrado: false, alterado_do_padrao: false, ...extra,
  };
}

const areas: AreaConfiguracao[] = [
  {
    chave: 'visitas', rotulo: 'Visitas e check-in', ajuda: 'Como a visita começa.', itens: [
      item({ chave: 'VISITA_CANCELAMENTO_PERMITIDO', rotulo: 'Promotor pode cancelar a própria visita' }),
      item({
        chave: 'CHECKIN_RAIO_METROS', rotulo: 'Raio do check-in', tipo: 'numero_ou_sem_limite', unidade: 'm', min: 10, max: 5000,
        padrao: '200', valor: '200', ativo_significa: 'sem_limite',
      }),
    ],
  },
  {
    chave: 'rastreamento', rotulo: 'Rastreamento', ajuda: 'Posição dos promotores.', itens: [
      item({ chave: 'RASTREAMENTO_INTERVALO_SEGUNDOS', area: 'rastreamento', rotulo: 'Enviar posição a cada', tipo: 'numero_ou_zero', unidade: 's', min: 30, max: 3600, padrao: '0', valor: '0' }),
      item({
        chave: 'RASTREAMENTO_PAINEL_CONFORMIDADE', area: 'rastreamento', rotulo: 'Mostrar quem está irregular',
        depende_de: { chave: 'RASTREAMENTO_INTERVALO_SEGUNDOS', motivo: 'Ligue o rastreamento para ajustar.' },
      }),
    ],
  },
];

describe('ConfiguracoesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.buscarCatalogoConfiguracoes).mockResolvedValue({ areas });
    vi.mocked(api.salvarConfiguracoesLote).mockResolvedValue({ areas });
  });

  it('mostra a área, avisa o que não foi salvo e envia só o que mudou no lote', async () => {
    const user = userEvent.setup();
    renderComProviders(<ConfiguracoesPage />, { rota: '/parametros' });

    const interruptor = await screen.findByRole('switch', { name: 'Promotor pode cancelar a própria visita' });
    expect(screen.queryByText(/ainda não/)).toBeNull();

    await user.click(interruptor);
    expect(await screen.findByText(/configuração alterada/)).toBeInTheDocument();
    expect(screen.getByText('Não salvo')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() =>
      expect(api.salvarConfiguracoesLote).toHaveBeenCalledWith([{ chave: 'VISITA_CANCELAMENTO_PERMITIDO', valor: 'true' }]),
    );
  });

  it('"Sem limite" no raio manda ativo=false e Descartar limpa as pendências', async () => {
    const user = userEvent.setup();
    renderComProviders(<ConfiguracoesPage />, { rota: '/parametros' });

    await user.click(await screen.findByRole('checkbox', { name: 'Sem limite' }));
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
    await waitFor(() => expect(api.salvarConfiguracoesLote).toHaveBeenCalledWith([{ chave: 'CHECKIN_RAIO_METROS', ativo: false }]));
  });

  it('descartar volta ao estado salvo', async () => {
    const user = userEvent.setup();
    renderComProviders(<ConfiguracoesPage />, { rota: '/parametros' });

    await user.click(await screen.findByRole('switch', { name: 'Promotor pode cancelar a própria visita' }));
    await user.click(await screen.findByRole('button', { name: 'Descartar' }));
    expect(screen.queryByText(/ainda não/)).toBeNull();
    expect(api.salvarConfiguracoesLote).not.toHaveBeenCalled();
  });

  it('opção que depende do rastreamento fica apagada com o motivo', async () => {
    const user = userEvent.setup();
    renderComProviders(<ConfiguracoesPage />, { rota: '/parametros' });

    await user.click(await screen.findByRole('button', { name: /Rastreamento/ }));
    expect(await screen.findByText('Ligue o rastreamento para ajustar.')).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: 'Mostrar quem está irregular' })).toBeDisabled();
  });

  it('busca atravessa as áreas', async () => {
    const user = userEvent.setup();
    renderComProviders(<ConfiguracoesPage />, { rota: '/parametros' });

    await user.type(await screen.findByRole('textbox', { name: 'Buscar configuração' }), 'irregular');
    expect(await screen.findByText('Mostrar quem está irregular')).toBeInTheDocument();
    expect(screen.queryByText('Raio do check-in')).toBeNull();
  });
});

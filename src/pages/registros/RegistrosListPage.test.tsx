import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../../test/renderWithProviders';
import { RegistrosListPage } from './RegistrosListPage';

vi.mock('../../lib/api/registros');
vi.mock('../../lib/api/visitas');
vi.mock('../../lib/api/tiposRegistro');
vi.mock('../../lib/api/pontosVenda');
vi.mock('../../lib/api/redesLojas');
vi.mock('../../lib/api/parametros');

import { listarRegistros } from '../../lib/api/registros';
import { buscarVisita } from '../../lib/api/visitas';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarRedesLojas } from '../../lib/api/redesLojas';

const linha = {
  id: 'reg-1',
  ocorrido_em: '2026-10-12T14:00:00Z',
  tipo_registro: { id: 't1', descricao: 'Ruptura', icone: null },
  ponto_venda: { id: 'p1', fantasia: 'Loja Centro', rede_loja: null },
  usuario: { id: 'u1', nome: 'Ana' },
  produto_auditoria: { id: 'pr1', descricao: 'Arroz 5kg' },
  observacao: 'Gôndola vazia',
  status: 'aberto' as const,
  motivo: null,
  motivo_texto: null,
  visita_id: 'vis-1',
};

const registroDetalhe = {
  id: 'reg-1',
  tipo_registro: { id: 't1', descricao: 'Ruptura', icone: null },
  produto_auditoria: { id: 'pr1', descricao: 'Arroz 5kg' },
  tipo_vinculo: null,
  secao: null,
  departamento: null,
  marca: null,
  ruptura: true,
  observacao: 'Gôndola vazia',
  valores_campos: null,
  campos_respondidos: [],
  pontuacao: null,
  imagens: [],
  alerta_resolvido_em: null,
  resolvido_por: null,
  alerta_motivo: null,
  alerta_motivo_texto: null,
};

describe('RegistrosListPage', { timeout: 20_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listarRegistros).mockResolvedValue({ registros: [linha], meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 } } as never);
    vi.mocked(buscarVisita).mockResolvedValue({ visita: { id: 'vis-1', registros: [registroDetalhe] } } as never);
    vi.mocked(listarTiposRegistro).mockResolvedValue({ tipos_registro: [] } as never);
    vi.mocked(listarPontosVenda).mockResolvedValue({ pontos_venda: [], meta: {} } as never);
    vi.mocked(listarRedesLojas).mockResolvedValue({ redes_lojas: [] } as never);
  });

  it('clicar na linha abre o registro (não a visita) com Resolver e atalho pra visita', async () => {
    const user = userEvent.setup();
    renderComProviders(<RegistrosListPage />, { rota: '/registros' });

    await user.click(await screen.findByText('Gôndola vazia', {}, { timeout: 8000 }));

    // Diálogo do registro, ainda na lista (nenhuma navegação).
    expect(await screen.findByRole('dialog', {}, { timeout: 8000 })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Pede ação')).toBeInTheDocument(), { timeout: 8000 });
    expect(buscarVisita).toHaveBeenCalledWith('vis-1');
    expect(screen.getByRole('button', { name: 'Resolver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver visita completa' })).toBeInTheDocument();
  });

  it('registro já resolvido não oferece Resolver', async () => {
    vi.mocked(listarRegistros).mockResolvedValue({
      registros: [{ ...linha, status: 'resolvido' as const, motivo: { id: 'm1', descricao: 'Reposto' } }],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
    } as never);
    const user = userEvent.setup();
    renderComProviders(<RegistrosListPage />, { rota: '/registros' });

    await user.click(await screen.findByText('Gôndola vazia', {}, { timeout: 8000 }));
    await screen.findByRole('dialog', {}, { timeout: 8000 });
    expect(await screen.findByText(/Resolvido — Reposto/, {}, { timeout: 8000 })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Resolver' })).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./client', () => ({ apiClient: { get: vi.fn() } }));

import { apiClient } from './client';
import { buscarRotaDoDia } from './rotas';

describe('buscarRotaDoDia', () => {
  beforeEach(() => vi.mocked(apiClient.get).mockResolvedValue({ data: {} }));

  it('manda só promotor e data — o corte do dia é pelo fuso da empresa, não do navegador (docs/50 §4.3)', async () => {
    await buscarRotaDoDia('u-1', '2026-09-29');

    expect(apiClient.get).toHaveBeenCalledWith('/rotas', { params: { usuario_uuid: 'u-1', data: '2026-09-29' } });
  });
});

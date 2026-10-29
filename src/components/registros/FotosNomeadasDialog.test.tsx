import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as clientApi from '../../lib/api/client';
import * as acompanhamentosApi from '../../lib/api/acompanhamentos';
import { renderComProviders } from '../../test/renderWithProviders';
import type { VisitaRegistro } from '../../types/api';
import { RegistroDetalheDialog } from './RegistroDetalheDialog';

vi.mock('../../lib/api/acompanhamentos', async (original) => ({
  ...(await original<typeof acompanhamentosApi>()),
  listarAcompanhamentos: vi.fn(),
}));
vi.mock('../ComentariosRegistro', () => ({ ComentariosRegistro: () => null }));

const registro = {
  id: 'r1',
  tipo_registro: { id: 't1', descricao: 'Conquista de espaço', icone: null },
  produto_auditoria: null,
  ruptura: false,
  pontuacao: null,
  campos_respondidos: [],
  perguntas_foto: [
    { chave: 'antes', rotulo: 'Antes' },
    { chave: 'depois', rotulo: 'Depois' },
  ],
  alertas_fotos: ['As fotos estão fora de ordem: uma foto de uma pergunta posterior foi tirada antes da anterior.'],
  imagens: [
    { id: 'f1', url: '/a', campo_chave: 'antes', origem: 'HISTORICO', capturada_em: '2026-10-21T13:05:00Z', distancia_loja_metros: 4000 },
    { id: 'f2', url: '/d', campo_chave: 'depois', origem: 'CAMERA', capturada_em: '2026-10-28T13:05:00Z', distancia_loja_metros: 2300 },
    { id: 'f3', url: '/o', campo_chave: null },
  ],
} as unknown as VisitaRegistro;

describe('RegistroDetalheDialog — fotos nomeadas (docs/98)', () => {
  beforeEach(() => {
    vi.spyOn(clientApi.apiClient, 'get').mockResolvedValue({ data: new Blob(['x']) });
    vi.mocked(acompanhamentosApi.listarAcompanhamentos).mockResolvedValue({ acompanhamentos: [] } as never);
  });

  it('mostra Antes, Depois e Outras fotos, com origem, distância e alerta', async () => {
    renderComProviders(<RegistroDetalheDialog registro={registro} visitaUuid="v1" onClose={() => {}} />);

    expect(screen.getByText('Antes')).toBeInTheDocument();
    expect(screen.getByText('Depois')).toBeInTheDocument();
    expect(screen.getByText('Outras fotos')).toBeInTheDocument();
    expect(screen.getByText(/fora de ordem/)).toBeInTheDocument();
    expect(screen.getByText(/de uma visita anterior/)).toBeInTheDocument();
    // Distância só nas fotos desta visita (a do histórico foi tirada lá atrás, em outro contexto).
    expect(screen.getByText(/2,3 km da loja/)).toBeInTheDocument();
    expect(screen.queryByText(/4 km da loja/)).not.toBeInTheDocument();
  });
});

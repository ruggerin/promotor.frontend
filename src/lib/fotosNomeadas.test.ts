import { describe, expect, it } from 'vitest';
import { agruparFotos, legendaFoto, textoDistancia } from './fotosNomeadas';

describe('fotos nomeadas (docs/98)', () => {
  it('agrupa na ordem das perguntas, deixa as livres à parte e some com pergunta sem foto', () => {
    const { grupos, livres } = agruparFotos({
      perguntas_foto: [
        { chave: 'antes', rotulo: 'Antes' },
        { chave: 'meio', rotulo: 'Durante' },
        { chave: 'depois', rotulo: 'Depois' },
      ],
      imagens: [
        { id: '1', url: 'u1', campo_chave: 'depois' },
        { id: '2', url: 'u2', campo_chave: 'antes' },
        { id: '3', url: 'u3', campo_chave: null },
        { id: '4', url: 'u4', campo_chave: 'antes' },
      ],
    });
    expect(grupos.map((g) => [g.rotulo, g.fotos.map((f) => f.id)])).toEqual([
      ['Antes', ['2', '4']],
      ['Depois', ['1']],
    ]);
    expect(livres.map((f) => f.id)).toEqual(['3']);
  });

  it('pergunta que não veio na lista aparece pela chave', () => {
    const { grupos } = agruparFotos({ imagens: [{ id: '1', url: 'u', campo_chave: 'antes' }] });
    expect(grupos).toEqual([{ chave: 'antes', rotulo: 'antes', fotos: [{ id: '1', url: 'u', campo_chave: 'antes' }] }]);
  });

  it('legenda com a origem e a distância', () => {
    expect(legendaFoto({ id: '1', url: 'u', origem: 'VISITA' })).toBe('reaproveitada desta visita');
    expect(legendaFoto({ id: '1', url: 'u', origem: 'HISTORICO', capturada_em: '2026-10-21T13:05:00Z' })).toMatch(/^Tirada em \d\d\/10 às .* · de uma visita anterior$/);
    expect(legendaFoto({ id: '1', url: 'u' })).toBe('');
    expect(textoDistancia(350)).toBe('350 m da loja');
    expect(textoDistancia(11200)).toBe('11,2 km da loja');
    expect(textoDistancia(null)).toBeNull();
  });
});

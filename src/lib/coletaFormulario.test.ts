import { describe, expect, it } from 'vitest';
import { montarMatriz, moda, type CelulaColeta, type RelatorioColeta } from './coletaFormulario';

function celula(over: Partial<CelulaColeta> & Pick<CelulaColeta, 'registro_id' | 'campo'>): CelulaColeta {
  return {
    visita_id: 'v1',
    registrado_em: '2026-09-08T13:00:00Z',
    ponto_venda: { id: 'pv1', fantasia: 'Assaí', rede: 'Assaí' },
    promotor: 'Ana',
    produto: { id: 'p1', descricao: 'Lasanha', codigo_externo: null },
    valor: '10',
    valor_numerico: 10,
    ...over,
  };
}

const base: Omit<RelatorioColeta, 'celulas'> = {
  tipo_registro: { id: 't', descricao: 'Pesquisa de Preço' },
  periodo: { data_inicio: '2026-09-01', data_fim: '2026-09-26' },
  total_registros: 0,
  campos: [
    { chave: 'preco', rotulo: 'Preço', tipo_campo: 'MOEDA' },
    { chave: 'obs', rotulo: 'Obs', tipo_campo: 'TEXTO' },
  ],
};

// Assaí em duas datas (duas coletas) + Atacadão; Lasanha em todas, Pizza só no Assaí de 08/09.
const dados: RelatorioColeta = {
  ...base,
  celulas: [
    celula({ registro_id: 'r1', campo: 'preco', valor: '11,79', valor_numerico: 11.79 }),
    celula({ registro_id: 'r2', campo: 'preco', produto: { id: 'p2', descricao: 'Pizza', codigo_externo: null }, valor: '20', valor_numerico: 20 }),
    celula({ registro_id: 'r3', visita_id: 'v2', registrado_em: '2026-09-22T13:00:00Z', campo: 'preco', valor: '12,50', valor_numerico: 12.5 }),
    celula({
      registro_id: 'r4',
      visita_id: 'v3',
      ponto_venda: { id: 'pv2', fantasia: 'Atacadão', rede: null },
      campo: 'preco',
      valor: '11,79',
      valor_numerico: 11.79,
    }),
    celula({ registro_id: 'r4', visita_id: 'v3', ponto_venda: { id: 'pv2', fantasia: 'Atacadão', rede: null }, campo: 'obs', valor: 'ponta', valor_numerico: null }),
  ],
};

describe('coletaFormulario', () => {
  it('linha por coleta: mesma loja em duas visitas vira duas linhas, nunca mescla', () => {
    const m = montarMatriz(dados, { linhas: 'loja', agrupar: 'eixo', campos: ['preco'] });

    expect(m.linhas.map((l) => [l[0].texto, l[1].texto])).toEqual([
      ['Assaí', '08/09/2026'],
      ['Assaí', '22/09/2026'],
      ['Atacadão', '08/09/2026'],
    ]);
    // Colunas: Loja, Data, Promotor, Lasanha, Pizza
    expect(m.rotulosColunas).toEqual(['Loja', 'Data', 'Promotor', 'Lasanha', 'Pizza']);
    expect(m.linhas[0][3].texto).toContain('11,79');
    expect(m.linhas[1][4].texto).toBe('—'); // Pizza não coletada na 2ª visita
  });

  it('rodapé com quantidade/média/moda/mín/máx por coluna numérica', () => {
    const m = montarMatriz(dados, { linhas: 'loja', agrupar: 'eixo', campos: ['preco'] });
    const lasanha = m.rodape.map((l) => l[3].texto);

    expect(m.rodape.map((l) => l[0].texto)).toEqual(['Quantidade', 'Média', 'Moda', 'Mínimo', 'Máximo']);
    expect(lasanha[0]).toBe('3');
    expect(lasanha[1]).toContain('12,03'); // (11,79 + 12,50 + 11,79) / 3
    expect(lasanha[2]).toContain('11,79');
    expect(lasanha[3]).toContain('11,79');
    expect(lasanha[4]).toContain('12,50');
    expect(m.rodape[2][4].texto).toBe('—'); // Pizza: uma coleta, sem moda
  });

  it('linhas por produto: coletas viram colunas e estatística vira colunas à direita', () => {
    const m = montarMatriz(dados, { linhas: 'produto', agrupar: 'eixo', campos: ['preco'] });

    expect(m.linhas.map((l) => l[0].texto)).toEqual(['Lasanha', 'Pizza']);
    expect(m.rotulosColunas.slice(0, 4)).toEqual(['Produto', 'Assaí · 08/09/2026', 'Assaí · 22/09/2026', 'Atacadão · 08/09/2026']);
    expect(m.rotulosColunas.slice(-5)).toEqual(['Quantidade', 'Média', 'Moda', 'Mínimo', 'Máximo']);
    expect(m.linhas[0].at(-5)?.texto).toBe('3');
    expect(m.rodape).toEqual([]);
  });

  it('duas perguntas: cabeçalho em dois níveis e agrupamento invertível', () => {
    const porProduto = montarMatriz(dados, { linhas: 'loja', agrupar: 'eixo', campos: ['preco', 'obs'] });
    expect(porProduto.cabecalho).toHaveLength(2);
    expect(porProduto.rotulosColunas.slice(3)).toEqual(['Lasanha — Preço', 'Lasanha — Obs', 'Pizza — Preço', 'Pizza — Obs']);

    const porPergunta = montarMatriz(dados, { linhas: 'loja', agrupar: 'pergunta', campos: ['preco', 'obs'] });
    expect(porPergunta.rotulosColunas.slice(3)).toEqual(['Lasanha — Preço', 'Pizza — Preço', 'Lasanha — Obs', 'Pizza — Obs']);
    // Texto não tem estatística: rodapé vazio nessas colunas.
    expect(porPergunta.rodape[1][5].texto).toBe('');
    expect(porPergunta.linhas[2][5].texto).toBe('ponta');
  });

  it('mesma visita com o mesmo produto duas vezes abre outra linha em vez de sobrescrever', () => {
    const m = montarMatriz(
      { ...base, celulas: [celula({ registro_id: 'a', campo: 'preco' }), celula({ registro_id: 'b', campo: 'preco', valor: '9', valor_numerico: 9 })] },
      { linhas: 'loja', agrupar: 'eixo', campos: ['preco'] },
    );
    expect(m.linhas).toHaveLength(2);
  });

  it('moda só com repetição; empate fica com o menor', () => {
    expect(moda([1, 2, 3])).toBeNull();
    expect(moda([5, 5, 2, 2, 9])).toBe(2);
    expect(moda([11.79, 11.79, 12.5])).toBe(11.79);
  });
});

import { describe, expect, it } from 'vitest';
import type { ItemConfiguracao } from '../../lib/api/parametros';
import { avisoCombinacaoCheckout, casaComBusca, edicaoDoServidor, erroDaEdicao, estaLigado, iguais, paraAlteracao } from './configuracoesLogica';

function item(extra: Partial<ItemConfiguracao>): ItemConfiguracao {
  return {
    chave: 'X', area: 'visitas', rotulo: 'Raio do check-in', ajuda: 'Distância máxima', descricao_tecnica: '', tipo: 'numero',
    unidade: 'm', min: 10, max: 5000, opcoes: null, depende_de: null, grupo: null, ativo_significa: null,
    padrao: '200', valor: '200', ativo: true, cadastrado: false, alterado_do_padrao: false, ...extra,
  };
}

describe('configuracoesLogica', () => {
  it('valida número dentro da faixa e recusa lixo', () => {
    const i = item({});
    expect(erroDaEdicao(i, { valor: '200', semLimite: false })).toBeNull();
    expect(erroDaEdicao(i, { valor: '5', semLimite: false })).toMatch(/10 a 5000/);
    expect(erroDaEdicao(i, { valor: 'talvez', semLimite: false })).toMatch(/número inteiro/);
  });

  it('numero_ou_zero aceita 0 (desligado) mas não valores abaixo do piso', () => {
    const i = item({ tipo: 'numero_ou_zero', min: 30, max: 3600, unidade: 's' });
    expect(erroDaEdicao(i, { valor: '0', semLimite: false })).toBeNull();
    expect(erroDaEdicao(i, { valor: '10', semLimite: false })).not.toBeNull();
    expect(erroDaEdicao(i, { valor: '60', semLimite: false })).toBeNull();
  });

  it('"sem limite" dispensa o número e vira ativo=false no payload', () => {
    const i = item({ tipo: 'numero_ou_sem_limite', ativo_significa: 'sem_limite', chave: 'CHECKIN_RAIO_METROS' });
    expect(erroDaEdicao(i, { valor: '', semLimite: true })).toBeNull();
    expect(paraAlteracao(i, { valor: '200', semLimite: true })).toEqual({ chave: 'CHECKIN_RAIO_METROS', ativo: false });
    expect(paraAlteracao(i, { valor: '150', semLimite: false })).toEqual({ chave: 'CHECKIN_RAIO_METROS', valor: '150' });
  });

  it('linha desativada do raio chega como "sem limite"', () => {
    const i = item({ tipo: 'numero_ou_sem_limite', ativo_significa: 'sem_limite', ativo: false });
    expect(edicaoDoServidor(i).semLimite).toBe(true);
  });

  it('compara edições e detecta ligado/desligado', () => {
    expect(iguais({ valor: '1', semLimite: false }, { valor: '1', semLimite: false })).toBe(true);
    expect(iguais({ valor: '1', semLimite: true }, { valor: '2', semLimite: true })).toBe(true);
    expect(estaLigado(item({ tipo: 'bool' }), { valor: 'true', semLimite: false })).toBe(true);
    expect(estaLigado(item({ tipo: 'numero_ou_zero' }), { valor: '0', semLimite: false })).toBe(false);
  });

  it('busca ignora acento e olha rótulo, ajuda, chave e área', () => {
    const i = item({ chave: 'CHECKIN_RAIO_METROS' });
    expect(casaComBusca(i, 'Visitas e check-in', 'distancia')).toBe(true);
    expect(casaComBusca(i, 'Visitas e check-in', 'raio_metros')).toBe(true);
    expect(casaComBusca(i, 'Visitas e check-in', 'rastreamento')).toBe(false);
  });
});

describe('avisoCombinacaoCheckout (docs/92 §8)', () => {
  const com = (valores: Record<string, string>) => (c: string) => valores[c] ?? null;

  it('avisa raio do checkout maior que o afastamento do rastreamento', () => {
    expect(avisoCombinacaoCheckout('CHECKOUT_RAIO_METROS', com({ CHECKOUT_RAIO_METROS: '500', RASTREAMENTO_AFASTAMENTO_METROS: '300' }))).toMatch(/300 m/);
    expect(avisoCombinacaoCheckout('CHECKOUT_RAIO_METROS', com({ CHECKOUT_RAIO_METROS: '200', RASTREAMENTO_AFASTAMENTO_METROS: '300' }))).toBeNull();
    expect(avisoCombinacaoCheckout('CHECKOUT_RAIO_METROS', com({ CHECKOUT_RAIO_METROS: '0', RASTREAMENTO_AFASTAMENTO_METROS: '300' }))).toBeNull();
  });

  it('avisa BLOQUEIA sem a sugestão da saída, só com raio definido', () => {
    const base = { CHECKOUT_RAIO_METROS: '200', CHECKOUT_FORA_DO_RAIO: 'BLOQUEIA' };
    expect(avisoCombinacaoCheckout('CHECKOUT_FORA_DO_RAIO', com({ ...base, CHECKOUT_SUGERIR_SAIDA: 'false' }))).toMatch(/voltar à loja/);
    expect(avisoCombinacaoCheckout('CHECKOUT_FORA_DO_RAIO', com({ ...base, CHECKOUT_SUGERIR_SAIDA: 'true' }))).toBeNull();
    expect(avisoCombinacaoCheckout('CHECKOUT_FORA_DO_RAIO', com({ ...base, CHECKOUT_RAIO_METROS: '0' }))).toBeNull();
    expect(avisoCombinacaoCheckout('CHECKOUT_FORA_DO_RAIO', com({ ...base, CHECKOUT_FORA_DO_RAIO: 'AVISA' }))).toBeNull();
  });

  it('avisa fechamento automático antes do push', () => {
    expect(avisoCombinacaoCheckout('CHECKOUT_AUTOMATICO_MINUTOS', com({ CHECKOUT_AUTOMATICO_MINUTOS: '30', CHECKOUT_AVISO_SAIDA_MINUTOS: '30' }))).toMatch(/30 min/);
    expect(avisoCombinacaoCheckout('CHECKOUT_AUTOMATICO_MINUTOS', com({ CHECKOUT_AUTOMATICO_MINUTOS: '60', CHECKOUT_AVISO_SAIDA_MINUTOS: '10' }))).toBeNull();
    expect(avisoCombinacaoCheckout('CHECKOUT_AUTOMATICO_MINUTOS', com({ CHECKOUT_AUTOMATICO_MINUTOS: '30', CHECKOUT_AVISO_SAIDA_MINUTOS: '0' }))).toBeNull();
  });

  it('não avisa nas outras chaves', () => {
    expect(avisoCombinacaoCheckout('CHECKIN_RAIO_METROS', com({}))).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { DEFAULT_VALUES, camposDoSobreOQue, campoVazio, payloadDoForm, schema, sobreOQue, type FormData } from './modelo';

// docs/79 — promotor escolhe marca/departamento/seção e o Mix segue a escolha.
function pontoExtra(): FormData {
  return {
    ...DEFAULT_VALUES,
    descricao: 'Ponto Extra',
    ...camposDoSobreOQue('PROMOTOR_ESCOLHE_RECORTE'),
    campos: [
      {
        ...campoVazio('SORTIMENTO'),
        chave: 'mix',
        rotulo: 'Mix',
        sortimento_origem: 'DINAMICO',
        sortimento_segue_escolha: true,
      },
    ],
  };
}

describe('escolha de recorte pelo promotor', () => {
  it('a opção nova nasce com departamento e seção e grava granularidade LINHA', () => {
    const c = camposDoSobreOQue('PROMOTOR_ESCOLHE_RECORTE');
    expect(c).toMatchObject({ granularidade_padrao: 'LINHA', escolhe_marca: false, escolhe_departamento: true, escolhe_secao: true });
    expect(sobreOQue(c)).toBe('PROMOTOR_ESCOLHE_RECORTE');
  });

  it('trocar pra outra opção limpa as caixinhas', () => {
    expect(camposDoSobreOQue('LINHA')).toMatchObject({ escolhe_marca: false, escolhe_departamento: false, escolhe_secao: false });
    expect(sobreOQue(camposDoSobreOQue('LINHA'))).toBe('LINHA');
  });

  it('Mix que segue a escolha é válido sem seção/departamento/marca fixos e vai sem recorte no payload', () => {
    const d = pontoExtra();
    expect(schema.safeParse(d).success).toBe(true);

    const payload = payloadDoForm(d);
    expect(payload).toMatchObject({ escolhe_departamento: true, escolhe_secao: true, escolhe_marca: false });
    expect(payload.campos?.[0]).toMatchObject({ sortimento_segue_escolha: true, sortimento_tipo_vinculo: null, sortimento_secao_uuid: null });
  });

  it('Mix que segue a escolha exige que o passo 3 deixe o promotor escolher', () => {
    const d = { ...pontoExtra(), ...camposDoSobreOQue('LINHA') };
    expect(schema.safeParse(d).success).toBe(false);
  });
});

// docs/80 — Ação onde a linha não está no Mix + filtro por ramo.
describe('linha ausente', () => {
  const base: FormData = { ...DEFAULT_VALUES, descricao: 'Linha ausente: Batatas Palha', acao_obrigatoria: true, escopo_acao: 'LINHA_AUSENTE' };

  it('exige a linha escolhida', () => {
    expect(schema.safeParse({ ...base, escopo_tipo_vinculo: 'SECAO' }).success).toBe(false);
    expect(schema.safeParse({ ...base, escopo_tipo_vinculo: 'SECAO', escopo_secao_uuid: 's1' }).success).toBe(true);
  });

  it('manda só o recorte escolhido e os ramos; sem Ação obrigatória, nada disso vai', () => {
    const d = { ...base, escopo_tipo_vinculo: 'SECAO' as const, escopo_secao_uuid: 's1', escopo_marca_uuid: 'sobrou', ramos_atividade_uuids: ['r1'] };
    expect(payloadDoForm(d)).toMatchObject({
      escopo_acao: 'LINHA_AUSENTE', escopo_tipo_vinculo: 'SECAO', escopo_secao_uuid: 's1', escopo_marca_uuid: null, ramos_atividade_uuids: ['r1'],
    });
    expect(payloadDoForm({ ...d, acao_obrigatoria: false })).toMatchObject({
      escopo_acao: null, escopo_tipo_vinculo: null, escopo_secao_uuid: null, ramos_atividade_uuids: [],
    });
  });
});

// docs/80 §5.2 — intervalo entre cobranças.
describe('intervalo entre cobranças', () => {
  const base: FormData = { ...DEFAULT_VALUES, descricao: 'Levantamento', acao_obrigatoria: true, escopo_acao: 'SEMPRE' };

  it('aceita 0 ou mais dias inteiros e só vai com Ação obrigatória', () => {
    expect(schema.safeParse({ ...base, intervalo_dias: 7 }).success).toBe(true);
    expect(schema.safeParse({ ...base, intervalo_dias: -1 }).success).toBe(false);
    expect(schema.safeParse({ ...base, intervalo_dias: 1.5 }).success).toBe(false);
    expect(payloadDoForm({ ...base, intervalo_dias: 7 }).intervalo_dias).toBe(7);
    expect(payloadDoForm({ ...base, intervalo_dias: 7, acao_obrigatoria: false }).intervalo_dias).toBe(0);
  });
});

// docs/82 — lista "Na loja" e filtro de marca depois da seção/departamento.
describe('lista do onde é e filtro de marca', () => {
  it('vai no payload com a escolha do promotor', () => {
    const payload = payloadDoForm({ ...pontoExtra(), lista_recorte: 'SO_DA_LOJA', filtra_marca: true });
    expect(payload).toMatchObject({ lista_recorte: 'SO_DA_LOJA', filtra_marca: true });
  });

  it('sem a escolha do promotor volta ao padrão e não filtra marca', () => {
    const d = { ...pontoExtra(), ...camposDoSobreOQue('LINHA'), lista_recorte: 'SO_DA_LOJA' as const, filtra_marca: true };
    expect(payloadDoForm(d)).toMatchObject({ lista_recorte: 'PRIMEIRO_DA_LOJA', filtra_marca: false });
  });

  it('filtro de marca precisa de seção ou departamento', () => {
    const d = { ...pontoExtra(), escolhe_marca: true, escolhe_departamento: false, escolhe_secao: false, filtra_marca: true };
    expect(payloadDoForm(d).filtra_marca).toBe(false);
  });
});

// docs/98 — pergunta FOTO (antes/depois).
describe('pergunta FOTO', () => {
  function conquista(antes: Partial<ReturnType<typeof campoVazio>> = {}): FormData {
    return {
      ...DEFAULT_VALUES,
      descricao: 'Conquista de espaço',
      campos: [
        { ...campoVazio('FOTO'), chave: 'antes', rotulo: 'Antes', obrigatorio: true, fotoMinTexto: '1', fotoMaxTexto: '2', foto_reaproveitar: 'HISTORICO', foto_dica: ' Enquadre a gôndola ', ...antes },
        { ...campoVazio('NUMERO'), chave: 'modulos', rotulo: 'Módulos' },
      ],
    };
  }

  it('vai pro payload com quantidade, reaproveitamento e dica; outras perguntas não levam config de foto', () => {
    const payload = payloadDoForm(conquista());
    expect(payload.campos?.[0]).toMatchObject({ tipo_campo: 'FOTO', foto_min: 1, foto_max: 2, foto_reaproveitar: 'HISTORICO', foto_dica: 'Enquadre a gôndola' });
    expect(payload.campos?.[1]).not.toHaveProperty('foto_max');
  });

  it('vazio = sem limite', () => {
    expect(payloadDoForm(conquista({ fotoMinTexto: '', fotoMaxTexto: '' })).campos?.[0]).toMatchObject({ foto_min: null, foto_max: null });
  });

  it('máximo menor que o mínimo é inválido', () => {
    expect(schema.safeParse(conquista({ fotoMinTexto: '3', fotoMaxTexto: '1' })).success).toBe(false);
    expect(schema.safeParse(conquista()).success).toBe(true);
  });
});

// docs/100 — "Cada seção / linha" como lista guiada e checklist item a item.
describe('lista guiada de seções/linhas', () => {
  const linha = (extra: Partial<FormData>): FormData => ({ ...DEFAULT_VALUES, descricao: 'Planograma', ...camposDoSobreOQue('LINHA'), ...extra });

  it('lista fixa vai com os uuids na ordem', () => {
    const p = payloadDoForm(linha({ linha_nivel: 'SECAO', linha_origem: 'FIXA', linhas_fixas: [{ uuid: 'b', descricao: 'Bebidas' }, { uuid: 'a', descricao: 'Limpeza' }] }));
    expect(p).toMatchObject({ linha_nivel: 'SECAO', linha_origem: 'FIXA', linhas_fixas: ['b', 'a'] });
  });

  it('Mix da loja não manda lista; livre manda sem nível', () => {
    expect(payloadDoForm(linha({ linha_nivel: 'MARCA', linha_origem: 'MIX_LOJA', linhas_fixas: [{ uuid: 'x', descricao: 'X' }] }))).toMatchObject({
      linha_nivel: 'MARCA',
      linhas_fixas: null,
    });
    expect(payloadDoForm(linha({ linha_nivel: null }))).toMatchObject({ linha_nivel: null, linhas_fixas: null });
  });

  it('fora de "Cada seção / linha" não vale', () => {
    const d: FormData = { ...DEFAULT_VALUES, descricao: 'X', ...camposDoSobreOQue('PRODUTO'), linha_nivel: 'SECAO' };
    expect(payloadDoForm(d)).toMatchObject({ linha_nivel: null });
  });

  it('lista fixa vazia é inválida', () => {
    expect(schema.safeParse(linha({ linha_nivel: 'SECAO', linha_origem: 'FIXA', linhas_fixas: [] })).success).toBe(false);
    expect(schema.safeParse(linha({ linha_nivel: 'SECAO', linha_origem: 'MIX_LOJA' })).success).toBe(true);
  });

  it('checklist leva o formato; outras perguntas, o padrão', () => {
    const d: FormData = {
      ...DEFAULT_VALUES,
      descricao: 'Mix',
      campos: [
        { ...campoVazio('SORTIMENTO'), chave: 'mix', rotulo: 'Mix', sortimento_origem: 'DINAMICO', sortimento_modo: 'CONFERIR' },
        { ...campoVazio('TEXTO'), chave: 'obs', rotulo: 'Obs', sortimento_modo: 'CONFERIR' },
      ],
    };
    const p = payloadDoForm(d);
    expect(p.campos?.[0]).toMatchObject({ sortimento_modo: 'CONFERIR' });
    expect(p.campos?.[1]).toMatchObject({ sortimento_modo: 'PRESENTE' });
  });
});

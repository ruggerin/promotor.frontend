import { z } from 'zod';
import type { CampoTipoRegistro, TipoCampoRegistro, TipoRegistro } from '../../../types/api';
import type { TipoRegistroPayload } from '../../../lib/api/tiposRegistro';

// Modelo do editor de Formulário (TipoRegistro) — schema, conversões API ⇄ formulário e as
// traduções entre as opções em linguagem simples da tela (protótipo "Formulário — revisão de UX")
// e os campos reais do TipoRegistro. A tela nunca inventa campo novo: tudo mapeia pro que já existe.

export const campoSchema = z.object({
  chave: z
    .string()
    .min(1, 'Obrigatório')
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Só minúsculas, números e underscore (ex.: quantidade).'),
  // true = a chave veio do servidor ou foi alterada à mão → não acompanha mais o rótulo. Chave
  // de pergunta já salva nunca muda sozinha: as respostas antigas ficam gravadas por ela.
  chaveFixa: z.boolean(),
  rotulo: z.string().min(1, 'Escreva a pergunta').max(255),
  tipo_campo: z.enum(['NUMERO', 'TEXTO', 'MOEDA', 'MULTIPLA_ESCOLHA', 'BOOLEANO', 'DATA', 'SORTIMENTO']),
  opcoesTexto: z.string(),
  obrigatorio: z.boolean(),
  limiteDiasRetroativosTexto: z
    .string()
    .refine(
      (v) => v === '' || (!Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0),
      'Deve ser um número inteiro positivo',
    ),
  depende_de_chave: z.string().nullable(),
  depende_de_valor: z.string().nullable(),
  sortimento_origem: z.enum(['DINAMICO', 'FIXO']).nullable(),
  sortimento_tipo_vinculo: z.enum(['SECAO', 'DEPARTAMENTO', 'MARCA']).nullable(),
  sortimento_secao_uuid: z.string().nullable(),
  sortimento_departamento_uuid: z.string().nullable(),
  sortimento_marca_uuid: z.string().nullable(),
  sortimento_produtos: z.array(z.object({ uuid: z.string(), descricao: z.string() })),
  confirmar_ruptura_ausentes: z.boolean(),
});

const excecaoGranularidadeSchema = z.object({
  secao_uuid: z.string().min(1, 'Escolha a seção'),
  granularidade: z.enum(['LINHA', 'PRODUTO']),
});

export const schema = z
  .object({
    descricao: z.string().min(1, 'Dê um nome ao formulário').max(255),
    icone: z.string().nullable(),
    exige_foto: z.boolean(),
    permite_vincular_catalogo: z.boolean(),
    ativo: z.boolean(),
    acao_obrigatoria: z.boolean(),
    escopo_acao: z.enum(['SEMPRE', 'CAMPANHA', 'CONTRATO', 'LOJA_REDE']).nullable(),
    campanha_auditoria_uuid: z.string().nullable(),
    pontos_venda_escopo: z.array(z.object({ id: z.string(), fantasia: z.string() })),
    redes_lojas_uuids: z.array(z.string()),
    granularidade_padrao: z.enum(['LINHA', 'PRODUTO']).nullable(),
    produtos_predefinidos: z.array(z.object({ uuid: z.string(), descricao: z.string() })),
    excecoes_granularidade: z.array(excecaoGranularidadeSchema),
    eh_ruptura: z.boolean(),
    eh_alerta: z.boolean(),
    usa_pontuacao: z.boolean(),
    disponivel_registro_livre: z.boolean(),
    campos: z.array(campoSchema),
  })
  .refine((d) => !d.acao_obrigatoria || d.escopo_acao !== null, {
    message: 'Escolha quando essa pendência aparece.',
    path: ['escopo_acao'],
  })
  .refine((d) => d.escopo_acao !== 'CAMPANHA' || !!d.campanha_auditoria_uuid, {
    message: 'Escolha a campanha.',
    path: ['campanha_auditoria_uuid'],
  })
  .refine((d) => new Set(d.campos.map((c) => c.chave)).size === d.campos.length, {
    message: 'Duas perguntas estão com o mesmo código interno — altere um deles.',
    path: ['campos'],
  })
  // Condicional só pode depender de pergunta ANTERIOR (a cadeia sempre desce) — mesma regra do backend.
  .refine(
    (d) => d.campos.every((c, i) => !c.depende_de_chave || d.campos.slice(0, i).some((a) => a.chave === c.depende_de_chave)),
    { message: 'Uma pergunta condicional precisa vir depois da pergunta de que ela depende.', path: ['campos'] },
  )
  .refine((d) => d.campos.every((c) => !c.depende_de_chave || !!c.depende_de_valor), {
    message: 'Escolha a resposta que faz a pergunta condicional aparecer.',
    path: ['campos'],
  })
  .refine((d) => d.campos.every((c) => c.tipo_campo !== 'MULTIPLA_ESCOLHA' || c.opcoesTexto.trim() !== ''), {
    message: 'Pergunta de múltipla escolha precisa de pelo menos uma opção.',
    path: ['campos'],
  })
  .refine((d) => d.campos.every((c) => c.tipo_campo !== 'SORTIMENTO' || !!c.sortimento_origem), {
    message: 'Checklist de produtos: escolha "uma lista que eu escolho" ou "o mix real de cada loja".',
    path: ['campos'],
  })
  .refine(
    (d) =>
      d.campos.every((c) => {
        if (c.sortimento_origem !== 'DINAMICO') return true;
        if (c.sortimento_tipo_vinculo === 'SECAO') return !!c.sortimento_secao_uuid;
        if (c.sortimento_tipo_vinculo === 'DEPARTAMENTO') return !!c.sortimento_departamento_uuid;
        if (c.sortimento_tipo_vinculo === 'MARCA') return !!c.sortimento_marca_uuid;
        return false;
      }),
    { message: 'Checklist pelo mix da loja: escolha a seção, o departamento ou a marca.', path: ['campos'] },
  )
  .refine((d) => d.campos.every((c) => c.sortimento_origem !== 'FIXO' || c.sortimento_produtos.length > 0), {
    message: 'Checklist com lista escolhida: adicione pelo menos um produto.',
    path: ['campos'],
  });

export type FormData = z.infer<typeof schema>;
export type CampoForm = FormData['campos'][number];

export const DEFAULT_VALUES: FormData = {
  descricao: '',
  icone: null,
  exige_foto: false,
  permite_vincular_catalogo: false,
  ativo: true,
  acao_obrigatoria: false,
  escopo_acao: null,
  campanha_auditoria_uuid: null,
  pontos_venda_escopo: [],
  redes_lojas_uuids: [],
  granularidade_padrao: null,
  produtos_predefinidos: [],
  excecoes_granularidade: [],
  eh_ruptura: false,
  eh_alerta: false,
  usa_pontuacao: false,
  disponivel_registro_livre: true,
  campos: [],
};

export interface CampanhaContexto {
  uuid: string;
  descricao: string;
}

/** Aberto a partir de uma Campanha: já nasce "numa campanha", fora do Registro geral (doc 20 §3). */
export function valoresIniciais(campanhaContexto: CampanhaContexto | null): FormData {
  if (!campanhaContexto) return DEFAULT_VALUES;
  return {
    ...DEFAULT_VALUES,
    acao_obrigatoria: true,
    escopo_acao: 'CAMPANHA',
    campanha_auditoria_uuid: campanhaContexto.uuid,
    disponivel_registro_livre: false,
  };
}

export function campoVazio(tipo: TipoCampoRegistro = 'BOOLEANO'): CampoForm {
  return {
    chave: '',
    chaveFixa: false,
    rotulo: '',
    tipo_campo: tipo,
    opcoesTexto: '',
    obrigatorio: false,
    limiteDiasRetroativosTexto: '',
    depende_de_chave: null,
    depende_de_valor: null,
    sortimento_origem: null,
    sortimento_tipo_vinculo: null,
    sortimento_secao_uuid: null,
    sortimento_departamento_uuid: null,
    sortimento_marca_uuid: null,
    sortimento_produtos: [],
    confirmar_ruptura_ausentes: false,
  };
}

export function campoDaApi(c: CampoTipoRegistro, manterCondicao: boolean): CampoForm {
  return {
    chave: c.chave,
    chaveFixa: true,
    rotulo: c.rotulo,
    tipo_campo: c.tipo_campo,
    opcoesTexto: c.opcoes?.join(', ') ?? '',
    obrigatorio: c.obrigatorio,
    limiteDiasRetroativosTexto: c.limite_dias_retroativos === null ? '' : String(c.limite_dias_retroativos),
    // Copiado de outro formulário: a condição aponta pra pergunta de lá, que pode nem existir aqui.
    depende_de_chave: manterCondicao ? c.depende_de_chave : null,
    depende_de_valor: manterCondicao ? c.depende_de_valor : null,
    sortimento_origem: c.sortimento_origem,
    sortimento_tipo_vinculo: c.sortimento_tipo_vinculo,
    sortimento_secao_uuid: c.sortimento_secao?.id ?? null,
    sortimento_departamento_uuid: c.sortimento_departamento?.id ?? null,
    sortimento_marca_uuid: c.sortimento_marca?.id ?? null,
    sortimento_produtos: c.sortimento_produtos.map((p) => ({ uuid: p.id, descricao: p.descricao })),
    confirmar_ruptura_ausentes: c.confirmar_ruptura_ausentes,
  };
}

export function formDoTipo(tipo: TipoRegistro): FormData {
  return {
    descricao: tipo.descricao,
    icone: tipo.icone,
    exige_foto: tipo.exige_foto,
    permite_vincular_catalogo: tipo.permite_vincular_catalogo,
    ativo: tipo.ativo,
    acao_obrigatoria: tipo.acao_obrigatoria,
    escopo_acao: tipo.escopo_acao,
    campanha_auditoria_uuid: tipo.campanha_auditoria_uuid,
    pontos_venda_escopo: tipo.pontos_venda_escopo ?? [],
    redes_lojas_uuids: tipo.redes_lojas_uuids ?? [],
    granularidade_padrao: tipo.granularidade_padrao,
    produtos_predefinidos: (tipo.produtos_predefinidos ?? []).map((p) => ({ uuid: p.id, descricao: p.descricao })),
    excecoes_granularidade: tipo.excecoes_granularidade.map((e) => ({ secao_uuid: e.secao_uuid, granularidade: e.granularidade })),
    eh_ruptura: tipo.eh_ruptura,
    eh_alerta: tipo.eh_alerta,
    usa_pontuacao: tipo.usa_pontuacao,
    disponivel_registro_livre: tipo.disponivel_registro_livre,
    campos: tipo.campos.map((c) => campoDaApi(c, true)),
  };
}

export function payloadDoForm(d: FormData): TipoRegistroPayload {
  return {
    descricao: d.descricao,
    icone: d.icone,
    exige_foto: d.exige_foto,
    permite_vincular_catalogo: d.permite_vincular_catalogo,
    acao_obrigatoria: d.acao_obrigatoria,
    escopo_acao: d.acao_obrigatoria ? d.escopo_acao : null,
    campanha_auditoria_uuid: d.acao_obrigatoria && d.escopo_acao === 'CAMPANHA' ? d.campanha_auditoria_uuid : null,
    pontos_venda_uuids: d.acao_obrigatoria && d.escopo_acao === 'LOJA_REDE' ? d.pontos_venda_escopo.map((p) => p.id) : [],
    redes_lojas_uuids: d.acao_obrigatoria && d.escopo_acao === 'LOJA_REDE' ? d.redes_lojas_uuids : [],
    granularidade_padrao: d.granularidade_padrao,
    produtos_uuids: d.granularidade_padrao === 'PRODUTO' ? d.produtos_predefinidos.map((p) => p.uuid) : [],
    excecoes_granularidade: d.excecoes_granularidade,
    eh_ruptura: d.eh_ruptura,
    eh_alerta: d.eh_alerta,
    usa_pontuacao: d.usa_pontuacao,
    disponivel_registro_livre: d.disponivel_registro_livre,
    campos: d.campos.map((c) => ({
      chave: c.chave,
      rotulo: c.rotulo,
      tipo_campo: c.tipo_campo,
      obrigatorio: c.obrigatorio,
      limite_dias_retroativos: c.tipo_campo === 'DATA' && c.limiteDiasRetroativosTexto !== '' ? Number(c.limiteDiasRetroativosTexto) : null,
      opcoes: c.tipo_campo === 'MULTIPLA_ESCOLHA' ? opcoesDoTexto(c.opcoesTexto) : undefined,
      depende_de_chave: c.depende_de_chave,
      depende_de_valor: c.depende_de_chave ? c.depende_de_valor : null,
      sortimento_origem: c.tipo_campo === 'SORTIMENTO' ? c.sortimento_origem : null,
      sortimento_tipo_vinculo: c.tipo_campo === 'SORTIMENTO' && c.sortimento_origem === 'DINAMICO' ? c.sortimento_tipo_vinculo : null,
      sortimento_secao_uuid: c.sortimento_tipo_vinculo === 'SECAO' ? c.sortimento_secao_uuid : null,
      sortimento_departamento_uuid: c.sortimento_tipo_vinculo === 'DEPARTAMENTO' ? c.sortimento_departamento_uuid : null,
      sortimento_marca_uuid: c.sortimento_tipo_vinculo === 'MARCA' ? c.sortimento_marca_uuid : null,
      sortimento_produtos_uuids:
        c.tipo_campo === 'SORTIMENTO' && c.sortimento_origem === 'FIXO' ? c.sortimento_produtos.map((p) => p.uuid) : undefined,
      confirmar_ruptura_ausentes: c.tipo_campo === 'SORTIMENTO' ? c.confirmar_ruptura_ausentes : false,
    })),
  } as TipoRegistroPayload;
}

export function opcoesDoTexto(texto: string): string[] {
  return texto
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// ---- "Quando o promotor vê este formulário?" (seção 2) ⇄ acao_obrigatoria/escopo/registro livre ----

export type QuandoAparece = 'LIVRE' | 'SO_CAMPANHAS' | 'SEMPRE' | 'LOJA_REDE' | 'CAMPANHA' | 'CONTRATO';

export function quandoAparece(d: Pick<FormData, 'acao_obrigatoria' | 'escopo_acao' | 'disponivel_registro_livre'>): QuandoAparece {
  if (d.acao_obrigatoria && d.escopo_acao) return d.escopo_acao;
  return d.disponivel_registro_livre ? 'LIVRE' : 'SO_CAMPANHAS';
}

/** Campos a gravar ao escolher uma opção. Nas obrigatórias, "também no Registro geral" fica como estava. */
export function camposDoQuandoAparece(
  opcao: QuandoAparece,
  registroLivreAtual: boolean,
): Pick<FormData, 'acao_obrigatoria' | 'escopo_acao' | 'disponivel_registro_livre'> {
  if (opcao === 'LIVRE') return { acao_obrigatoria: false, escopo_acao: null, disponivel_registro_livre: true };
  if (opcao === 'SO_CAMPANHAS') return { acao_obrigatoria: false, escopo_acao: null, disponivel_registro_livre: false };
  return { acao_obrigatoria: true, escopo_acao: opcao, disponivel_registro_livre: registroLivreAtual };
}

// ---- "Sobre o que o promotor responde?" (seção 3) ⇄ granularidade/vínculo ----

export type SobreOQue = 'VISITA' | 'PRODUTO' | 'LINHA' | 'PROMOTOR_DECIDE';

export function sobreOQue(d: Pick<FormData, 'granularidade_padrao' | 'permite_vincular_catalogo'>): SobreOQue {
  if (d.granularidade_padrao === 'PRODUTO') return 'PRODUTO';
  if (d.granularidade_padrao === 'LINHA') return 'LINHA';
  return d.permite_vincular_catalogo ? 'PROMOTOR_DECIDE' : 'VISITA';
}

export function camposDoSobreOQue(opcao: SobreOQue): Pick<FormData, 'granularidade_padrao' | 'permite_vincular_catalogo'> {
  switch (opcao) {
    case 'VISITA':
      return { granularidade_padrao: null, permite_vincular_catalogo: false };
    case 'PROMOTOR_DECIDE':
      return { granularidade_padrao: null, permite_vincular_catalogo: true };
    case 'LINHA':
      return { granularidade_padrao: 'LINHA', permite_vincular_catalogo: true };
    case 'PRODUTO':
      return { granularidade_padrao: 'PRODUTO', permite_vincular_catalogo: true };
  }
}

// ---- Perguntas ----

export const TIPOS_RESPOSTA: { valor: TipoCampoRegistro; rotulo: string; sigla: string; cor: string }[] = [
  { valor: 'BOOLEANO', rotulo: 'Sim / Não', sigla: 'S/N', cor: '#6d28d9' },
  { valor: 'NUMERO', rotulo: 'Número', sigla: '123', cor: '#1d4ed8' },
  { valor: 'MOEDA', rotulo: 'Valor (R$)', sigla: 'R$', cor: '#c2410c' },
  { valor: 'TEXTO', rotulo: 'Texto', sigla: 'Aa', cor: '#374151' },
  { valor: 'DATA', rotulo: 'Data', sigla: '31', cor: '#be123c' },
  { valor: 'MULTIPLA_ESCOLHA', rotulo: 'Múltipla escolha', sigla: '≡', cor: '#0f766e' },
  { valor: 'SORTIMENTO', rotulo: 'Checklist de produtos', sigla: '✓', cor: '#15803d' },
];

export function tipoResposta(valor: TipoCampoRegistro) {
  return TIPOS_RESPOSTA.find((t) => t.valor === valor) ?? TIPOS_RESPOSTA[0];
}

/** "Preço atual" → "preco_atual", sem colidir com as chaves já usadas no formulário. */
export function gerarChave(rotulo: string, usadas: ReadonlySet<string>): string {
  const base =
    rotulo
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'pergunta';
  let chave = base;
  let n = 2;
  while (usadas.has(chave)) chave = `${base}_${n++}`;
  return chave;
}

/** Nova ordem respeita "condicional sempre depois da pergunta de que depende"? Devolve o problema ou null. */
export function problemaDeOrdem(campos: Pick<CampoForm, 'chave' | 'rotulo' | 'depende_de_chave'>[]): string | null {
  for (let i = 0; i < campos.length; i++) {
    const c = campos[i];
    if (!c.depende_de_chave) continue;
    const pai = campos.findIndex((p) => p.chave === c.depende_de_chave);
    if (pai > i) {
      return `"${c.rotulo || c.chave}" só aparece conforme a resposta de "${campos[pai].rotulo || campos[pai].chave}" — precisa ficar depois dela.`;
    }
  }
  return null;
}

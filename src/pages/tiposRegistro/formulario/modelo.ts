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
  tipo_campo: z.enum(['NUMERO', 'TEXTO', 'MOEDA', 'MULTIPLA_ESCOLHA', 'BOOLEANO', 'DATA', 'SORTIMENTO', 'FOTO']),
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
  // Mix segue a marca/departamento/seção que o promotor escolhe no registro (docs/79).
  sortimento_segue_escolha: z.boolean(),
  confirmar_ruptura_ausentes: z.boolean(),
  // Pergunta FOTO (docs/98): quantidade (texto vazio = sem limite), reaproveitamento e dica.
  fotoMinTexto: z.string().refine((v) => v === '' || /^\d+$/.test(v), 'Use um número inteiro.'),
  fotoMaxTexto: z.string().refine((v) => v === '' || /^[1-9]\d*$/.test(v), 'Use 1 ou mais.'),
  foto_reaproveitar: z.enum(['NAO', 'VISITA', 'HISTORICO']),
  foto_dica: z.string().max(255, 'No máximo 255 caracteres.'),
}).refine((c) => c.tipo_campo !== 'FOTO' || c.fotoMinTexto === '' || c.fotoMaxTexto === '' || Number(c.fotoMinTexto) <= Number(c.fotoMaxTexto), {
  message: 'O máximo não pode ser menor que o mínimo.',
  path: ['fotoMaxTexto'],
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
    escopo_acao: z.enum(['SEMPRE', 'CAMPANHA', 'CONTRATO', 'LOJA_REDE', 'LINHA_AUSENTE']).nullable(),
    // Escopo LINHA_AUSENTE (docs/80 §5.1): seção (padrão), departamento ou marca.
    escopo_tipo_vinculo: z.enum(['SECAO', 'DEPARTAMENTO', 'MARCA']).nullable(),
    escopo_secao_uuid: z.string().nullable(),
    escopo_departamento_uuid: z.string().nullable(),
    escopo_marca_uuid: z.string().nullable(),
    // Filtro da Ação por ramo de atividade (docs/80 §5.4) — vazio = todos.
    ramos_atividade_uuids: z.array(z.string()),
    // Intervalo entre cobranças da Ação (docs/80 §5.2) — 0 = toda visita.
    intervalo_dias: z.number().int('Use um número inteiro de dias.').min(0, 'Use 0 ou mais dias.').max(3650, 'No máximo 3650 dias.'),
    campanha_auditoria_uuid: z.string().nullable(),
    pontos_venda_escopo: z.array(z.object({ id: z.string(), fantasia: z.string() })),
    redes_lojas_uuids: z.array(z.string()),
    granularidade_padrao: z.enum(['LINHA', 'PRODUTO', 'MARCA']).nullable(),
    escolhe_marca: z.boolean(),
    escolhe_departamento: z.boolean(),
    escolhe_secao: z.boolean(),
    // docs/82: só valem com a opção "o promotor escolhe".
    lista_recorte: z.enum(['PRIMEIRO_DA_LOJA', 'SO_DA_LOJA']),
    filtra_marca: z.boolean(),
    // Botão "Produto em ruptura" no registro do app (padrão ligado).
    permite_ruptura: z.boolean(),
    // Área de foto livre no app (docs/98): desligada, só as perguntas FOTO.
    permite_foto_livre: z.boolean(),
    // "Ainda está lá?" (docs/83 §3.1).
    acompanha: z.boolean(),
    acompanha_gatilho_chave: z.string().nullable(),
    acompanha_gatilho_valor: z.string().nullable(),
    acompanha_intervalo_dias: z.number().int('Use um número inteiro de dias.').min(0, 'Use 0 ou mais dias.').max(365, 'No máximo 365 dias.'),
    acompanha_rotulo_continua: z.string().max(60, 'No máximo 60 caracteres.'),
    acompanha_rotulo_acabou: z.string().max(60, 'No máximo 60 caracteres.'),
    acompanha_ao_continuar: z.enum(['CONFIRMA', 'FORMULARIO_PREENCHIDO', 'FORMULARIO_CEGO']),
    acompanha_formulario_acabou: z.object({ id: z.string(), descricao: z.string() }).nullable(),
    acompanha_prazo_dias: z.number().int().min(1, 'Use 1 ou mais dias.').max(3650).nullable(),
    produtos_predefinidos: z.array(z.object({ uuid: z.string(), descricao: z.string() })),
    // "Cada produto": lista fixa (a de cima) ou o Mix da loja, só nossos produtos (docs/85 §7).
    lista_produtos_origem: z.enum(['FIXA', 'MIX_LOJA']),
    // "Cada marca concorrente" (docs/85 §3.1).
    marcas_predefinidas: z.array(z.object({ uuid: z.string(), descricao: z.string(), a_aprovar: z.boolean() })),
    permite_marca_nova: z.boolean(),
    varias_embalagens: z.boolean(),
    excecoes_granularidade: z.array(excecaoGranularidadeSchema),
    eh_ruptura: z.boolean(),
    eh_alerta: z.boolean(),
    usa_pontuacao: z.boolean(),
    // Régua de XP (docs/88 §9.1) e avaliação do gestor (doc 33).
    xp_iniciativa: z.number().int().min(0, 'Use 0 ou mais.').max(10000),
    xp_bonus_acao: z.number().int().min(0, 'Use 0 ou mais.').max(10000),
    xp_teto_por_visita: z.number().int().min(1, 'Use 1 ou mais (vazio = sem teto).').max(1000).nullable(),
    xp_intervalo_dias: z.number().int().min(0, 'Use 0 ou mais dias.').max(365),
    exige_avaliacao: z.boolean(),
    disponivel_registro_livre: z.boolean(),
    campos: z.array(campoSchema),
  })
  // docs/83: com o acompanhamento ligado, os dois botões precisam de texto; o gatilho, de resposta.
  .refine((d) => !d.acompanha || (d.acompanha_rotulo_continua.trim() !== '' && d.acompanha_rotulo_acabou.trim() !== ''), {
    message: 'Escreva o texto dos dois botões do acompanhamento.',
    path: ['acompanha_rotulo_continua'],
  })
  .refine((d) => !d.acompanha || !d.acompanha_gatilho_chave || !!d.acompanha_gatilho_valor, {
    message: 'Escolha a resposta que dispara o acompanhamento.',
    path: ['acompanha_gatilho_valor'],
  })
  // docs/85: por marca, precisa de marca na lista ou deixar o promotor cadastrar.
  .refine((d) => d.granularidade_padrao !== 'MARCA' || d.marcas_predefinidas.length > 0 || d.permite_marca_nova, {
    message: 'Escolha as marcas da lista ou deixe o promotor cadastrar marca nova.',
    path: ['marcas_predefinidas'],
  })
  .refine((d) => !d.acao_obrigatoria || d.escopo_acao !== null, {
    message: 'Escolha quando essa pendência aparece.',
    path: ['escopo_acao'],
  })
  .refine(
    (d) =>
      !d.acao_obrigatoria ||
      d.escopo_acao !== 'LINHA_AUSENTE' ||
      (d.escopo_tipo_vinculo === 'SECAO' && !!d.escopo_secao_uuid) ||
      (d.escopo_tipo_vinculo === 'DEPARTAMENTO' && !!d.escopo_departamento_uuid) ||
      (d.escopo_tipo_vinculo === 'MARCA' && !!d.escopo_marca_uuid),
    { message: 'Escolha a linha que não pode estar no Mix.', path: ['escopo_tipo_vinculo'] },
  )
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
        if (c.sortimento_origem !== 'DINAMICO' || c.sortimento_segue_escolha) return true;
        if (c.sortimento_tipo_vinculo === 'SECAO') return !!c.sortimento_secao_uuid;
        if (c.sortimento_tipo_vinculo === 'DEPARTAMENTO') return !!c.sortimento_departamento_uuid;
        if (c.sortimento_tipo_vinculo === 'MARCA') return !!c.sortimento_marca_uuid;
        return false;
      }),
    { message: 'Checklist pelo mix da loja: escolha a seção, o departamento ou a marca.', path: ['campos'] },
  )
  .refine((d) => !d.campos.some((c) => c.sortimento_segue_escolha) || temEscolhaDeRecorte(d), {
    message: 'Checklist "o que o promotor escolher": no passo 3, deixe o promotor escolher marca, departamento ou seção.',
    path: ['campos'],
  })
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
  escopo_tipo_vinculo: null,
  escopo_secao_uuid: null,
  escopo_departamento_uuid: null,
  escopo_marca_uuid: null,
  ramos_atividade_uuids: [],
  intervalo_dias: 0,
  campanha_auditoria_uuid: null,
  pontos_venda_escopo: [],
  redes_lojas_uuids: [],
  granularidade_padrao: null,
  escolhe_marca: false,
  escolhe_departamento: false,
  escolhe_secao: false,
  lista_recorte: 'PRIMEIRO_DA_LOJA',
  filtra_marca: false,
  permite_ruptura: true,
  permite_foto_livre: true,
  acompanha: false,
  acompanha_gatilho_chave: null,
  acompanha_gatilho_valor: null,
  acompanha_intervalo_dias: 0,
  acompanha_rotulo_continua: '',
  acompanha_rotulo_acabou: '',
  acompanha_ao_continuar: 'CONFIRMA',
  acompanha_formulario_acabou: null,
  acompanha_prazo_dias: null,
  produtos_predefinidos: [],
  lista_produtos_origem: 'FIXA',
  marcas_predefinidas: [],
  permite_marca_nova: true,
  varias_embalagens: true,
  excecoes_granularidade: [],
  eh_ruptura: false,
  eh_alerta: false,
  usa_pontuacao: false,
  xp_iniciativa: 0,
  xp_bonus_acao: 0,
  xp_teto_por_visita: null,
  xp_intervalo_dias: 0,
  exige_avaliacao: false,
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
    sortimento_segue_escolha: false,
    confirmar_ruptura_ausentes: false,
    fotoMinTexto: '',
    fotoMaxTexto: '',
    foto_reaproveitar: 'NAO',
    foto_dica: '',
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
    sortimento_segue_escolha: c.sortimento_segue_escolha ?? false,
    confirmar_ruptura_ausentes: c.confirmar_ruptura_ausentes,
    fotoMinTexto: c.foto_min ? String(c.foto_min) : '',
    fotoMaxTexto: c.foto_max ? String(c.foto_max) : '',
    foto_reaproveitar: c.foto_reaproveitar ?? 'NAO',
    foto_dica: c.foto_dica ?? '',
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
    escopo_tipo_vinculo: tipo.escopo_tipo_vinculo ?? null,
    escopo_secao_uuid: tipo.escopo_secao?.id ?? null,
    escopo_departamento_uuid: tipo.escopo_departamento?.id ?? null,
    escopo_marca_uuid: tipo.escopo_marca?.id ?? null,
    ramos_atividade_uuids: tipo.ramos_atividade_uuids ?? [],
    intervalo_dias: tipo.intervalo_dias ?? 0,
    campanha_auditoria_uuid: tipo.campanha_auditoria_uuid,
    pontos_venda_escopo: tipo.pontos_venda_escopo ?? [],
    redes_lojas_uuids: tipo.redes_lojas_uuids ?? [],
    granularidade_padrao: tipo.granularidade_padrao,
    escolhe_marca: tipo.escolhe_marca ?? false,
    escolhe_departamento: tipo.escolhe_departamento ?? false,
    escolhe_secao: tipo.escolhe_secao ?? false,
    lista_recorte: tipo.lista_recorte ?? 'PRIMEIRO_DA_LOJA',
    filtra_marca: tipo.filtra_marca ?? false,
    permite_ruptura: tipo.permite_ruptura ?? true,
    permite_foto_livre: tipo.permite_foto_livre ?? true,
    acompanha: tipo.acompanha ?? false,
    acompanha_gatilho_chave: tipo.acompanha_gatilho_chave ?? null,
    acompanha_gatilho_valor: tipo.acompanha_gatilho_valor ?? null,
    acompanha_intervalo_dias: tipo.acompanha_intervalo_dias ?? 0,
    acompanha_rotulo_continua: tipo.acompanha_rotulo_continua ?? '',
    acompanha_rotulo_acabou: tipo.acompanha_rotulo_acabou ?? '',
    acompanha_ao_continuar: tipo.acompanha_ao_continuar ?? 'CONFIRMA',
    acompanha_formulario_acabou: tipo.acompanha_formulario_acabou ?? null,
    acompanha_prazo_dias: tipo.acompanha_prazo_dias ?? null,
    produtos_predefinidos: (tipo.produtos_predefinidos ?? []).map((p) => ({ uuid: p.id, descricao: p.descricao })),
    lista_produtos_origem: tipo.lista_produtos_origem ?? 'FIXA',
    marcas_predefinidas: (tipo.marcas_predefinidas ?? []).map((m) => ({ uuid: m.id, descricao: m.descricao, a_aprovar: m.a_aprovar })),
    permite_marca_nova: tipo.permite_marca_nova ?? true,
    varias_embalagens: tipo.varias_embalagens ?? true,
    // Exceção por seção nunca é MARCA (o servidor recusa) — filtra por garantia.
    excecoes_granularidade: tipo.excecoes_granularidade
      .filter((e) => e.granularidade !== 'MARCA')
      .map((e) => ({ secao_uuid: e.secao_uuid, granularidade: e.granularidade as 'LINHA' | 'PRODUTO' })),
    eh_ruptura: tipo.eh_ruptura,
    eh_alerta: tipo.eh_alerta,
    usa_pontuacao: tipo.usa_pontuacao,
    xp_iniciativa: tipo.xp_iniciativa ?? 0,
    xp_bonus_acao: tipo.xp_bonus_acao ?? 0,
    xp_teto_por_visita: tipo.xp_teto_por_visita ?? null,
    xp_intervalo_dias: tipo.xp_intervalo_dias ?? 0,
    exige_avaliacao: tipo.exige_avaliacao ?? false,
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
    escopo_tipo_vinculo: linhaAusente(d) ? d.escopo_tipo_vinculo : null,
    escopo_secao_uuid: linhaAusente(d) && d.escopo_tipo_vinculo === 'SECAO' ? d.escopo_secao_uuid : null,
    escopo_departamento_uuid: linhaAusente(d) && d.escopo_tipo_vinculo === 'DEPARTAMENTO' ? d.escopo_departamento_uuid : null,
    escopo_marca_uuid: linhaAusente(d) && d.escopo_tipo_vinculo === 'MARCA' ? d.escopo_marca_uuid : null,
    ramos_atividade_uuids: d.acao_obrigatoria ? d.ramos_atividade_uuids : [],
    intervalo_dias: d.acao_obrigatoria ? d.intervalo_dias : 0,
    campanha_auditoria_uuid: d.acao_obrigatoria && d.escopo_acao === 'CAMPANHA' ? d.campanha_auditoria_uuid : null,
    pontos_venda_uuids: d.acao_obrigatoria && d.escopo_acao === 'LOJA_REDE' ? d.pontos_venda_escopo.map((p) => p.id) : [],
    redes_lojas_uuids: d.acao_obrigatoria && d.escopo_acao === 'LOJA_REDE' ? d.redes_lojas_uuids : [],
    granularidade_padrao: d.granularidade_padrao,
    escolhe_marca: d.escolhe_marca,
    escolhe_departamento: d.escolhe_departamento,
    escolhe_secao: d.escolhe_secao,
    lista_recorte: temEscolhaDeRecorte(d) ? d.lista_recorte : 'PRIMEIRO_DA_LOJA',
    // O filtro de marca é "depois da seção/departamento": sem nenhum dos dois, não vale.
    filtra_marca: temEscolhaDeRecorte(d) && (d.escolhe_departamento || d.escolhe_secao) && d.filtra_marca,
    permite_ruptura: d.permite_ruptura,
    permite_foto_livre: d.permite_foto_livre,
    // docs/83: desligado, a configuração vai limpa (o servidor também ignora sem `acompanha`).
    acompanha: d.acompanha,
    acompanha_gatilho_chave: d.acompanha && d.acompanha_gatilho_chave ? d.acompanha_gatilho_chave : null,
    acompanha_gatilho_valor: d.acompanha && d.acompanha_gatilho_chave ? d.acompanha_gatilho_valor : null,
    acompanha_intervalo_dias: d.acompanha_intervalo_dias,
    acompanha_rotulo_continua: d.acompanha_rotulo_continua.trim() || null,
    acompanha_rotulo_acabou: d.acompanha_rotulo_acabou.trim() || null,
    acompanha_ao_continuar: d.acompanha_ao_continuar,
    acompanha_formulario_acabou_uuid: d.acompanha ? (d.acompanha_formulario_acabou?.id ?? null) : null,
    acompanha_prazo_dias: d.acompanha ? d.acompanha_prazo_dias : null,
    produtos_uuids: d.granularidade_padrao === 'PRODUTO' && d.lista_produtos_origem === 'FIXA' ? d.produtos_predefinidos.map((p) => p.uuid) : [],
    lista_produtos_origem: d.granularidade_padrao === 'PRODUTO' ? d.lista_produtos_origem : 'FIXA',
    marcas_uuids: d.granularidade_padrao === 'MARCA' ? d.marcas_predefinidas.map((m) => m.uuid) : [],
    permite_marca_nova: d.permite_marca_nova,
    varias_embalagens: d.varias_embalagens,
    excecoes_granularidade: d.excecoes_granularidade,
    eh_ruptura: d.eh_ruptura,
    eh_alerta: d.eh_alerta,
    usa_pontuacao: d.usa_pontuacao,
    xp_iniciativa: d.xp_iniciativa,
    xp_bonus_acao: d.xp_bonus_acao,
    xp_teto_por_visita: d.xp_teto_por_visita,
    xp_intervalo_dias: d.xp_intervalo_dias,
    exige_avaliacao: d.exige_avaliacao,
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
      sortimento_tipo_vinculo: mixRecorteFixo(c) ? c.sortimento_tipo_vinculo : null,
      sortimento_secao_uuid: mixRecorteFixo(c) && c.sortimento_tipo_vinculo === 'SECAO' ? c.sortimento_secao_uuid : null,
      sortimento_departamento_uuid: mixRecorteFixo(c) && c.sortimento_tipo_vinculo === 'DEPARTAMENTO' ? c.sortimento_departamento_uuid : null,
      sortimento_marca_uuid: mixRecorteFixo(c) && c.sortimento_tipo_vinculo === 'MARCA' ? c.sortimento_marca_uuid : null,
      sortimento_segue_escolha: c.tipo_campo === 'SORTIMENTO' && c.sortimento_origem === 'DINAMICO' && c.sortimento_segue_escolha,
      sortimento_produtos_uuids:
        c.tipo_campo === 'SORTIMENTO' && c.sortimento_origem === 'FIXO' ? c.sortimento_produtos.map((p) => p.uuid) : undefined,
      confirmar_ruptura_ausentes: c.tipo_campo === 'SORTIMENTO' ? c.confirmar_ruptura_ausentes : false,
      ...(c.tipo_campo === 'FOTO'
        ? {
            foto_min: c.fotoMinTexto === '' ? null : Number(c.fotoMinTexto),
            foto_max: c.fotoMaxTexto === '' ? null : Number(c.fotoMaxTexto),
            foto_reaproveitar: c.foto_reaproveitar,
            foto_dica: c.foto_dica.trim() || null,
          }
        : {}),
    })),
  } as TipoRegistroPayload;
}

function linhaAusente(d: Pick<FormData, 'acao_obrigatoria' | 'escopo_acao'>): boolean {
  return d.acao_obrigatoria && d.escopo_acao === 'LINHA_AUSENTE';
}

/** Mix dinâmico com seção/departamento/marca fixos no cadastro (não segue a escolha do promotor). */
function mixRecorteFixo(c: CampoForm): boolean {
  return c.tipo_campo === 'SORTIMENTO' && c.sortimento_origem === 'DINAMICO' && !c.sortimento_segue_escolha;
}

// Tipo explícito (não Pick<FormData>): o schema usa esta função, e FormData vem do schema.
export function temEscolhaDeRecorte(d: { escolhe_marca: boolean; escolhe_departamento: boolean; escolhe_secao: boolean }): boolean {
  return d.escolhe_marca || d.escolhe_departamento || d.escolhe_secao;
}

export function opcoesDoTexto(texto: string): string[] {
  return texto
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

// ---- "Quando o promotor vê este formulário?" (seção 2) ⇄ acao_obrigatoria/escopo/registro livre ----

export type QuandoAparece = 'LIVRE' | 'SO_CAMPANHAS' | 'SEMPRE' | 'LOJA_REDE' | 'CAMPANHA' | 'CONTRATO' | 'LINHA_AUSENTE';

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

export type SobreOQue = 'VISITA' | 'PRODUTO' | 'LINHA' | 'PROMOTOR_DECIDE' | 'PROMOTOR_ESCOLHE_RECORTE' | 'MARCA';

type CamposSobreOQue = Pick<
  FormData,
  'granularidade_padrao' | 'permite_vincular_catalogo' | 'escolhe_marca' | 'escolhe_departamento' | 'escolhe_secao'
>;

export function sobreOQue(d: CamposSobreOQue): SobreOQue {
  // Escolha de recorte (docs/79) sempre grava LINHA — por isso vem antes da checagem de LINHA.
  if (temEscolhaDeRecorte(d)) return 'PROMOTOR_ESCOLHE_RECORTE';
  if (d.granularidade_padrao === 'MARCA') return 'MARCA';
  if (d.granularidade_padrao === 'PRODUTO') return 'PRODUTO';
  if (d.granularidade_padrao === 'LINHA') return 'LINHA';
  return d.permite_vincular_catalogo ? 'PROMOTOR_DECIDE' : 'VISITA';
}

const SEM_ESCOLHA = { escolhe_marca: false, escolhe_departamento: false, escolhe_secao: false };

export function camposDoSobreOQue(opcao: SobreOQue): CamposSobreOQue {
  switch (opcao) {
    case 'VISITA':
      return { granularidade_padrao: null, permite_vincular_catalogo: false, ...SEM_ESCOLHA };
    case 'PROMOTOR_DECIDE':
      return { granularidade_padrao: null, permite_vincular_catalogo: true, ...SEM_ESCOLHA };
    case 'LINHA':
      return { granularidade_padrao: 'LINHA', permite_vincular_catalogo: true, ...SEM_ESCOLHA };
    case 'PRODUTO':
      return { granularidade_padrao: 'PRODUTO', permite_vincular_catalogo: true, ...SEM_ESCOLHA };
    case 'MARCA':
      // A marca e a embalagem já são o vínculo (docs/85) — sem "Vincular a" solto.
      return { granularidade_padrao: 'MARCA', permite_vincular_catalogo: false, ...SEM_ESCOLHA };
    case 'PROMOTOR_ESCOLHE_RECORTE':
      // Começa com departamento e seção marcados — o caso do Ponto Extra (docs/79 §1).
      return {
        granularidade_padrao: 'LINHA',
        permite_vincular_catalogo: true,
        escolhe_marca: false,
        escolhe_departamento: true,
        escolhe_secao: true,
      };
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
  // Foto nomeada (docs/98): "Antes", "Depois", "Etiqueta de preço"...
  { valor: 'FOTO', rotulo: 'Foto', sigla: 'Ft', cor: '#0369a1' },
];

// Pergunta FOTO: de onde a foto pode vir além da câmera (docs/98 §9.1). A galeria do celular nunca.
export const OPCOES_REAPROVEITAR_FOTO: { valor: 'NAO' | 'VISITA' | 'HISTORICO'; rotulo: string; ajuda: string }[] = [
  { valor: 'NAO', rotulo: 'Só tirar agora', ajuda: 'O promotor tira a foto na hora, pela câmera do app.' },
  { valor: 'VISITA', rotulo: 'Ou usar foto desta visita', ajuda: 'Pode escolher uma foto que já tirou nesta visita (ex.: o "antes" feito no começo).' },
  {
    valor: 'HISTORICO',
    rotulo: 'Ou usar foto desta visita ou de visitas anteriores',
    ajuda: 'Também mostra as fotos tiradas nesta loja em visitas anteriores (ex.: o "antes" da semana passada).',
  },
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

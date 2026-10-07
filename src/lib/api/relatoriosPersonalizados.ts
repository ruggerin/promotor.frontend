import { apiClient } from './client';
import type { TipoComparativo } from './relatorios';

// Gerador de relatórios (docs/60-GERADOR-DE-RELATORIOS.md §5). O front só monta/mostra: quem
// calcula (inclusive o comparativo) é o backend.

export type EntidadeRelatorio = 'ordem_servico' | 'visita' | 'registro';
export type PresetPeriodo =
  | 'hoje'
  | 'ultimos_7_dias'
  | 'ultimos_30_dias'
  | 'mes_atual'
  | 'mes_anterior'
  | 'trimestre_atual'
  | 'ultimos_12_meses'
  | 'ano_atual'
  | 'ano_anterior';
export type FormatoMetrica = 'inteiro' | 'percentual' | 'minutos' | 'decimal' | 'moeda' | 'texto' | 'distribuicao';
export type Granularidade = 'ano' | 'trimestre' | 'mes' | 'semana' | 'dia' | 'mes_do_ano' | 'dia_da_semana';
export type Visual = 'tabela' | 'barra' | 'linha' | 'pizza';
export type Operador = 'em' | 'nao_em' | 'igual' | 'vazio' | 'nao_vazio';

export interface DefinicaoRelatorio {
  entidade: EntidadeRelatorio;
  // Só em `registro`: uuid do formulário cujas perguntas viram campos e métricas.
  formulario?: string;
  periodo: { campo?: string; preset?: PresetPeriodo; inicio?: string; fim?: string };
  filtros: { combinador: 'E' | 'OU'; regras: { campo: string; operador: Operador; valor?: unknown }[] };
  // eixo: 'coluna' vira coluna da matriz (pivot); sem eixo = linha. `chave` (devolvida pelo backend) é
  // o nome da dimensão no resultado — "campo:granularidade" quando a mesma data entra duas vezes.
  agrupar: { campo: string; granularidade?: Granularidade; eixo?: 'linha' | 'coluna'; chave?: string }[];
  metricas: { chave: string }[];
  comparar: TipoComparativo | null;
  ordenar?: { chave: string; direcao?: 'asc' | 'desc' };
  visual?: Visual;
}

export type RegraDefinicao = DefinicaoRelatorio['filtros']['regras'][number];

export interface CampoCatalogo {
  chave: string;
  rotulo: string;
  tipo: 'enum' | 'relacao' | 'booleano' | 'data';
  operadores: Operador[];
  agrupavel: boolean;
  periodo: boolean;
  opcoes?: { valor: string; rotulo: string }[];
  fonte?: string;
  granularidades?: Granularidade[];
  /** Ex.: "Perguntas do formulário" — o editor separa a lista por grupo. */
  grupo?: string;
}

export interface MetricaCatalogo {
  chave: string;
  rotulo: string;
  formato: FormatoMetrica;
  descricao?: string;
  grupo?: string;
  /** Agregação de um campo (ex.: contagem distinta da Loja): o editor mostra o campo e a operação vai no chip. */
  campo?: string;
  campo_rotulo?: string;
  agregacao?: Agregacao;
}

export type Agregacao = 'contagem' | 'contagem_distinta' | 'moda' | 'soma' | 'media' | 'minimo' | 'maximo' | 'percentual_sim';

export interface CatalogoEntidade {
  chave: EntidadeRelatorio;
  rotulo: string;
  campo_periodo_padrao: string;
  campos: CampoCatalogo[];
  metricas: MetricaCatalogo[];
  presets: PresetPeriodo[];
}

export interface RelatorioPersonalizado {
  id: string;
  nome: string;
  descricao: string | null;
  entidade: EntidadeRelatorio;
  definicao: DefinicaoRelatorio;
  compartilhado: boolean;
  padrao: boolean;
  chave: string | null;
  criador?: { id: string; nome: string } | null;
  pode_editar: boolean;
  /** docs/63 §1.7 — no menu de todos (empresa) e no meu. `fixado_meu` só vem na listagem e ao fixar. */
  fixado_empresa: boolean;
  fixado_meu?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ItemDistribuicao {
  chave: string;
  rotulo: string;
  quantidade: number;
}

// Texto: a moda de um campo ("Loja A").
export type ValorMetrica = number | string | null | ItemDistribuicao[];

export interface ColunaResultado {
  chave: string;
  rotulo: string;
  tipo: 'dimensao' | FormatoMetrica;
}

export interface ResultadoRelatorio {
  periodo: { data_inicio: string; data_fim: string; fuso: string };
  colunas: ColunaResultado[];
  linhas: { dimensoes: Record<string, { chave: string; rotulo: string }>; valores: Record<string, ValorMetrica> }[];
  linhas_truncadas: boolean;
  totais: Record<string, ValorMetrica>;
  definicao_resolvida: DefinicaoRelatorio;
  // Só na matriz: total de cada linha (somando as colunas) e de cada coluna.
  subtotais?: {
    linhas: ResultadoRelatorio['linhas'];
    colunas: ResultadoRelatorio['linhas'];
  };
  comparativo?: {
    tipo: TipoComparativo;
    periodo: { data_inicio: string; data_fim: string };
    totais: Record<string, ValorMetrica>;
  };
}

export interface ParametrosExecucao {
  preset?: PresetPeriodo;
  data_inicio?: string;
  data_fim?: string;
  comparar?: TipoComparativo | 'nenhum';
  /** Filtros rápidos (JSON de regras): só nesta execução, somados aos salvos com E. */
  filtros?: string;
}

export async function listarRelatoriosPersonalizados(): Promise<RelatorioPersonalizado[]> {
  const { data } = await apiClient.get<{ data: RelatorioPersonalizado[] }>('/relatorios-personalizados');
  return data.data;
}

export async function buscarRelatorioPersonalizado(id: string): Promise<RelatorioPersonalizado> {
  const { data } = await apiClient.get<{ data: RelatorioPersonalizado }>(`/relatorios-personalizados/${id}`);
  return data.data;
}

export async function executarRelatorioPersonalizado(id: string, params: ParametrosExecucao): Promise<ResultadoRelatorio> {
  const { data } = await apiClient.get<ResultadoRelatorio>(`/relatorios-personalizados/${id}/executar`, { params });
  return data;
}

export type AlcanceFixado = 'empresa' | 'meu';

export interface RelatorioFixado {
  id: string;
  nome: string;
  alcance: AlcanceFixado;
}

/** Fixados que aparecem no menu do usuário (da empresa + os meus, sem repetir) — docs/63 §1.7. */
export async function listarRelatoriosFixados(): Promise<RelatorioFixado[]> {
  const { data } = await apiClient.get<{ data: RelatorioFixado[] }>('/relatorios-personalizados/menu');
  return data.data;
}

export async function fixarRelatorioNoMenu(id: string, alcance: AlcanceFixado, fixado: boolean): Promise<RelatorioPersonalizado> {
  const { data } = await apiClient.put<{ data: RelatorioPersonalizado }>(`/relatorios-personalizados/${id}/fixar`, { alcance, fixado });
  return data.data;
}

export async function duplicarRelatorioPersonalizado(id: string): Promise<RelatorioPersonalizado> {
  const { data } = await apiClient.post<{ data: RelatorioPersonalizado }>(`/relatorios-personalizados/${id}/duplicar`);
  return data.data;
}

export async function excluirRelatorioPersonalizado(id: string): Promise<void> {
  await apiClient.delete(`/relatorios-personalizados/${id}`);
}

export async function completarRelatoriosPadraoEmpresa(uuid: string): Promise<{ criados: string[]; atualizados: string[] }> {
  const { data } = await apiClient.post<{ criados: string[]; atualizados: string[] }>(`/superadmin/empresas/${uuid}/relatorios-padrao`);
  return data;
}

export async function listarEntidadesRelatorio(): Promise<{ chave: EntidadeRelatorio; rotulo: string }[]> {
  const { data } = await apiClient.get<{ data: { chave: EntidadeRelatorio; rotulo: string }[] }>('/relatorios-personalizados/catalogo');
  return data.data;
}

export async function buscarCatalogoEntidade(entidade: EntidadeRelatorio, formulario?: string): Promise<CatalogoEntidade> {
  const { data } = await apiClient.get<{ data: CatalogoEntidade }>('/relatorios-personalizados/catalogo', {
    params: { entidade, formulario: entidade === 'registro' ? formulario || undefined : undefined },
  });
  return data.data;
}

export async function buscarOpcoesFiltro(fonte: string, filtro: { busca?: string; valores?: string[] }): Promise<{ valor: string; rotulo: string }[]> {
  const { data } = await apiClient.get<{ data: { valor: string; rotulo: string }[] }>('/relatorios-personalizados/opcoes', {
    params: { fonte, busca: filtro.busca || undefined, valores: filtro.valores?.length ? filtro.valores : undefined },
  });
  return data.data;
}

/** Pré-visualização do editor: executa a definição sem salvar. */
export async function executarDefinicao(definicao: DefinicaoRelatorio): Promise<ResultadoRelatorio> {
  const { data } = await apiClient.post<ResultadoRelatorio>('/relatorios-personalizados/executar', { definicao });
  return data;
}

export interface DadosRelatorio {
  nome: string;
  descricao: string | null;
  compartilhado: boolean;
  definicao: DefinicaoRelatorio;
}

export async function criarRelatorioPersonalizado(dados: DadosRelatorio): Promise<RelatorioPersonalizado> {
  const { data } = await apiClient.post<{ data: RelatorioPersonalizado }>('/relatorios-personalizados', dados);
  return data.data;
}

export async function atualizarRelatorioPersonalizado(id: string, dados: DadosRelatorio): Promise<RelatorioPersonalizado> {
  const { data } = await apiClient.put<{ data: RelatorioPersonalizado }>(`/relatorios-personalizados/${id}`, dados);
  return data.data;
}

import type { RelatorioColeta } from '../coletaFormulario';
import { apiClient } from './client';

// Relatórios agregados — docs/28-RELATORIOS-FEEDBACK-HISTORICO.md §2. ADMIN/GESTOR.

// Fuso do navegador — o backend guarda em UTC e precisa dele pra fechar o "dia" do gestor.
const fusoLocal = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface FiltrosRelatorio {
  data_inicio?: string;
  data_fim?: string;
  usuario_uuid?: string | null;
  ponto_venda_uuid?: string | null;
  // Comparativo de períodos (docs/59 §4.3) — o backend calcula o período equivalente.
  comparar?: TipoComparativo | null;
}

export type TipoComparativo = 'anterior' | 'ano_anterior';

export interface LinhaPlanejadoExecutado {
  data: string;
  promotor: { id: string; nome: string } | null;
  planejadas: number;
  cumpridas: number;
  em_andamento: number;
  atrasadas: number;
  a_vencer: number;
  espontaneas: number;
  canceladas: number;
  canceladas_promotor: number;
  percentual_cumprimento: number | null;
  percentual_cumprimento_ajustado: number | null;
}

export interface TotalPlanejadoExecutado {
  planejadas: number;
  cumpridas: number;
  em_andamento: number;
  atrasadas: number;
  a_vencer: number;
  espontaneas: number;
  canceladas: number;
  canceladas_promotor: number;
  percentual_cumprimento: number | null;
  // Cancelar por culpa do promotor entra no denominador (docs/59 §3.4).
  percentual_cumprimento_ajustado: number | null;
  canceladas_por_responsavel: Record<string, number>;
  canceladas_por_motivo: { motivo: string; quantidade: number }[];
}

export interface RelatorioPlanejadoExecutado {
  periodo: { data_inicio: string; data_fim: string };
  linhas: LinhaPlanejadoExecutado[];
  total: TotalPlanejadoExecutado;
  comparativo?: { tipo: TipoComparativo; periodo: { data_inicio: string; data_fim: string }; total: TotalPlanejadoExecutado };
}

export async function buscarVisitasPlanejadasXExecutadas(filtros: FiltrosRelatorio): Promise<RelatorioPlanejadoExecutado> {
  const { data } = await apiClient.get<RelatorioPlanejadoExecutado>('/relatorios/visitas-planejadas-x-executadas', {
    params: {
      tz: fusoLocal(),
      data_inicio: filtros.data_inicio || undefined,
      data_fim: filtros.data_fim || undefined,
      usuario_uuid: filtros.usuario_uuid || undefined,
      ponto_venda_uuid: filtros.ponto_venda_uuid || undefined,
      comparar: filtros.comparar || undefined,
    },
  });
  return data;
}

// Tempo dentro do PDV (docs/59 §4.2) — média/mediana por loja, promotor, rede ou dia.
export type AgruparTempoNaLoja = 'loja' | 'promotor' | 'rede' | 'dia';

export interface ResumoTempoNaLoja {
  visitas: number;
  tempo_total_minutos: number;
  media_minutos: number | null;
  mediana_minutos: number | null;
  // Produtos distintos registrados nas visitas; null = sem registro por produto ("sem informação", nunca 0).
  itens_trabalhados: number | null;
  minutos_por_item: number | null;
}

// Esforço × Retorno (docs/61): só vem quando o faturamento está habilitado na empresa e o usuário
// tem faturamento.visualizar. null = sem informação (nunca zero).
export interface ResumoFaturamento {
  faturamento_bruto?: number | null;
  devolucoes?: number | null;
  faturamento_liquido?: number | null;
  lucro?: number | null;
  margem_pct?: number | null;
  faturamento_por_hora?: number | null;
  lucro_por_hora?: number | null;
  pedidos_faturados?: number;
}

export interface LinhaTempoNaLoja extends ResumoTempoNaLoja, ResumoFaturamento {
  chave: string;
  nome: string;
  media_minutos_comparativo?: number | null;
}

export interface RelatorioTempoNaLoja {
  periodo: { data_inicio: string; data_fim: string };
  agrupar: AgruparTempoNaLoja;
  linhas: LinhaTempoNaLoja[];
  // `desconsideradas`: visitas fora da faixa válida (< 2 min ou > 12 h), de fora da média.
  total: ResumoTempoNaLoja & ResumoFaturamento & { desconsideradas: number };
  // Presente só quando o faturamento está liberado pra quem consulta.
  faturamento?: { habilitado: boolean; atribuido_por: AgruparTempoNaLoja; nota?: string };
  comparativo?: {
    tipo: TipoComparativo;
    periodo: { data_inicio: string; data_fim: string };
    total: ResumoTempoNaLoja & { desconsideradas: number };
  };
}

export async function buscarTempoNaLoja(
  filtros: FiltrosRelatorio & { agrupar: AgruparTempoNaLoja; rede_loja_uuid?: string | null },
): Promise<RelatorioTempoNaLoja> {
  const { data } = await apiClient.get<RelatorioTempoNaLoja>('/relatorios/tempo-na-loja', {
    params: {
      tz: fusoLocal(),
      agrupar: filtros.agrupar,
      data_inicio: filtros.data_inicio || undefined,
      data_fim: filtros.data_fim || undefined,
      usuario_uuid: filtros.usuario_uuid || undefined,
      ponto_venda_uuid: filtros.ponto_venda_uuid || undefined,
      rede_loja_uuid: filtros.rede_loja_uuid || undefined,
      comparar: filtros.comparar || undefined,
    },
  });
  return data;
}

// PDF dos relatórios — rota autenticada atrás de application/pdf, vem como blob (ver
// baixarRelatorioRota em agendasVisita.ts pro mesmo raciocínio).
// Lojas por trás do cumprimento de visitas: abrir a linha "dia × promotor" e a visão por loja.

export type SituacaoLojaPlanejada = 'visitada' | 'em_andamento' | 'nao_visitada' | 'a_vencer' | 'cancelada' | 'espontanea';

export interface LojaPlanejada {
  data: string;
  promotor: { id: string; nome: string } | null;
  loja: { id: string; nome: string; codigo_externo: string | null; latitude?: number | null; longitude?: number | null } | null;
  situacao: SituacaoLojaPlanejada;
  visita_id: string | null;
  entrada: string | null;
  saida: string | null;
  minutos_na_loja: number | null;
  registros: number | null;
  ordem_servico_id: string | null;
  previsto: string | null;
  prazo_fim: string | null;
  obrigatoria: boolean;
  motivo_cancelamento: string | null;
  responsavel_cancelamento: string | null;
}

export interface LojaNoPeriodo {
  loja: { id: string; nome: string; codigo_externo: string | null };
  promotores: { id: string; nome: string }[];
  planejadas: number;
  visitadas: number;
  em_andamento: number;
  nao_visitadas: number;
  a_vencer: number;
  canceladas: number;
  espontaneas: number;
  dias_perdidos: string[];
  ultima_visita: string | null;
  dias_sem_visita: number | null;
}

export async function buscarLojasDaLinha(params: { data: string; usuario_uuid: string | null; ponto_venda_uuid: string | null }): Promise<LojaPlanejada[]> {
  const { data } = await apiClient.get<{ lojas: LojaPlanejada[] }>('/relatorios/visitas-planejadas-x-executadas/lojas', {
    params: {
      tz: fusoLocal(),
      data: params.data,
      usuario_uuid: params.usuario_uuid || undefined,
      sem_promotor: params.usuario_uuid ? undefined : 1,
      ponto_venda_uuid: params.ponto_venda_uuid || undefined,
    },
  });
  return data.lojas;
}

export async function buscarVisitasPorLoja(
  filtros: FiltrosRelatorio & { so_perdidas: boolean },
): Promise<{ lojas: LojaNoPeriodo[]; total_lojas: number; lojas_com_perda: number }> {
  const { data } = await apiClient.get<{ lojas: LojaNoPeriodo[]; total_lojas: number; lojas_com_perda: number }>('/relatorios/visitas-planejadas-x-executadas/por-loja', {
    params: {
      tz: fusoLocal(),
      data_inicio: filtros.data_inicio || undefined,
      data_fim: filtros.data_fim || undefined,
      usuario_uuid: filtros.usuario_uuid || undefined,
      ponto_venda_uuid: filtros.ponto_venda_uuid || undefined,
      so_perdidas: filtros.so_perdidas ? 1 : undefined,
    },
  });
  return data;
}

export async function baixarPdfVisitasPlanejadas(filtros: FiltrosRelatorio): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/relatorios/visitas-planejadas-x-executadas/pdf', {
    params: {
      tz: fusoLocal(),
      data_inicio: filtros.data_inicio || undefined,
      data_fim: filtros.data_fim || undefined,
      usuario_uuid: filtros.usuario_uuid || undefined,
      ponto_venda_uuid: filtros.ponto_venda_uuid || undefined,
    },
    responseType: 'blob',
  });
  return data;
}

export interface CampoAgregado {
  chave: string;
  rotulo: string;
  tipo_campo: 'NUMERO' | 'TEXTO' | 'MOEDA' | 'MULTIPLA_ESCOLHA' | 'BOOLEANO' | 'DATA' | 'SORTIMENTO';
  respostas: number;
  contagem?: { valor: string; quantidade: number }[];
  estatisticas?: { soma: number; media: number; minimo: number; maximo: number } | null;
  ausencias?: { checklists: number; produtos: { produto: string; vezes_ausente: number }[] };
  ultimas?: string[];
}

export interface RelatorioRespostasFormulario {
  tipo_registro: { id: string; descricao: string };
  periodo: { data_inicio: string; data_fim: string };
  total_registros: number;
  campos: CampoAgregado[];
  rupturas?: { total: number; por_produto: { produto: string; quantidade: number }[] };
}

type FiltrosRespostas = FiltrosRelatorio & { tipo_registro_uuid: string; rede_loja_uuid?: string | null };

const paramsRespostas = (filtros: FiltrosRespostas) => ({
  tipo_registro_uuid: filtros.tipo_registro_uuid,
  tz: fusoLocal(),
  data_inicio: filtros.data_inicio || undefined,
  data_fim: filtros.data_fim || undefined,
  usuario_uuid: filtros.usuario_uuid || undefined,
  ponto_venda_uuid: filtros.ponto_venda_uuid || undefined,
  rede_loja_uuid: filtros.rede_loja_uuid || undefined,
});

export async function buscarRespostasFormulario(filtros: FiltrosRespostas): Promise<RelatorioRespostasFormulario> {
  const { data } = await apiClient.get<RelatorioRespostasFormulario>('/relatorios/respostas-formulario', {
    params: paramsRespostas(filtros),
  });
  return data;
}

export async function baixarPdfRespostasFormulario(filtros: FiltrosRespostas): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/relatorios/respostas-formulario/pdf', {
    params: paramsRespostas(filtros),
    responseType: 'blob',
  });
  return data;
}

// Coleta por Formulário (docs/39-RELATORIO-ANALITICO-PIVOT.md) — lista plana; a matriz é montada
// no front (lib/coletaFormulario.ts).
export async function buscarColetaFormulario(filtros: FiltrosRespostas): Promise<RelatorioColeta> {
  const { data } = await apiClient.get<RelatorioColeta>('/relatorios/respostas-formulario/analitico', {
    params: paramsRespostas(filtros),
  });
  return data;
}

// O PDF recebe a matriz exatamente como está na tela — o backend não refaz o pivot.
export async function baixarPdfColetaFormulario(payload: {
  titulo: string;
  subtitulo?: string;
  cabecalho: { texto: string; colunas?: number; linhas?: number }[][];
  linhas: (string | null)[][];
  rodape: (string | null)[][];
}): Promise<Blob> {
  const { data } = await apiClient.post<Blob>('/relatorios/respostas-formulario/analitico/pdf', payload, {
    responseType: 'blob',
  });
  return data;
}

import { apiClient } from './client';

// Relatórios agregados — docs/28-RELATORIOS-FEEDBACK-HISTORICO.md §2. ADMIN/GESTOR.

// Fuso do navegador — o backend guarda em UTC e precisa dele pra fechar o "dia" do gestor.
const fusoLocal = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export interface FiltrosRelatorio {
  data_inicio?: string;
  data_fim?: string;
  usuario_uuid?: string | null;
  ponto_venda_uuid?: string | null;
}

export interface LinhaPlanejadoExecutado {
  data: string;
  promotor: { id: string; nome: string } | null;
  planejadas: number;
  cumpridas: number;
  em_andamento: number;
  atrasadas: number;
  a_vencer: number;
  espontaneas: number;
  percentual_cumprimento: number | null;
}

export interface TotalPlanejadoExecutado {
  planejadas: number;
  cumpridas: number;
  em_andamento: number;
  atrasadas: number;
  a_vencer: number;
  espontaneas: number;
  percentual_cumprimento: number | null;
}

export interface RelatorioPlanejadoExecutado {
  periodo: { data_inicio: string; data_fim: string };
  linhas: LinhaPlanejadoExecutado[];
  total: TotalPlanejadoExecutado;
}

export async function buscarVisitasPlanejadasXExecutadas(filtros: FiltrosRelatorio): Promise<RelatorioPlanejadoExecutado> {
  const { data } = await apiClient.get<RelatorioPlanejadoExecutado>('/relatorios/visitas-planejadas-x-executadas', {
    params: {
      tz: fusoLocal(),
      data_inicio: filtros.data_inicio || undefined,
      data_fim: filtros.data_fim || undefined,
      usuario_uuid: filtros.usuario_uuid || undefined,
      ponto_venda_uuid: filtros.ponto_venda_uuid || undefined,
    },
  });
  return data;
}

// PDF dos relatórios — rota autenticada atrás de application/pdf, vem como blob (ver
// baixarRelatorioRota em agendasVisita.ts pro mesmo raciocínio).
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

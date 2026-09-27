import type { AtividadeEvento, PaginatedMeta, VisitaRegistro } from '../../types/api';
import { apiClient } from './client';

export interface AtividadesFiltros {
  data_inicio?: string;
  data_fim?: string;
  usuario_uuid?: string;
  ponto_venda_uuid?: string;
  // Qualquer tipo de registro (alerta ou formulário) — suprime chegada/saída.
  tipo_registro_uuid?: string;
  pendentes?: boolean;
  // Só eventos com foto (saída com álbum, alerta/registro com imagem).
  com_foto?: boolean;
  page?: number;
}

export interface AtividadesListResponse {
  eventos: AtividadeEvento[];
  meta: PaginatedMeta;
}

export async function listarAtividades(filtros: AtividadesFiltros = {}): Promise<AtividadesListResponse> {
  const { data } = await apiClient.get<AtividadesListResponse>('/atividades', {
    params: {
      ...filtros,
      pendentes: filtros.pendentes ? 1 : undefined,
      com_foto: filtros.com_foto ? 1 : undefined,
    },
  });
  return data;
}

// Coluna lateral + contadores do painel — ver AtividadeController::resumo e
// docs/43-REVISAO-UX-PAINEL-ATIVIDADES.md §4 item 4.
export interface ResumoAtividades {
  em_loja: {
    visita_id: string;
    usuario: { id: string; nome: string; foto_url: string | null } | null;
    ponto_venda: { id: string; fantasia: string } | null;
    desde: string;
  }[];
  total_promotores: number;
  // Alertas sem tratativa (não resolvidos e sem Plano de Ação em andamento) no período.
  alertas: {
    total: number;
    itens: {
      registro_id: string;
      visita_id: string;
      tipo: string;
      produto: string | null;
      ponto_venda: string | null;
      ocorrido_em: string;
    }[];
  };
  respostas_novas: number;
  requer_resolucao: boolean;
}

export async function buscarResumoAtividades(periodo: { data_inicio?: string; data_fim?: string } = {}): Promise<ResumoAtividades> {
  const { data } = await apiClient.get<ResumoAtividades>('/atividades/resumo', { params: periodo });
  return data;
}

export async function resolverAlerta(visitaUuid: string, registroUuid: string): Promise<{ registro: VisitaRegistro }> {
  const { data } = await apiClient.post<{ registro: VisitaRegistro }>(
    `/visitas/${visitaUuid}/registros/${registroUuid}/resolver-alerta`,
  );
  return data;
}

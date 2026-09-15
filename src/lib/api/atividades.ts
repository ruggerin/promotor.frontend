import type { AtividadeEvento, PaginatedMeta, VisitaRegistro } from '../../types/api';
import { apiClient } from './client';

export interface AtividadesFiltros {
  data_inicio?: string;
  data_fim?: string;
  usuario_uuid?: string;
  ponto_venda_uuid?: string;
  tipo_registro_uuid?: string;
  pendentes?: boolean;
  page?: number;
}

export interface AtividadesListResponse {
  eventos: AtividadeEvento[];
  meta: PaginatedMeta;
}

export async function listarAtividades(filtros: AtividadesFiltros = {}): Promise<AtividadesListResponse> {
  const { data } = await apiClient.get<AtividadesListResponse>('/atividades', { params: filtros });
  return data;
}

export async function resolverAlerta(visitaUuid: string, registroUuid: string): Promise<{ registro: VisitaRegistro }> {
  const { data } = await apiClient.post<{ registro: VisitaRegistro }>(
    `/visitas/${visitaUuid}/registros/${registroUuid}/resolver-alerta`,
  );
  return data;
}

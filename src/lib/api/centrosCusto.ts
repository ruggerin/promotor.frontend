import type { CategoriaCentroCustoItem, CentroCusto, PaginatedMeta } from '../../types/api';
import { apiClient } from './client';

export interface CentrosCustoListParams {
  page?: number;
  ativo?: boolean;
}

export interface CentrosCustoListResponse {
  centros_custo: CentroCusto[];
  meta: PaginatedMeta;
}

export async function listarCentrosCusto(params: CentrosCustoListParams = {}): Promise<CentrosCustoListResponse> {
  const { data } = await apiClient.get<CentrosCustoListResponse>('/centros-custo', {
    params: {
      page: params.page,
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
    },
  });
  return data;
}

export interface CentroCustoItemPayload {
  categoria: CategoriaCentroCustoItem;
  descricao: string;
  valor_mensal: number;
}

export interface CentroCustoPayload {
  descricao: string;
  carga_horaria_semanal: number;
  // Lista completa — sempre substitui os itens existentes por inteiro (ver
  // CentroCustoController::sincronizarItens).
  itens?: CentroCustoItemPayload[];
}

export async function criarCentroCusto(payload: CentroCustoPayload): Promise<{ centro_custo: CentroCusto }> {
  const { data } = await apiClient.post<{ centro_custo: CentroCusto }>('/centros-custo', payload);
  return data;
}

export async function atualizarCentroCusto(
  uuid: string,
  payload: Partial<CentroCustoPayload> & { ativo?: boolean },
): Promise<{ centro_custo: CentroCusto }> {
  const { data } = await apiClient.put<{ centro_custo: CentroCusto }>(`/centros-custo/${uuid}`, payload);
  return data;
}

export async function desativarCentroCusto(uuid: string): Promise<void> {
  await apiClient.delete(`/centros-custo/${uuid}`);
}

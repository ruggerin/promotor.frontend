import type { TipoVisita } from '../../types/api';
import { apiClient } from './client';

export interface TiposVisitaListParams {
  ativo?: boolean;
}

export interface TiposVisitaListResponse {
  tipos_visita: TipoVisita[];
}

export async function listarTiposVisita(params: TiposVisitaListParams = {}): Promise<TiposVisitaListResponse> {
  const { data } = await apiClient.get<TiposVisitaListResponse>('/tipos-visita', {
    params: { ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0 },
  });
  return data;
}

export interface TipoVisitaPayload {
  descricao: string;
  cor: string;
}

export async function criarTipoVisita(payload: TipoVisitaPayload): Promise<{ tipo_visita: TipoVisita }> {
  const { data } = await apiClient.post<{ tipo_visita: TipoVisita }>('/tipos-visita', payload);
  return data;
}

export async function atualizarTipoVisita(
  uuid: string,
  payload: Partial<TipoVisitaPayload> & { ativo?: boolean },
): Promise<{ tipo_visita: TipoVisita }> {
  const { data } = await apiClient.put<{ tipo_visita: TipoVisita }>(`/tipos-visita/${uuid}`, payload);
  return data;
}

export async function desativarTipoVisita(uuid: string): Promise<void> {
  await apiClient.delete(`/tipos-visita/${uuid}`);
}

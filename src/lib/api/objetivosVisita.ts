import type { ObjetivoVisita } from '../../types/api';
import { apiClient } from './client';

export interface ObjetivosVisitaListParams {
  ativo?: boolean;
}

export interface ObjetivosVisitaListResponse {
  objetivos_visita: ObjetivoVisita[];
}

export async function listarObjetivosVisita(params: ObjetivosVisitaListParams = {}): Promise<ObjetivosVisitaListResponse> {
  const { data } = await apiClient.get<ObjetivosVisitaListResponse>('/objetivos-visita', {
    params: { ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0 },
  });
  return data;
}

export interface ObjetivoVisitaPayload {
  descricao: string;
}

export async function criarObjetivoVisita(payload: ObjetivoVisitaPayload): Promise<{ objetivo_visita: ObjetivoVisita }> {
  const { data } = await apiClient.post<{ objetivo_visita: ObjetivoVisita }>('/objetivos-visita', payload);
  return data;
}

export async function atualizarObjetivoVisita(
  uuid: string,
  payload: Partial<ObjetivoVisitaPayload> & { ativo?: boolean },
): Promise<{ objetivo_visita: ObjetivoVisita }> {
  const { data } = await apiClient.put<{ objetivo_visita: ObjetivoVisita }>(`/objetivos-visita/${uuid}`, payload);
  return data;
}

export async function desativarObjetivoVisita(uuid: string): Promise<void> {
  await apiClient.delete(`/objetivos-visita/${uuid}`);
}

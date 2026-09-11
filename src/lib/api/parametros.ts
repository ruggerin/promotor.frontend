import type { Parametro } from '../../types/api';
import { apiClient } from './client';

export interface ParametrosListResponse {
  parametros: Parametro[];
}

export async function listarParametros(): Promise<ParametrosListResponse> {
  const { data } = await apiClient.get<ParametrosListResponse>('/parametros');
  return data;
}

export interface ParametroPayload {
  chave: string;
  valor: string;
  descricao?: string | null;
}

export async function criarParametro(payload: ParametroPayload): Promise<{ parametro: Parametro }> {
  const { data } = await apiClient.post<{ parametro: Parametro }>('/parametros', payload);
  return data;
}

export async function atualizarParametro(
  uuid: string,
  payload: Partial<ParametroPayload> & { ativo?: boolean },
): Promise<{ parametro: Parametro }> {
  const { data } = await apiClient.put<{ parametro: Parametro }>(`/parametros/${uuid}`, payload);
  return data;
}

export async function desativarParametro(uuid: string): Promise<void> {
  await apiClient.delete(`/parametros/${uuid}`);
}

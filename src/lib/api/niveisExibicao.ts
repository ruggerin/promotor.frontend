import type { NivelExibicao, PaginatedMeta } from '../../types/api';
import { apiClient } from './client';

export interface NiveisExibicaoListResponse {
  niveis_exibicao: NivelExibicao[];
  meta: PaginatedMeta;
}

export interface NiveisExibicaoListParams {
  ativo?: boolean;
  busca?: string;
  // Só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
}

export async function listarNiveisExibicao(params: NiveisExibicaoListParams = {}): Promise<NiveisExibicaoListResponse> {
  const { data } = await apiClient.get<NiveisExibicaoListResponse>('/niveis-exibicao', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      busca: params.busca || undefined,
      empresa_uuid: params.empresa_uuid,
    },
  });
  return data;
}

export interface NivelExibicaoPayload {
  descricao: string;
  ativo?: boolean;
}

export async function criarNivelExibicao(payload: NivelExibicaoPayload): Promise<{ nivel_exibicao: NivelExibicao }> {
  const { data } = await apiClient.post<{ nivel_exibicao: NivelExibicao }>('/niveis-exibicao', payload);
  return data;
}

export async function atualizarNivelExibicao(
  uuid: string,
  payload: Partial<NivelExibicaoPayload>,
): Promise<{ nivel_exibicao: NivelExibicao }> {
  const { data } = await apiClient.put<{ nivel_exibicao: NivelExibicao }>(`/niveis-exibicao/${uuid}`, payload);
  return data;
}

export async function desativarNivelExibicao(uuid: string): Promise<void> {
  await apiClient.delete(`/niveis-exibicao/${uuid}`);
}

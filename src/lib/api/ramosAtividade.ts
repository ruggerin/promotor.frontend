import type { PaginatedMeta, RamoAtividade } from '../../types/api';
import { apiClient } from './client';

export interface RamosAtividadeListResponse {
  ramos_atividade: RamoAtividade[];
  meta: PaginatedMeta;
}

export interface RamosAtividadeListParams {
  ativo?: boolean;
  // Só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
}

export async function listarRamosAtividade(params: RamosAtividadeListParams = {}): Promise<RamosAtividadeListResponse> {
  const { data } = await apiClient.get<RamosAtividadeListResponse>('/ramos-atividade', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      empresa_uuid: params.empresa_uuid,
    },
  });
  return data;
}

export interface RamoAtividadePayload {
  descricao: string;
  ativo?: boolean;
}

export async function criarRamoAtividade(payload: RamoAtividadePayload): Promise<{ ramo_atividade: RamoAtividade }> {
  const { data } = await apiClient.post<{ ramo_atividade: RamoAtividade }>('/ramos-atividade', payload);
  return data;
}

export async function atualizarRamoAtividade(
  uuid: string,
  payload: Partial<RamoAtividadePayload>,
): Promise<{ ramo_atividade: RamoAtividade }> {
  const { data } = await apiClient.put<{ ramo_atividade: RamoAtividade }>(`/ramos-atividade/${uuid}`, payload);
  return data;
}

export async function desativarRamoAtividade(uuid: string): Promise<void> {
  await apiClient.delete(`/ramos-atividade/${uuid}`);
}

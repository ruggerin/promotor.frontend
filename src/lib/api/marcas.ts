import type { MarcaAuditoria, PaginatedMeta, Propriedade } from '../../types/api';
import { apiClient } from './client';

export interface MarcasListResponse {
  marcas: MarcaAuditoria[];
  meta: PaginatedMeta;
}

export interface MarcasListParams {
  ativo?: boolean;
  busca?: string;
  propriedade?: Propriedade;
  // Só as cadastradas pelo promotor ainda "a aprovar" (docs/85 §4.3).
  a_aprovar?: boolean;
  por_pagina?: number;
  // Só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
}

export async function listarMarcas(params: MarcasListParams = {}): Promise<MarcasListResponse> {
  const { data } = await apiClient.get<MarcasListResponse>('/marcas-auditoria', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      busca: params.busca || undefined,
      propriedade: params.propriedade,
      a_aprovar: params.a_aprovar ? 1 : undefined,
      por_pagina: params.por_pagina,
      empresa_uuid: params.empresa_uuid,
    },
  });
  return data;
}

export interface MarcaPayload {
  descricao: string;
  propriedade: Propriedade;
  ativo?: boolean;
}

export async function criarMarca(payload: MarcaPayload): Promise<{ marca: MarcaAuditoria }> {
  const { data } = await apiClient.post<{ marca: MarcaAuditoria }>('/marcas-auditoria', payload);
  return data;
}

export async function atualizarMarca(uuid: string, payload: Partial<MarcaPayload>): Promise<{ marca: MarcaAuditoria }> {
  const { data } = await apiClient.put<{ marca: MarcaAuditoria }>(`/marcas-auditoria/${uuid}`, payload);
  return data;
}

export async function desativarMarca(uuid: string): Promise<void> {
  await apiClient.delete(`/marcas-auditoria/${uuid}`);
}

/** Marca cadastrada pelo promotor deixa de ser "a aprovar" (docs/85 §4.2). */
export async function aprovarMarca(uuid: string): Promise<{ marca: MarcaAuditoria }> {
  const { data } = await apiClient.post<{ marca: MarcaAuditoria }>(`/marcas-auditoria/${uuid}/aprovar`);
  return data;
}

/** Junta a marca em outra que já existe ("DOWNY" → "Downy"): registros vão junto, ela some. */
export async function juntarMarca(uuid: string, destinoUuid: string): Promise<{ marca: MarcaAuditoria }> {
  const { data } = await apiClient.post<{ marca: MarcaAuditoria }>(`/marcas-auditoria/${uuid}/juntar`, { destino_uuid: destinoUuid });
  return data;
}

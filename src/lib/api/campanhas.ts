import type { CampanhaAuditoria, CampanhaItem, PaginatedMeta, TipoItemCampanha } from '../../types/api';
import { apiClient } from './client';

export interface CampanhasListResponse {
  campanhas: CampanhaAuditoria[];
  meta: PaginatedMeta;
}

export async function listarCampanhas(ativo?: boolean): Promise<CampanhasListResponse> {
  const { data } = await apiClient.get<CampanhasListResponse>('/campanhas-auditoria', {
    params: { ativo: ativo === undefined ? undefined : ativo ? 1 : 0 },
  });
  return data;
}

export async function buscarCampanha(uuid: string): Promise<{ campanha: CampanhaAuditoria }> {
  const { data } = await apiClient.get<{ campanha: CampanhaAuditoria }>(`/campanhas-auditoria/${uuid}`);
  return data;
}

export interface CampanhaPayload {
  descricao: string;
  observacao?: string | null;
  layout?: string | null;
  vigencia_inicio: string;
  vigencia_fim: string;
  restricao?: string | null;
  exclusividade?: string | null;
  frequencia_dias?: number | null;
  execucao_recorrente?: boolean;
  possui_restricao?: boolean;
  possui_exclusividade?: boolean;
  ativo?: boolean;
}

export async function criarCampanha(payload: CampanhaPayload): Promise<{ campanha: CampanhaAuditoria }> {
  const { data } = await apiClient.post<{ campanha: CampanhaAuditoria }>('/campanhas-auditoria', payload);
  return data;
}

export async function atualizarCampanha(
  uuid: string,
  payload: Partial<CampanhaPayload>,
): Promise<{ campanha: CampanhaAuditoria }> {
  const { data } = await apiClient.put<{ campanha: CampanhaAuditoria }>(`/campanhas-auditoria/${uuid}`, payload);
  return data;
}

export async function desativarCampanha(uuid: string): Promise<void> {
  await apiClient.delete(`/campanhas-auditoria/${uuid}`);
}

export interface CampanhaItemPayload {
  tipo_item: TipoItemCampanha;
  produto_uuid?: string;
  secao_uuid?: string;
  departamento_uuid?: string;
  marca_uuid?: string;
}

export async function adicionarCampanhaItem(
  campanhaUuid: string,
  payload: CampanhaItemPayload,
): Promise<{ item: CampanhaItem }> {
  const { data } = await apiClient.post<{ item: CampanhaItem }>(`/campanhas-auditoria/${campanhaUuid}/itens`, payload);
  return data;
}

export async function removerCampanhaItem(campanhaUuid: string, itemUuid: string): Promise<void> {
  await apiClient.delete(`/campanhas-auditoria/${campanhaUuid}/itens/${itemUuid}`);
}

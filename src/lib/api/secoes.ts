import type { PaginatedMeta, SecaoAuditoria } from '../../types/api';
import { apiClient } from './client';

export interface SecoesListResponse {
  secoes: SecaoAuditoria[];
  meta: PaginatedMeta;
}

export async function listarSecoes(
  // empresa_uuid só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  params: { ativo?: boolean; departamento_uuid?: string; empresa_uuid?: string } = {},
): Promise<SecoesListResponse> {
  const { data } = await apiClient.get<SecoesListResponse>('/secoes-auditoria', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      departamento_uuid: params.departamento_uuid,
      empresa_uuid: params.empresa_uuid,
    },
  });
  return data;
}

export interface SecaoPayload {
  descricao: string;
  departamento_uuid?: string | null;
  ativo?: boolean;
}

export async function criarSecao(payload: SecaoPayload): Promise<{ secao: SecaoAuditoria }> {
  const { data } = await apiClient.post<{ secao: SecaoAuditoria }>('/secoes-auditoria', payload);
  return data;
}

export async function atualizarSecao(uuid: string, payload: Partial<SecaoPayload>): Promise<{ secao: SecaoAuditoria }> {
  const { data } = await apiClient.put<{ secao: SecaoAuditoria }>(`/secoes-auditoria/${uuid}`, payload);
  return data;
}

export async function desativarSecao(uuid: string): Promise<void> {
  await apiClient.delete(`/secoes-auditoria/${uuid}`);
}

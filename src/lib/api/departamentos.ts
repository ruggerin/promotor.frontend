import type { DepartamentoAuditoria, PaginatedMeta } from '../../types/api';
import { apiClient } from './client';

export interface DepartamentosListResponse {
  departamentos: DepartamentoAuditoria[];
  meta: PaginatedMeta;
}

export interface DepartamentosListParams {
  ativo?: boolean;
  busca?: string;
  // Sem `por_pagina` vem a lista inteira (até 1000, teto da API) — é o que os selects usam;
  // as abas do Catálogo passam `page`/`por_pagina` e paginam.
  page?: number;
  por_pagina?: number;
  // Só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
}

export async function listarDepartamentos(params: DepartamentosListParams = {}): Promise<DepartamentosListResponse> {
  const { data } = await apiClient.get<DepartamentosListResponse>('/departamentos-auditoria', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      busca: params.busca || undefined,
      empresa_uuid: params.empresa_uuid,
      page: params.page,
      por_pagina: params.por_pagina ?? 1000,
    },
  });
  return data;
}

export interface DepartamentoPayload {
  descricao: string;
  ativo?: boolean;
}

export async function criarDepartamento(payload: DepartamentoPayload): Promise<{ departamento: DepartamentoAuditoria }> {
  const { data } = await apiClient.post<{ departamento: DepartamentoAuditoria }>('/departamentos-auditoria', payload);
  return data;
}

export async function atualizarDepartamento(
  uuid: string,
  payload: Partial<DepartamentoPayload>,
): Promise<{ departamento: DepartamentoAuditoria }> {
  const { data } = await apiClient.put<{ departamento: DepartamentoAuditoria }>(`/departamentos-auditoria/${uuid}`, payload);
  return data;
}

export async function desativarDepartamento(uuid: string): Promise<void> {
  await apiClient.delete(`/departamentos-auditoria/${uuid}`);
}

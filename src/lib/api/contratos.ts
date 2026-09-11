import type { Contrato, ContratoHistorico, PaginatedMeta, TipoContrato } from '../../types/api';
import { apiClient } from './client';

export interface ContratosListParams {
  page?: number;
  ativo?: boolean;
  tipo?: TipoContrato;
  ponto_venda_uuid?: string;
  // Só tem efeito pra SUPERADMIN (ver docs/02-API-BACKEND.md) — ADMIN/GESTOR já são restritos
  // à própria empresa pelo backend.
  empresa_uuid?: string;
}

export interface ContratosListResponse {
  contratos: Contrato[];
  meta: PaginatedMeta;
}

export async function listarContratos(params: ContratosListParams = {}): Promise<ContratosListResponse> {
  const { data } = await apiClient.get<ContratosListResponse>('/contratos', {
    params: {
      page: params.page,
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      tipo: params.tipo,
      ponto_venda_uuid: params.ponto_venda_uuid,
      empresa_uuid: params.empresa_uuid,
    },
  });
  return data;
}

export interface ContratoPayload {
  ponto_venda_uuid: string;
  tipo: TipoContrato;
  descricao?: string | null;
  vigencia_inicio: string;
  vigencia_fim: string;
  // Só SUPERADMIN manda isso (escolhe em qual empresa criar) — obrigatório pra ele, proibido
  // pros outros, ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
}

// Página de detalhe do contrato (dados + metas + anexo + histórico) — ver
// docs/03-ADMIN-WEB.md#6-contratos. Diferente da listagem, sempre traz `metas` (não precisa do
// `?with_metas=1`, um contrato só não pesa nada).
export async function buscarContrato(uuid: string): Promise<{ contrato: Contrato }> {
  const { data } = await apiClient.get<{ contrato: Contrato }>(`/contratos/${uuid}`);
  return data;
}

export interface ContratoHistoricoListResponse {
  historico: ContratoHistorico[];
  meta: PaginatedMeta;
}

export async function buscarHistoricoContrato(uuid: string, page = 1): Promise<ContratoHistoricoListResponse> {
  const { data } = await apiClient.get<ContratoHistoricoListResponse>(`/contratos/${uuid}/historico`, {
    params: { page },
  });
  return data;
}

export async function criarContrato(payload: ContratoPayload): Promise<{ contrato: Contrato }> {
  const { data } = await apiClient.post<{ contrato: Contrato }>('/contratos', payload);
  return data;
}

export async function atualizarContrato(
  uuid: string,
  payload: Partial<Omit<ContratoPayload, 'empresa_uuid'>> & { ativo?: boolean },
): Promise<{ contrato: Contrato }> {
  const { data } = await apiClient.put<{ contrato: Contrato }>(`/contratos/${uuid}`, payload);
  return data;
}

export async function desativarContrato(uuid: string): Promise<void> {
  await apiClient.delete(`/contratos/${uuid}`);
}

// Upload (ou substituição) do arquivo do contrato assinado — ação separada da criação/edição,
// ver docs/02-API-BACKEND.md.
export async function uploadArquivoContrato(uuid: string, arquivo: File): Promise<{ contrato: Contrato }> {
  const formData = new FormData();
  formData.append('arquivo', arquivo);
  const { data } = await apiClient.post<{ contrato: Contrato }>(`/contratos/${uuid}/arquivo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

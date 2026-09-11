import type { PaginatedMeta, ProdutoAuditoria, Propriedade } from '../../types/api';
import { apiClient } from './client';

export interface ProdutosListResponse {
  produtos: ProdutoAuditoria[];
  meta: PaginatedMeta;
}

export async function listarProdutos(
  // empresa_uuid só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  params: { ativo?: boolean; departamento_uuid?: string; secao_uuid?: string; empresa_uuid?: string } = {},
): Promise<ProdutosListResponse> {
  const { data } = await apiClient.get<ProdutosListResponse>('/produtos-auditoria', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      departamento_uuid: params.departamento_uuid,
      secao_uuid: params.secao_uuid,
      empresa_uuid: params.empresa_uuid,
    },
  });
  return data;
}

export interface ProdutoPayload {
  descricao: string;
  codigo_barras?: string | null;
  imagem_url?: string | null;
  departamento_uuid?: string | null;
  secao_uuid?: string | null;
  nivel_exibicao_uuid?: string | null;
  produto_final?: boolean;
  produto_chave?: boolean;
  gerar_via_secoes_marcas?: boolean;
  peso_kg?: number | null;
  propriedade: Propriedade;
  ativo?: boolean;
}

export async function criarProduto(payload: ProdutoPayload): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.post<{ produto: ProdutoAuditoria }>('/produtos-auditoria', payload);
  return data;
}

export async function atualizarProduto(uuid: string, payload: Partial<ProdutoPayload>): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.put<{ produto: ProdutoAuditoria }>(`/produtos-auditoria/${uuid}`, payload);
  return data;
}

export async function desativarProduto(uuid: string): Promise<void> {
  await apiClient.delete(`/produtos-auditoria/${uuid}`);
}

// Painel de aprovação de produto cadastrado por promotor (self-service) — ver
// docs/14-SORTIMENTO-PONTO-VENDA.md §9.
export async function aprovarProduto(uuid: string): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.post<{ produto: ProdutoAuditoria }>(`/produtos-auditoria/${uuid}/aprovar`);
  return data;
}

export async function rejeitarProduto(uuid: string): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.post<{ produto: ProdutoAuditoria }>(`/produtos-auditoria/${uuid}/rejeitar`);
  return data;
}

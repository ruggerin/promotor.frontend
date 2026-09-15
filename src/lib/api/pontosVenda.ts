import type { PaginatedMeta, PontoVenda } from '../../types/api';
import { apiClient } from './client';

export interface PontosVendaListParams {
  page?: number;
  ativo?: boolean;
  busca?: string;
  // Restringe às lojas atribuídas a esse promotor — ver docs/02-API-BACKEND.md, regra de
  // negócio 6.
  promotor_uuid?: string;
  // Filtros refinados (independentes do `busca` genérico acima) — usados pelo modal de busca
  // avançada, pra achar a loja certa entre várias parecidas.
  razao_social?: string;
  fantasia?: string;
  cnpj?: string;
  // Só tem efeito pra SUPERADMIN (ver docs/02-API-BACKEND.md) — escolhe de qual empresa listar
  // PDVs, ex.: pra cadastrar um contrato de uma empresa que não é a própria.
  empresa_uuid?: string;
}

export interface PontosVendaListResponse {
  pontos_venda: PontoVenda[];
  meta: PaginatedMeta;
}

export async function listarPontosVenda(params: PontosVendaListParams = {}): Promise<PontosVendaListResponse> {
  const { data } = await apiClient.get<PontosVendaListResponse>('/pontos-venda', {
    params: {
      page: params.page,
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      busca: params.busca || undefined,
      promotor_uuid: params.promotor_uuid,
      razao_social: params.razao_social || undefined,
      fantasia: params.fantasia || undefined,
      cnpj: params.cnpj || undefined,
      empresa_uuid: params.empresa_uuid || undefined,
    },
  });
  return data;
}

export interface PontoVendaPayload {
  codigo_externo?: string | null;
  cnpj?: string | null;
  razao_social: string;
  fantasia: string;
  latitude: number;
  longitude: number;
  endereco: string;
  numero?: string | null;
  bairro?: string | null;
  cidade: string;
  cep?: string | null;
  telefone?: string | null;
  email?: string | null;
  rede_loja_uuid?: string | null;
  ramo_atividade_uuid?: string | null;
  numero_checkouts?: number | null;
  ativo?: boolean;
}

export async function buscarPontoVenda(uuid: string): Promise<{ ponto_venda: PontoVenda }> {
  const { data } = await apiClient.get<{ ponto_venda: PontoVenda }>(`/pontos-venda/${uuid}`);
  return data;
}

export async function criarPontoVenda(payload: PontoVendaPayload): Promise<{ ponto_venda: PontoVenda }> {
  const { data } = await apiClient.post<{ ponto_venda: PontoVenda }>('/pontos-venda', payload);
  return data;
}

export async function atualizarPontoVenda(
  uuid: string,
  payload: Partial<PontoVendaPayload>,
): Promise<{ ponto_venda: PontoVenda }> {
  const { data } = await apiClient.put<{ ponto_venda: PontoVenda }>(`/pontos-venda/${uuid}`, payload);
  return data;
}

export async function desativarPontoVenda(uuid: string): Promise<void> {
  await apiClient.delete(`/pontos-venda/${uuid}`);
}

// Sincroniza (substitui) o conjunto de promotores desta loja — ver docs/02-API-BACKEND.md,
// regra de negócio 6. Manda a lista completa desejada; quem não estiver nela é desvinculado.
// Evite pra mudanças pontuais (um promotor de cada vez) — usa a lista atual do cliente como
// base, então dois cliques rápidos podem perder a atribuição um do outro. Prefira
// adicionarPromotorPontoVenda/removerPromotorPontoVenda abaixo pra isso.
export async function sincronizarPromotoresPontoVenda(
  uuid: string,
  usuariosUuids: string[],
): Promise<{ ponto_venda: PontoVenda }> {
  const { data } = await apiClient.put<{ ponto_venda: PontoVenda }>(`/pontos-venda/${uuid}/promotores`, {
    usuarios_uuids: usuariosUuids,
  });
  return data;
}

// Atribui/remove um promotor de cada vez, sem recalcular a lista inteira no cliente — evita a
// race condition de sincronizarPromotoresPontoVenda quando duas atribuições acontecem em
// sequência rápida (ver auditoria de 2026-09-10).
export async function adicionarPromotorPontoVenda(
  pontoVendaUuid: string,
  usuarioUuid: string,
): Promise<{ ponto_venda: PontoVenda }> {
  const { data } = await apiClient.post<{ ponto_venda: PontoVenda }>(
    `/pontos-venda/${pontoVendaUuid}/promotores/${usuarioUuid}`,
  );
  return data;
}

export async function removerPromotorPontoVenda(
  pontoVendaUuid: string,
  usuarioUuid: string,
): Promise<{ ponto_venda: PontoVenda }> {
  const { data } = await apiClient.delete<{ ponto_venda: PontoVenda }>(
    `/pontos-venda/${pontoVendaUuid}/promotores/${usuarioUuid}`,
  );
  return data;
}

// Substitui a foto anterior (ver PontoVendaController::atualizarFachada) — mesmo padrão de
// enviarFotoCapa em lib/api/planogramas.ts.
export async function enviarFachadaPontoVenda(uuid: string, imagem: File): Promise<{ ponto_venda: PontoVenda }> {
  const formData = new FormData();
  formData.append('imagem', imagem);
  const { data } = await apiClient.post<{ ponto_venda: PontoVenda }>(`/pontos-venda/${uuid}/fachada`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function removerFachadaPontoVenda(uuid: string): Promise<{ ponto_venda: PontoVenda }> {
  const { data } = await apiClient.delete<{ ponto_venda: PontoVenda }>(`/pontos-venda/${uuid}/fachada`);
  return data;
}

import type { Planograma, PlanogramaBloco, PlanogramaPrateleira } from '../../types/api';
import { apiClient } from './client';

export interface PlanogramasListResponse {
  planogramas: Planograma[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function listarPlanogramas(params: { empresa_uuid?: string } = {}): Promise<PlanogramasListResponse> {
  const { data } = await apiClient.get<PlanogramasListResponse>('/planogramas', { params });
  return data;
}

export async function buscarPlanograma(uuid: string): Promise<{ planograma: Planograma }> {
  const { data } = await apiClient.get<{ planograma: Planograma }>(`/planogramas/${uuid}`);
  return data;
}

export async function criarPlanograma(descricao: string): Promise<{ planograma: Planograma }> {
  const { data } = await apiClient.post<{ planograma: Planograma }>('/planogramas', { descricao });
  return data;
}

export async function atualizarPlanograma(uuid: string, payload: { descricao?: string; ativo?: boolean }): Promise<{ planograma: Planograma }> {
  const { data } = await apiClient.put<{ planograma: Planograma }>(`/planogramas/${uuid}`, payload);
  return data;
}

export async function desativarPlanograma(uuid: string): Promise<void> {
  await apiClient.delete(`/planogramas/${uuid}`);
}

// Aceita tanto upload manual (File vindo de um <input type="file">) quanto o PNG gerado no
// próprio navegador (Blob, screenshot da grade do editor) — o backend não distingue a origem.
export async function enviarFotoCapa(uuid: string, foto: File | Blob): Promise<{ planograma: Planograma }> {
  const formData = new FormData();
  formData.append('foto', foto, 'capa.png');
  const { data } = await apiClient.post<{ planograma: Planograma }>(`/planogramas/${uuid}/foto-capa`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function criarPrateleira(
  planogramaUuid: string,
  payload: { descricao?: string | null; quantidade_blocos: number },
): Promise<{ prateleira: PlanogramaPrateleira }> {
  const { data } = await apiClient.post<{ prateleira: PlanogramaPrateleira }>(
    `/planogramas/${planogramaUuid}/prateleiras`,
    payload,
  );
  return data;
}

// Reduzir quantidade_blocos abaixo de onde algum bloco já alcança devolve 422 com
// blocos_removidos — ver docs/22-PLANOGRAMA.md, decisão 2. Resolvido via force=true.
export interface ReducaoBlocosPendente {
  message: string;
  blocos_removidos: Array<{
    id: string;
    posicao_inicio: number;
    largura: number;
    produto_auditoria: { id: string; descricao: string } | null;
  }>;
}

export async function atualizarPrateleira(
  planogramaUuid: string,
  prateleiraUuid: string,
  payload: { descricao?: string | null; quantidade_blocos?: number; force?: boolean },
): Promise<{ prateleira: PlanogramaPrateleira }> {
  const { data } = await apiClient.put<{ prateleira: PlanogramaPrateleira }>(
    `/planogramas/${planogramaUuid}/prateleiras/${prateleiraUuid}`,
    payload,
  );
  return data;
}

export async function removerPrateleira(planogramaUuid: string, prateleiraUuid: string): Promise<void> {
  await apiClient.delete(`/planogramas/${planogramaUuid}/prateleiras/${prateleiraUuid}`);
}

export interface BlocoPosicao {
  posicao_inicio: number;
  largura: number;
}

// Cria 1..N blocos do mesmo produto numa tacada só — array com 1 item cobre o arrasto de uma
// célula, array com N cobre "aplicar aos selecionados" no editor. Ver docs/22-PLANOGRAMA.md §4.
export async function criarBlocos(
  planogramaUuid: string,
  prateleiraUuid: string,
  produtoAuditoriaUuid: string,
  blocos: BlocoPosicao[],
): Promise<{ blocos: PlanogramaBloco[] }> {
  const { data } = await apiClient.post<{ blocos: PlanogramaBloco[] }>(
    `/planogramas/${planogramaUuid}/prateleiras/${prateleiraUuid}/blocos`,
    { produto_auditoria_uuid: produtoAuditoriaUuid, blocos },
  );
  return data;
}

export async function removerBloco(planogramaUuid: string, prateleiraUuid: string, blocoUuid: string): Promise<void> {
  await apiClient.delete(`/planogramas/${planogramaUuid}/prateleiras/${prateleiraUuid}/blocos/${blocoUuid}`);
}

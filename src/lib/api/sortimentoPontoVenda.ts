import type { SortimentoPontoVenda, TipoItemCampanha } from '../../types/api';
import { apiClient } from './client';

export interface SortimentoPontoVendaPayload {
  tipo_item: TipoItemCampanha;
  produto_uuid?: string;
  secao_uuid?: string;
  departamento_uuid?: string;
  marca_uuid?: string;
}

export async function adicionarSortimentoItem(
  pontoVendaUuid: string,
  payload: SortimentoPontoVendaPayload,
): Promise<{ item: SortimentoPontoVenda }> {
  const { data } = await apiClient.post<{ item: SortimentoPontoVenda }>(
    `/pontos-venda/${pontoVendaUuid}/sortimento`,
    payload,
  );
  return data;
}

export async function removerSortimentoItem(pontoVendaUuid: string, itemUuid: string): Promise<void> {
  await apiClient.delete(`/pontos-venda/${pontoVendaUuid}/sortimento/${itemUuid}`);
}

// Painel de aprovação de item adicionado por promotor pela visita (modo REQUER_APROVACAO) —
// ver docs/14-SORTIMENTO-PONTO-VENDA.md §9.
export async function aprovarSortimentoItem(
  pontoVendaUuid: string,
  itemUuid: string,
): Promise<{ item: SortimentoPontoVenda }> {
  const { data } = await apiClient.post<{ item: SortimentoPontoVenda }>(
    `/pontos-venda/${pontoVendaUuid}/sortimento/${itemUuid}/aprovar`,
  );
  return data;
}

export async function rejeitarSortimentoItem(pontoVendaUuid: string, itemUuid: string): Promise<void> {
  await apiClient.post(`/pontos-venda/${pontoVendaUuid}/sortimento/${itemUuid}/rejeitar`);
}

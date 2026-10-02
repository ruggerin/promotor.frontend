import type { PaginatedMeta } from '../../types/api';
import { apiClient } from './client';

// Pedidos do ERP por loja (docs/28-RELATORIOS-FEEDBACK-HISTORICO.md §4.2) — o admin só consulta;
// quem grava é o integrador externo, via POST /pedidos. Sem valor monetário, de propósito.

export interface PedidoItem {
  id: string;
  codigo_externo_produto: string;
  descricao_produto: string;
  produto_id: string | null;
  quantidade: number;
}

export interface PedidoEntrega {
  id: string;
  data_entrega: string;
  observacao: string | null;
}

export interface Pedido {
  id: string;
  numero_pedido: string;
  numero_nf: string | null;
  data_pedido: string;
  // Previsão de chegada na loja mandada pelo ERP (YYYY-MM-DD) — null quando não vem (docs/54 §4).
  data_previsao_entrega: string | null;
  observacao: string | null;
  // Calculado no backend, nunca gravado (docs/54 §4): ENTREGUE com entrega; ATRASADO se a
  // previsão já passou; senão A_CAMINHO.
  status: 'A_CAMINHO' | 'ATRASADO' | 'ENTREGUE';
  entregue_em: string | null;
  itens: PedidoItem[];
  entregas: PedidoEntrega[];
}

export async function listarPedidosDaLoja(
  pontoVendaUuid: string,
  page = 1,
): Promise<{ pedidos: Pedido[]; meta: PaginatedMeta }> {
  const { data } = await apiClient.get<{ pedidos: Pedido[]; meta: PaginatedMeta }>(
    `/pontos-venda/${pontoVendaUuid}/pedidos`,
    { params: { page } },
  );
  return data;
}

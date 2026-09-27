import type { PaginatedMeta, PedidoVenda, StatusPedidoVenda } from '../../types/api';
import { apiClient } from './client';

// Pedidos de Venda — ver docs/38-PEDIDO-VENDEDOR.md e App\Http\Controllers\PedidoVendaController.

export interface ResumoPedidosVenda {
  pendentes_autorizacao: number;
  rascunhos: number;
  aprovados: number;
  concluidos_mes: number;
  valor_concluido_mes: number;
}

export interface PedidosVendaListResponse {
  pedidos_venda: PedidoVenda[];
  meta: PaginatedMeta;
  resumo: ResumoPedidosVenda;
  permissoes: { criar: boolean; aprovar: boolean };
}

export interface FiltrosPedidosVenda {
  status?: StatusPedidoVenda[];
  vendedor_uuid?: string;
  ponto_venda_uuid?: string;
  data_inicio?: string;
  data_fim?: string;
  busca?: string;
  page?: number;
  per_page?: number;
}

export async function listarPedidosVenda(filtros: FiltrosPedidosVenda = {}): Promise<PedidosVendaListResponse> {
  const { data } = await apiClient.get<PedidosVendaListResponse>('/pedidos-venda', { params: filtros });
  return data;
}

export async function listarVendedoresPedidosVenda(): Promise<{ id: string; nome: string }[]> {
  const { data } = await apiClient.get<{ vendedores: { id: string; nome: string }[] }>('/pedidos-venda/vendedores');
  return data.vendedores;
}

// O que o usuário atual pode fazer AGORA com o pedido — calculado no backend.
export interface PermissoesPedidoVenda {
  editar: boolean;
  enviar: boolean;
  aprovar: boolean;
  concluir: boolean;
  cancelar: boolean;
  e_autor: boolean;
}

export interface PedidoVendaDetailResponse {
  pedido_venda: PedidoVenda;
  permissoes: PermissoesPedidoVenda;
}

export async function buscarPedidoVenda(uuid: string): Promise<PedidoVendaDetailResponse> {
  const { data } = await apiClient.get<PedidoVendaDetailResponse>(`/pedidos-venda/${uuid}`);
  return data;
}

export interface ItemPedidoVendaPayload {
  produto_uuid: string;
  quantidade: number;
  preco: number;
}

// Lista de itens sempre inteira — substitui a anterior.
export async function atualizarPedidoVenda(
  uuid: string,
  payload: { observacao?: string | null; itens: ItemPedidoVendaPayload[] },
): Promise<PedidoVendaDetailResponse> {
  const { data } = await apiClient.put<PedidoVendaDetailResponse>(`/pedidos-venda/${uuid}`, payload);
  return data;
}

type AcaoPedidoVenda = 'enviar' | 'aprovar' | 'rejeitar' | 'concluir' | 'cancelar';

export async function acaoPedidoVenda(
  uuid: string,
  acao: AcaoPedidoVenda,
  motivo?: string,
): Promise<PedidoVendaDetailResponse> {
  const { data } = await apiClient.post<PedidoVendaDetailResponse>(`/pedidos-venda/${uuid}/${acao}`, motivo ? { motivo } : {});
  return data;
}

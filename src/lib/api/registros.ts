import type { PaginatedMeta, RegistroLista } from '../../types/api';
import { apiClient } from './client';

export interface RegistrosFiltros {
  tipo_registro_uuid?: string;
  produto_auditoria_uuid?: string;
  ponto_venda_uuid?: string;
  rede_loja_uuid?: string;
  // Começo do código do cliente no ERP.
  codigo_externo?: string;
  vendedor_uuid?: string;
  data_inicio?: string;
  data_fim?: string;
  ruptura?: boolean;
  alerta_status?: 'aberto' | 'resolvido';
  page?: number;
}

export interface RegistrosListResponse {
  registros: RegistroLista[];
  meta: PaginatedMeta;
}

// Opções do filtro de vendedor — rota própria, não exige vendedores.gerenciar.
export async function listarVendedoresRegistros(): Promise<{ id: string; nome: string; codigo_externo: string | null }[]> {
  const { data } = await apiClient.get<{ vendedores: { id: string; nome: string; codigo_externo: string | null }[] }>('/registros/vendedores');
  return data.vendedores;
}

export async function listarRegistros(filtros: RegistrosFiltros = {}): Promise<RegistrosListResponse> {
  const { data } = await apiClient.get<RegistrosListResponse>('/registros', {
    params: { ...filtros, ruptura: filtros.ruptura === undefined ? undefined : filtros.ruptura ? 1 : 0 },
  });
  return data;
}

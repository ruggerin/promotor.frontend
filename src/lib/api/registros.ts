import type { PaginatedMeta, RegistroLista } from '../../types/api';
import { apiClient } from './client';

export interface RegistrosFiltros {
  tipo_registro_uuid?: string;
  produto_auditoria_uuid?: string;
  ponto_venda_uuid?: string;
  rede_loja_uuid?: string;
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

export async function listarRegistros(filtros: RegistrosFiltros = {}): Promise<RegistrosListResponse> {
  const { data } = await apiClient.get<RegistrosListResponse>('/registros', {
    params: { ...filtros, ruptura: filtros.ruptura === undefined ? undefined : filtros.ruptura ? 1 : 0 },
  });
  return data;
}

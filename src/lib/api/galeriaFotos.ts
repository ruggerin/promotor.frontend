import type { FotoGaleria, PaginatedMeta } from '../../types/api';
import { apiClient } from './client';

export interface GaleriaFotosFiltros {
  data_inicio?: string;
  data_fim?: string;
  tipo_registro_uuid?: string;
  departamento_uuid?: string;
  secao_uuid?: string;
  marca_uuid?: string;
  produto_auditoria_uuid?: string;
  ponto_venda_uuid?: string;
  rede_loja_uuid?: string;
  ramo_atividade_uuid?: string;
  usuario_uuid?: string;
  ruptura?: boolean;
  page?: number;
}

export interface GaleriaFotosListResponse {
  registros: FotoGaleria[];
  meta: PaginatedMeta;
}

export async function listarGaleriaFotos(filtros: GaleriaFotosFiltros = {}): Promise<GaleriaFotosListResponse> {
  const { data } = await apiClient.get<GaleriaFotosListResponse>('/galeria-fotos', {
    params: { ...filtros, ruptura: filtros.ruptura === undefined ? undefined : filtros.ruptura ? 1 : 0 },
  });
  return data;
}

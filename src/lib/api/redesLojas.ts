import type { PaginatedMeta, RedeLoja } from '../../types/api';
import { apiClient } from './client';

export interface RedesLojasListResponse {
  redes_lojas: RedeLoja[];
  meta: PaginatedMeta;
}

export interface RedesLojasListParams {
  ativo?: boolean;
  // Só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
  // Opt-in pra listar mais que os 15 padrão (capado em 200 no backend) — seletores que precisam
  // da lista inteira, ex. Plano de Ação.
  por_pagina?: number;
}

export async function listarRedesLojas(params: RedesLojasListParams = {}): Promise<RedesLojasListResponse> {
  const { data } = await apiClient.get<RedesLojasListResponse>('/redes-lojas', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      empresa_uuid: params.empresa_uuid,
      por_pagina: params.por_pagina,
    },
  });
  return data;
}

export interface RedeLojaPayload {
  descricao: string;
  ativo?: boolean;
}

export async function criarRedeLoja(payload: RedeLojaPayload): Promise<{ rede_loja: RedeLoja }> {
  const { data } = await apiClient.post<{ rede_loja: RedeLoja }>('/redes-lojas', payload);
  return data;
}

export async function atualizarRedeLoja(
  uuid: string,
  payload: Partial<RedeLojaPayload>,
): Promise<{ rede_loja: RedeLoja }> {
  const { data } = await apiClient.put<{ rede_loja: RedeLoja }>(`/redes-lojas/${uuid}`, payload);
  return data;
}

export async function desativarRedeLoja(uuid: string): Promise<void> {
  await apiClient.delete(`/redes-lojas/${uuid}`);
}

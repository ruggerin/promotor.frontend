import type { MotivoResolucaoAlerta } from '../../types/api';
import { apiClient } from './client';

export interface MotivosResolucaoAlertaListResponse {
  motivos_resolucao_alerta: MotivoResolucaoAlerta[];
}

export interface MotivosResolucaoAlertaListParams {
  ativo?: boolean;
}

export async function listarMotivosResolucaoAlerta(
  params: MotivosResolucaoAlertaListParams = {},
): Promise<MotivosResolucaoAlertaListResponse> {
  const { data } = await apiClient.get<MotivosResolucaoAlertaListResponse>('/motivos-resolucao-alerta', {
    params: { ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0 },
  });
  return data;
}

export interface MotivoResolucaoAlertaPayload {
  descricao: string;
  ativo?: boolean;
}

export async function criarMotivoResolucaoAlerta(
  payload: MotivoResolucaoAlertaPayload,
): Promise<{ motivo_resolucao_alerta: MotivoResolucaoAlerta }> {
  const { data } = await apiClient.post<{ motivo_resolucao_alerta: MotivoResolucaoAlerta }>(
    '/motivos-resolucao-alerta',
    payload,
  );
  return data;
}

export async function atualizarMotivoResolucaoAlerta(
  uuid: string,
  payload: Partial<MotivoResolucaoAlertaPayload>,
): Promise<{ motivo_resolucao_alerta: MotivoResolucaoAlerta }> {
  const { data } = await apiClient.put<{ motivo_resolucao_alerta: MotivoResolucaoAlerta }>(
    `/motivos-resolucao-alerta/${uuid}`,
    payload,
  );
  return data;
}

export async function desativarMotivoResolucaoAlerta(uuid: string): Promise<void> {
  await apiClient.delete(`/motivos-resolucao-alerta/${uuid}`);
}

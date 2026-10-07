import type { MotivoNaoExecucao } from '../../types/api';
import { apiClient } from './client';

export interface MotivosNaoExecucaoListResponse {
  motivos_nao_execucao: MotivoNaoExecucao[];
}

export interface MotivosNaoExecucaoListParams {
  ativo?: boolean;
}

export async function listarMotivosNaoExecucao(
  params: MotivosNaoExecucaoListParams = {},
): Promise<MotivosNaoExecucaoListResponse> {
  const { data } = await apiClient.get<MotivosNaoExecucaoListResponse>('/motivos-nao-execucao', {
    params: { ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0 },
  });
  return data;
}

export interface MotivoNaoExecucaoPayload {
  descricao: string;
  ativo?: boolean;
}

export async function criarMotivoNaoExecucao(
  payload: MotivoNaoExecucaoPayload,
): Promise<{ motivo_nao_execucao: MotivoNaoExecucao }> {
  const { data } = await apiClient.post<{ motivo_nao_execucao: MotivoNaoExecucao }>(
    '/motivos-nao-execucao',
    payload,
  );
  return data;
}

export async function atualizarMotivoNaoExecucao(
  uuid: string,
  payload: Partial<MotivoNaoExecucaoPayload>,
): Promise<{ motivo_nao_execucao: MotivoNaoExecucao }> {
  const { data } = await apiClient.put<{ motivo_nao_execucao: MotivoNaoExecucao }>(
    `/motivos-nao-execucao/${uuid}`,
    payload,
  );
  return data;
}

export async function desativarMotivoNaoExecucao(uuid: string): Promise<void> {
  await apiClient.delete(`/motivos-nao-execucao/${uuid}`);
}

import type { Parametro } from '../../types/api';
import { apiClient } from './client';

export interface ParametrosListResponse {
  parametros: Parametro[];
}

export async function listarParametros(): Promise<ParametrosListResponse> {
  const { data } = await apiClient.get<ParametrosListResponse>('/parametros');
  return data;
}

export interface ParametroPayload {
  chave: string;
  valor: string;
  descricao?: string | null;
}

export async function criarParametro(payload: ParametroPayload): Promise<{ parametro: Parametro }> {
  const { data } = await apiClient.post<{ parametro: Parametro }>('/parametros', payload);
  return data;
}

export async function atualizarParametro(
  uuid: string,
  payload: Partial<ParametroPayload> & { ativo?: boolean },
): Promise<{ parametro: Parametro }> {
  const { data } = await apiClient.put<{ parametro: Parametro }>(`/parametros/${uuid}`, payload);
  return data;
}

export async function desativarParametro(uuid: string): Promise<void> {
  await apiClient.delete(`/parametros/${uuid}`);
}

const VALORES_VERDADEIROS = ['1', 'true', 'sim', 'yes'];
const POLLING_ATIVIDADES_PADRAO_MS = 30_000;

// Intervalo de atualização do Painel de Atividades — ver docs/19-PAINEL-ATIVIDADES.md.
// Ausente/inativo/valor inválido = default 30s (mesmo raciocínio de fallback de
// CHECKIN_RAIO_METROS no mobile).
export async function buscarPollingAtividadesMs(): Promise<number> {
  const { parametros } = await listarParametros();
  const parametro = parametros.find((p) => p.chave === 'ATIVIDADES_POLLING_SEGUNDOS');
  if (!parametro || !parametro.ativo) return POLLING_ATIVIDADES_PADRAO_MS;

  const segundos = Number(parametro.valor);
  return Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : POLLING_ATIVIDADES_PADRAO_MS;
}

// Se alertas do Painel de Atividades exigem resolução manual (aba "Pendências" + botão
// Resolver) ou são só informativos — ver docs/19-PAINEL-ATIVIDADES.md. Ausente/inativo = false
// (default conservador, mesma convenção de REGISTRO_CANCELAMENTO_PERMITIDO).
export async function buscarAlertaRequerResolucao(): Promise<boolean> {
  const { parametros } = await listarParametros();
  const parametro = parametros.find((p) => p.chave === 'ATIVIDADES_ALERTA_REQUER_RESOLUCAO');
  if (!parametro || !parametro.ativo) return false;
  return VALORES_VERDADEIROS.includes(parametro.valor.toLowerCase());
}

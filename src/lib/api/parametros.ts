import type { Parametro } from '../../types/api';
import { apiClient } from './client';

export interface ParametrosListResponse {
  parametros: Parametro[];
}

export interface ListarParametrosFiltros {
  // Suporte SUPERADMIN — ver docs/02-API-BACKEND.md#multi-tenancy-e-isolamento-de-dados.
  empresa_uuid?: string;
}

export async function listarParametros(filtros: ListarParametrosFiltros = {}): Promise<ParametrosListResponse> {
  const { data } = await apiClient.get<ParametrosListResponse>('/parametros', { params: filtros });
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

// Omitir domingo/sábado do quadro semanal, do mapa e da impressão de rota do Planejador de
// Visitas — ver docs/10-AGENDA-VISITA.md §8. Ausente/inativo = false (mostra os 7 dias, mesmo
// default conservador de ATIVIDADES_ALERTA_REQUER_RESOLUCAO).
export async function buscarOmitirDomingoPlanejador(): Promise<boolean> {
  const { parametros } = await listarParametros();
  const parametro = parametros.find((p) => p.chave === 'PLANEJADOR_VISITAS_OMITIR_DOMINGO');
  if (!parametro || !parametro.ativo) return false;
  return VALORES_VERDADEIROS.includes(parametro.valor.toLowerCase());
}

export async function buscarOmitirSabadoPlanejador(): Promise<boolean> {
  const { parametros } = await listarParametros();
  const parametro = parametros.find((p) => p.chave === 'PLANEJADOR_VISITAS_OMITIR_SABADO');
  if (!parametro || !parametro.ativo) return false;
  return VALORES_VERDADEIROS.includes(parametro.valor.toLowerCase());
}

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

// Tela de Configurações (docs/62): catálogo com metadados + valor efetivo da empresa.
export type TipoConfiguracao = 'bool' | 'numero' | 'numero_ou_zero' | 'numero_ou_sem_limite' | 'lista' | 'hora';

export interface ItemConfiguracao {
  chave: string;
  area: string;
  rotulo: string;
  ajuda: string;
  descricao_tecnica: string;
  tipo: TipoConfiguracao;
  unidade: string | null;
  min: number | null;
  max: number | null;
  opcoes: { valor: string; rotulo: string }[] | null;
  depende_de: { chave: string; motivo: string } | null;
  grupo: string | null;
  // 'sem_limite': desativar a linha é o próprio valor (CHECKIN_RAIO_METROS).
  ativo_significa: 'sem_limite' | null;
  padrao: string;
  valor: string;
  ativo: boolean;
  cadastrado: boolean;
  alterado_do_padrao: boolean;
}

export interface AreaConfiguracao {
  chave: string;
  rotulo: string;
  ajuda: string;
  itens: ItemConfiguracao[];
}

export interface AlteracaoConfiguracao {
  chave: string;
  valor?: string;
  ativo?: boolean;
}

export async function buscarCatalogoConfiguracoes(): Promise<{ areas: AreaConfiguracao[] }> {
  const { data } = await apiClient.get<{ areas: AreaConfiguracao[] }>('/parametros/catalogo');
  return data;
}

export async function salvarConfiguracoesLote(alteracoes: AlteracaoConfiguracao[]): Promise<{ areas: AreaConfiguracao[] }> {
  const { data } = await apiClient.put<{ areas: AreaConfiguracao[] }>('/parametros/lote', { alteracoes });
  return data;
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

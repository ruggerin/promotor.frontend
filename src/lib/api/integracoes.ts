import { apiClient } from './client';

// docs/96 — tokens de API pro ERP/BI do cliente. Rotas só de ADMIN (a API responde 403 pros outros).

export type SituacaoIntegracao = 'ativa' | 'vencendo' | 'vencida' | 'pausada' | 'revogada';

export interface TokenResumo {
  prefixo: string;
  expira_em: string | null;
  antigo: boolean;
}

export interface Integracao {
  uuid: string;
  nome: string;
  descricao: string | null;
  escopos: string[];
  ips_permitidos: string[];
  limite_por_minuto: number;
  situacao: SituacaoIntegracao;
  validade: string | null;
  criada_por: string | null;
  created_at: string;
  revogada_em: string | null;
  revogada_por: string | null;
  revogada_motivo: string | null;
  ultimo_uso_em: string | null;
  ultimo_ip: string | null;
  tokens: TokenResumo[];
  uso_hoje?: { requisicoes: number; erros: number };
}

export interface EscopoCatalogo {
  valor: string;
  recurso: string;
  acao: 'ler' | 'escrever';
  rotulo: string;
  descricao: string | null;
  disponivel: boolean;
}

export interface CatalogoEscopos {
  escopos: EscopoCatalogo[];
  validades: number[];
  limite_padrao: number;
  eventos: EventoCatalogo[];
}

export interface RequisicaoIntegracao {
  metodo: string;
  rota: string;
  status: number;
  ip: string | null;
  duracao_ms: number;
  registros: number | null;
  erro: string | null;
  created_at: string;
}

export interface IntegracaoPayload {
  nome: string;
  descricao?: string | null;
  escopos: string[];
  ips_permitidos?: string[];
  limite_por_minuto?: number;
  /** null = sem validade. */
  validade_dias?: number | null;
}

export interface IntegracaoComToken {
  integracao: Integracao;
  /** Texto puro do token: só vem aqui, uma vez. */
  token: string;
}

export async function buscarCatalogoEscopos(): Promise<CatalogoEscopos> {
  const { data } = await apiClient.get<CatalogoEscopos>('/integracoes/escopos');
  return data;
}

export async function listarIntegracoes(): Promise<Integracao[]> {
  const { data } = await apiClient.get<{ integracoes: Integracao[] }>('/integracoes');
  return data.integracoes;
}

export async function buscarIntegracao(uuid: string): Promise<Integracao> {
  const { data } = await apiClient.get<{ integracao: Integracao }>(`/integracoes/${uuid}`);
  return data.integracao;
}

export async function criarIntegracao(payload: IntegracaoPayload): Promise<IntegracaoComToken> {
  const { data } = await apiClient.post<IntegracaoComToken>('/integracoes', payload);
  return data;
}

export async function atualizarIntegracao(uuid: string, payload: Partial<Omit<IntegracaoPayload, 'validade_dias'>>): Promise<Integracao> {
  const { data } = await apiClient.put<{ integracao: Integracao }>(`/integracoes/${uuid}`, payload);
  return data.integracao;
}

export async function pausarIntegracao(uuid: string): Promise<Integracao> {
  const { data } = await apiClient.post<{ integracao: Integracao }>(`/integracoes/${uuid}/pausar`);
  return data.integracao;
}

export async function reativarIntegracao(uuid: string): Promise<Integracao> {
  const { data } = await apiClient.post<{ integracao: Integracao }>(`/integracoes/${uuid}/reativar`);
  return data.integracao;
}

export async function rotacionarToken(uuid: string, validadeDias: number | null): Promise<IntegracaoComToken & { antigo_valido_ate: string }> {
  const { data } = await apiClient.post<IntegracaoComToken & { antigo_valido_ate: string }>(`/integracoes/${uuid}/rotacionar`, {
    validade_dias: validadeDias,
  });
  return data;
}

export async function revogarIntegracao(uuid: string, motivo: string): Promise<Integracao> {
  const { data } = await apiClient.post<{ integracao: Integracao }>(`/integracoes/${uuid}/revogar`, { motivo });
  return data.integracao;
}

export async function listarRequisicoes(uuid: string, soErros: boolean): Promise<RequisicaoIntegracao[]> {
  const { data } = await apiClient.get<{ requisicoes: RequisicaoIntegracao[] }>(`/integracoes/${uuid}/requisicoes`, {
    params: { so_erros: soErros ? 1 : undefined, per_page: 50 },
  });
  return data.requisicoes;
}

// ── Webhooks (docs/96 Fase 4) ───────────────────────────────────────────────────────────────

export interface EventoCatalogo {
  valor: string;
  rotulo: string;
  /** Permissão que a integração precisa ter pra receber o evento. */
  escopo: string;
}

export interface Webhook {
  uuid: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  falhas_seguidas: number;
  desativado_em: string | null;
  desativado_motivo: string | null;
  ultima_entrega_em: string | null;
  pendentes: number | null;
  created_at: string;
}

export type SituacaoEntrega = 'entregue' | 'abandonada' | 'tentando' | 'na_fila';

export interface EntregaWebhook {
  uuid: string;
  evento: string;
  situacao: SituacaoEntrega;
  tentativas: number;
  ultimo_status: number | null;
  ultimo_erro: string | null;
  ultima_duracao_ms: number | null;
  proxima_tentativa_em: string | null;
  entregue_em: string | null;
  created_at: string;
}

export async function listarWebhooks(integracao: string): Promise<{ webhooks: Webhook[]; eventos_permitidos: string[] }> {
  const { data } = await apiClient.get<{ webhooks: Webhook[]; eventos_permitidos: string[] }>(`/integracoes/${integracao}/webhooks`);
  return data;
}

export async function criarWebhook(integracao: string, payload: { url: string; eventos: string[] }): Promise<{ webhook: Webhook; segredo: string }> {
  const { data } = await apiClient.post<{ webhook: Webhook; segredo: string }>(`/integracoes/${integracao}/webhooks`, payload);
  return data;
}

export async function atualizarWebhook(integracao: string, webhook: string, payload: Partial<{ url: string; eventos: string[]; ativo: boolean }>): Promise<Webhook> {
  const { data } = await apiClient.put<{ webhook: Webhook }>(`/integracoes/${integracao}/webhooks/${webhook}`, payload);
  return data.webhook;
}

export async function excluirWebhook(integracao: string, webhook: string): Promise<void> {
  await apiClient.delete(`/integracoes/${integracao}/webhooks/${webhook}`);
}

export async function novoSegredoWebhook(integracao: string, webhook: string): Promise<{ webhook: Webhook; segredo: string }> {
  const { data } = await apiClient.post<{ webhook: Webhook; segredo: string }>(`/integracoes/${integracao}/webhooks/${webhook}/segredo`);
  return data;
}

export async function testarWebhook(integracao: string, webhook: string): Promise<{ ok: boolean; entrega: EntregaWebhook }> {
  const { data } = await apiClient.post<{ ok: boolean; entrega: EntregaWebhook }>(`/integracoes/${integracao}/webhooks/${webhook}/testar`);
  return data;
}

export async function listarEntregasWebhook(integracao: string, webhook: string): Promise<EntregaWebhook[]> {
  const { data } = await apiClient.get<{ entregas: EntregaWebhook[] }>(`/integracoes/${integracao}/webhooks/${webhook}/entregas`, { params: { limite: 20 } });
  return data.entregas;
}

export async function reenviarEntrega(integracao: string, webhook: string, entrega: string): Promise<void> {
  await apiClient.post(`/integracoes/${integracao}/webhooks/${webhook}/entregas/${entrega}/reenviar`);
}

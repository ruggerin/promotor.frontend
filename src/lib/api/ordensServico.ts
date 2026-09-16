import type { OrdemServico, PaginatedMeta, PrioridadeVisita, StatusOrdemServico } from '../../types/api';
import { apiClient } from './client';

export interface OrdensServicoListParams {
  page?: number;
  // Um valor único ou vários de uma vez (ex. o painel de aprovação busca os três status de
  // solicitação juntos) — ver docs/13-AGENDA-MOBILE-E-AUTONOMIA.md §6.2.
  status?: StatusOrdemServico | StatusOrdemServico[];
  ponto_venda_uuid?: string;
  usuario_uuid?: string;
}

export interface OrdensServicoListResponse {
  ordens_servico: OrdemServico[];
  meta: PaginatedMeta;
}

export async function listarOrdensServico(params: OrdensServicoListParams = {}): Promise<OrdensServicoListResponse> {
  const { data } = await apiClient.get<OrdensServicoListResponse>('/ordens-servico', {
    params: {
      page: params.page,
      status: params.status,
      ponto_venda_uuid: params.ponto_venda_uuid,
      usuario_uuid: params.usuario_uuid,
    },
  });
  return data;
}

export interface OrdemServicoFormularioPayload {
  tipo_registro_uuid: string;
  obrigatorio?: boolean;
  calcula_percentual_compliance?: boolean;
}

export interface OrdemServicoPayload {
  ponto_venda_uuid: string;
  // null/ausente = fila aberta, qualquer promotor da empresa pode atender.
  usuario_uuid?: string | null;
  tipo_visita_uuid?: string | null;
  objetivo_visita_uuid?: string | null;
  prioridade?: PrioridadeVisita;
  horario_previsto?: string | null;
  obrigatoria?: boolean;
  prazo_inicio: string;
  prazo_fim: string;
  observacao?: string | null;
  // Vínculo direto de formulário nesta OS avulsa, sem Direcionamento nenhum por trás — ver
  // docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md §7.2. Lista completa, sempre substitui a existente.
  formularios?: OrdemServicoFormularioPayload[];
}

export async function criarOrdemServico(payload: OrdemServicoPayload): Promise<{ ordem_servico: OrdemServico }> {
  const { data } = await apiClient.post<{ ordem_servico: OrdemServico }>('/ordens-servico', payload);
  return data;
}

export async function atualizarOrdemServico(
  uuid: string,
  payload: Partial<OrdemServicoPayload> & { status?: 'CANCELADA' },
): Promise<{ ordem_servico: OrdemServico }> {
  const { data } = await apiClient.put<{ ordem_servico: OrdemServico }>(`/ordens-servico/${uuid}`, payload);
  return data;
}

// Painel de aprovação (docs/13-AGENDA-MOBILE-E-AUTONOMIA.md §6.2) — decide uma solicitação
// pendente criada pelo promotor (AGUARDANDO_APROVACAO/REAGENDAMENTO_SOLICITADO/
// CANCELAMENTO_SOLICITADO). O resultado exato depende de qual dos três status a OS está.
export async function aprovarOrdemServico(uuid: string): Promise<{ ordem_servico: OrdemServico }> {
  const { data } = await apiClient.post<{ ordem_servico: OrdemServico }>(`/ordens-servico/${uuid}/aprovar`);
  return data;
}

export async function rejeitarOrdemServico(uuid: string, motivo?: string): Promise<{ ordem_servico: OrdemServico }> {
  const { data } = await apiClient.post<{ ordem_servico: OrdemServico }>(`/ordens-servico/${uuid}/rejeitar`, {
    motivo: motivo || undefined,
  });
  return data;
}

// Cancelamento em lote, independente de Direcionamento — checkbox na listagem + "cancelar
// selecionadas" (docs/25 §2 decisão 7). Só cancela as que ainda estão PENDENTE.
export async function cancelarOrdensServicoEmLote(uuids: string[]): Promise<{ canceladas: number }> {
  const { data } = await apiClient.post<{ canceladas: number }>('/ordens-servico/cancelar-em-lote', { uuids });
  return data;
}

import type { AgendaVisita, PaginatedMeta, PrioridadeVisita, RecorrenciaAgendaVisita } from '../../types/api';
import { apiClient } from './client';

export interface AgendasVisitaListParams {
  page?: number;
  ativo?: boolean;
  ponto_venda_uuid?: string;
  usuario_uuid?: string;
  // Opt-in pra listar mais que os 15 padrão de uma vez (capado em 200 no backend) — usado pelo
  // Planejador de Visitas, que precisa da agenda inteira de um promotor. Ver
  // AgendaVisitaController::index.
  por_pagina?: number;
}

export interface AgendasVisitaListResponse {
  agendas_visita: AgendaVisita[];
  meta: PaginatedMeta;
}

export async function listarAgendasVisita(params: AgendasVisitaListParams = {}): Promise<AgendasVisitaListResponse> {
  const { data } = await apiClient.get<AgendasVisitaListResponse>('/agendas-visita', {
    params: {
      page: params.page,
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      ponto_venda_uuid: params.ponto_venda_uuid,
      usuario_uuid: params.usuario_uuid,
      por_pagina: params.por_pagina,
    },
  });
  return data;
}

export interface AgendaVisitaPayload {
  ponto_venda_uuid: string;
  usuario_uuid: string;
  tipo_visita_uuid?: string | null;
  objetivo_visita_uuid?: string | null;
  prioridade?: PrioridadeVisita;
  recorrencia: RecorrenciaAgendaVisita;
  dia_semana?: number | null;
  data?: string | null;
  horario_previsto?: string | null;
  obrigatoria?: boolean;
  observacao?: string | null;
}

export async function criarAgendaVisita(payload: AgendaVisitaPayload): Promise<{ agenda_visita: AgendaVisita }> {
  const { data } = await apiClient.post<{ agenda_visita: AgendaVisita }>('/agendas-visita', payload);
  return data;
}

export async function atualizarAgendaVisita(
  uuid: string,
  payload: Partial<AgendaVisitaPayload> & { ativo?: boolean },
): Promise<{ agenda_visita: AgendaVisita }> {
  const { data } = await apiClient.put<{ agenda_visita: AgendaVisita }>(`/agendas-visita/${uuid}`, payload);
  return data;
}

export async function desativarAgendaVisita(uuid: string): Promise<void> {
  await apiClient.delete(`/agendas-visita/${uuid}`);
}

// Relatório de Rota impresso (PDF, ver docs/10-AGENDA-VISITA.md §9) — rota autenticada atrás de
// application/pdf, não dá pra usar um <a href> direto (não manda o header Authorization). Mesmo
// padrão de blob autenticado já usado pra foto de usuário/fachada de PDV, ver
// AutenticatedImage.tsx — só que aqui é download de uma vez, não exibição inline.
export async function baixarRelatorioRota(usuarioUuid: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>('/agendas-visita/relatorio-rota', {
    params: { usuario_uuid: usuarioUuid },
    responseType: 'blob',
  });
  return data;
}

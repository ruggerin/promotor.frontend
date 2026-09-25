import type { PaginatedMeta, StatusVisita, Visita } from '../../types/api';
import { apiClient } from './client';

export interface VisitasFiltros {
  data_inicio?: string;
  data_fim?: string;
  usuario_uuid?: string;
  ponto_venda_uuid?: string;
  status?: StatusVisita;
  // Drill-down do "Rupturas por SKU" da Operação do Dia — ver docs/32-PAINEL-OPERACAO-DO-DIA.md.
  produto_auditoria_uuid?: string;
  ruptura?: boolean;
  page?: number;
}

export interface VisitasListResponse {
  visitas: Visita[];
  meta: PaginatedMeta;
}

export async function listarVisitas(filtros: VisitasFiltros = {}): Promise<VisitasListResponse> {
  const { data } = await apiClient.get<VisitasListResponse>('/visitas', { params: filtros });
  return data;
}

// raio_checkin_metros = raio ATUAL da empresa (não gravado por visita); null = sem limite.
export async function buscarVisita(uuid: string): Promise<{ visita: Visita; raio_checkin_metros?: number | null }> {
  const { data } = await apiClient.get<{ visita: Visita; raio_checkin_metros?: number | null }>(`/visitas/${uuid}`);
  return data;
}

// Intervenção administrativa (exige permissão visitas.intervir) — ver
// docs/15-INTERVENCAO-ADMINISTRATIVA-VISITA.md. As três exigem `motivo`.

export async function cancelarVisita(uuid: string, motivo: string): Promise<{ visita: Visita }> {
  const { data } = await apiClient.post<{ visita: Visita }>(`/visitas/${uuid}/cancelar`, { motivo });
  return data;
}

export async function forcarCheckoutVisita(
  uuid: string,
  payload: { motivo: string; fim_data: string },
): Promise<{ visita: Visita }> {
  const { data } = await apiClient.post<{ visita: Visita }>(`/visitas/${uuid}/forcar-checkout`, payload);
  return data;
}

export async function corrigirHorariosVisita(
  uuid: string,
  payload: { motivo: string; inicio_data?: string; fim_data?: string },
): Promise<{ visita: Visita }> {
  const { data } = await apiClient.patch<{ visita: Visita }>(`/visitas/${uuid}/horarios`, payload);
  return data;
}

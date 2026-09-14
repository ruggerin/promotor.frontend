import type { AtividadeEvento, VisitaRegistro } from '../../types/api';
import { apiClient } from './client';

export interface AtividadesFiltros {
  data_inicio?: string;
  data_fim?: string;
  usuario_uuid?: string;
  ponto_venda_uuid?: string;
  tipo_registro_uuid?: string;
  pendentes?: boolean;
}

export async function listarAtividades(filtros: AtividadesFiltros = {}): Promise<AtividadeEvento[]> {
  const { data } = await apiClient.get<{ eventos: AtividadeEvento[] }>('/atividades', { params: filtros });
  return data.eventos;
}

export async function resolverAlerta(visitaUuid: string, registroUuid: string): Promise<{ registro: VisitaRegistro }> {
  const { data } = await apiClient.post<{ registro: VisitaRegistro }>(
    `/visitas/${visitaUuid}/registros/${registroUuid}/resolver-alerta`,
  );
  return data;
}

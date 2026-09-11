import type { Perfil, Permissao } from '../../types/api';
import { apiClient } from './client';

export interface PerfisListResponse {
  perfis: Perfil[];
}

export async function listarPerfis(): Promise<PerfisListResponse> {
  const { data } = await apiClient.get<PerfisListResponse>('/perfis');
  return data;
}

export interface PerfilPayload {
  nome: string;
  descricao?: string | null;
  permissoes?: Permissao[];
  ativo?: boolean;
}

export async function criarPerfil(payload: PerfilPayload): Promise<{ perfil: Perfil }> {
  const { data } = await apiClient.post<{ perfil: Perfil }>('/perfis', payload);
  return data;
}

export async function atualizarPerfil(uuid: string, payload: Partial<PerfilPayload>): Promise<{ perfil: Perfil }> {
  const { data } = await apiClient.put<{ perfil: Perfil }>(`/perfis/${uuid}`, payload);
  return data;
}

export async function desativarPerfil(uuid: string): Promise<void> {
  await apiClient.delete(`/perfis/${uuid}`);
}

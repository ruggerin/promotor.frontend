import type { EventoHistorico, PaginatedMeta, TipoEventoHistorico, UserType, Usuario } from '../../types/api';
import { apiClient } from './client';

export interface UsuariosListParams {
  page?: number;
  ativo?: boolean;
  user_type?: UserType;
  // Só tem efeito pra quem chama como SUPERADMIN (ver docs/02-API-BACKEND.md) — ADMIN/GESTOR já
  // são restritos à própria empresa pelo backend, então passar isso pra eles é inofensivo mas
  // inútil.
  empresa_uuid?: string;
  // Opt-in pra listar mais que os 15 padrão de uma vez (capado em 200 no backend) — usado pelo
  // Planejador de Visitas, que precisa de todos os promotores no seletor. Ver
  // UsuarioController::index.
  por_pagina?: number;
}

export interface UsuariosListResponse {
  usuarios: Usuario[];
  meta: PaginatedMeta;
}

export async function listarUsuarios(params: UsuariosListParams = {}): Promise<UsuariosListResponse> {
  const { data } = await apiClient.get<UsuariosListResponse>('/usuarios', {
    params: {
      page: params.page,
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      user_type: params.user_type,
      empresa_uuid: params.empresa_uuid,
      por_pagina: params.por_pagina,
    },
  });
  return data;
}

export async function buscarUsuario(uuid: string): Promise<{ usuario: Usuario }> {
  const { data } = await apiClient.get<{ usuario: Usuario }>(`/usuarios/${uuid}`);
  return data;
}

export interface CriarUsuarioPayload {
  nome: string;
  email: string;
  senha: string;
  user_type: UserType;
  perfil_uuid?: string | null;
  // Só faz sentido pra PROMOTOR — ver docs/08-CENTRO-DE-CUSTO.md.
  centro_custo_uuid?: string | null;
  // Só SUPERADMIN manda isso (escolhe em qual empresa criar) — obrigatório pra ele, proibido
  // pros outros, ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
}

export async function criarUsuario(payload: CriarUsuarioPayload): Promise<{ usuario: Usuario }> {
  const { data } = await apiClient.post<{ usuario: Usuario }>('/usuarios', payload);
  return data;
}

export interface AtualizarUsuarioPayload {
  nome?: string;
  email?: string;
  senha?: string;
  user_type?: UserType;
  perfil_uuid?: string | null;
  centro_custo_uuid?: string | null;
  ativo?: boolean;
}

export async function atualizarUsuario(
  uuid: string,
  payload: AtualizarUsuarioPayload,
): Promise<{ usuario: Usuario }> {
  const { data } = await apiClient.put<{ usuario: Usuario }>(`/usuarios/${uuid}`, payload);
  return data;
}

export async function desativarUsuario(uuid: string): Promise<void> {
  await apiClient.delete(`/usuarios/${uuid}`);
}

// Desvincula o dispositivo atual do promotor e derruba a sessão dele (perda/roubo de
// aparelho, troca de celular) — não precisa esperar ele logar de novo pra liberar a licença.
export async function revogarDispositivoUsuario(uuid: string): Promise<void> {
  await apiClient.delete(`/usuarios/${uuid}/dispositivo`);
}

export interface HistoricoUsuarioResponse {
  eventos: EventoHistorico[];
  meta: PaginatedMeta;
}

export interface HistoricoUsuarioParams {
  page?: number;
  // Restringe quais tipos de evento voltam (ex.: só VISITA_INICIO/VISITA_FIM na aba
  // "Localização") — sem isso, vêm todos.
  tipos?: TipoEventoHistorico[];
  // Formato YYYY-MM-DD, inclusive dos dois lados — ver docs/02-API-BACKEND.md.
  dataInicio?: string;
  dataFim?: string;
}

export async function buscarHistoricoUsuario(
  uuid: string,
  params: HistoricoUsuarioParams = {},
): Promise<HistoricoUsuarioResponse> {
  const { data } = await apiClient.get<HistoricoUsuarioResponse>(`/usuarios/${uuid}/historico`, {
    params: {
      page: params.page ?? 1,
      tipos: params.tipos?.join(',') || undefined,
      data_inicio: params.dataInicio || undefined,
      data_fim: params.dataFim || undefined,
    },
  });
  return data;
}

import type { PreferenciaTema, Usuario } from '../../types/api';
import { apiClient } from './client';

export interface LoginPayload {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const { data } = await apiClient.post<LoginResponse>('/auth/login', payload);
  return data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function me(): Promise<{ usuario: Usuario }> {
  const { data } = await apiClient.get<{ usuario: Usuario }>('/auth/me');
  return data;
}

/** Preferências do próprio usuário (docs/65) — hoje só o tema do admin. */
export async function atualizarPreferencias(preferencias: { tema: PreferenciaTema }): Promise<{ usuario: Usuario }> {
  const { data } = await apiClient.put<{ usuario: Usuario }>('/auth/me/preferencias', preferencias);
  return data;
}

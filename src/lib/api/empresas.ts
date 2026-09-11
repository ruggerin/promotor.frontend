import type { Empresa, EmpresaUso, PlanoEmpresa, Usuario } from '../../types/api';
import { apiClient } from './client';

export interface EmpresasListResponse {
  empresas: Empresa[];
}

// Tudo abaixo é restrito a SUPERADMIN (ver docs/02-API-BACKEND.md).
export async function listarEmpresasSuperadmin(): Promise<EmpresasListResponse> {
  const { data } = await apiClient.get<EmpresasListResponse>('/superadmin/empresas');
  return data;
}

export async function buscarEmpresaSuperadmin(uuid: string): Promise<{ empresa: Empresa; uso: EmpresaUso }> {
  const { data } = await apiClient.get<{ empresa: Empresa; uso: EmpresaUso }>(`/superadmin/empresas/${uuid}`);
  return data;
}

export interface CriarEmpresaPayload {
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  plano: PlanoEmpresa;
  limite_usuarios?: number | null;
  limite_pontos_venda?: number | null;
  limite_licencas?: number | null;
  admin_nome: string;
  admin_email: string;
  admin_senha: string;
}

export async function criarEmpresaSuperadmin(
  payload: CriarEmpresaPayload,
): Promise<{ empresa: Empresa; usuario: Usuario }> {
  const { data } = await apiClient.post<{ empresa: Empresa; usuario: Usuario }>('/superadmin/empresas', payload);
  return data;
}

export interface AtualizarEmpresaPayload {
  razao_social?: string;
  nome_fantasia?: string;
  cnpj?: string;
  plano?: PlanoEmpresa;
  limite_usuarios?: number | null;
  limite_pontos_venda?: number | null;
  limite_licencas?: number | null;
  ativo?: boolean;
}

export async function atualizarEmpresaSuperadmin(
  uuid: string,
  payload: AtualizarEmpresaPayload,
): Promise<{ empresa: Empresa }> {
  const { data } = await apiClient.put<{ empresa: Empresa }>(`/superadmin/empresas/${uuid}`, payload);
  return data;
}

// "Bloquear" — soft delete (ativo=false) + revoga tokens de todos os usuários da empresa na
// hora. Reativar é PUT com { ativo: true }, não tem endpoint de "unblock" separado.
export async function bloquearEmpresaSuperadmin(uuid: string): Promise<void> {
  await apiClient.delete(`/superadmin/empresas/${uuid}`);
}

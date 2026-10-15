import type { PaginatedMeta, Supervisor, Vendedor, VendedorDaLoja } from '../../types/api';
import { apiClient } from './client';

// Vendedores e supervisores espelhados do ERP (docs/73). Leitura e edição pedem
// `vendedores.gerenciar`; a edição só aceita contato e vínculo com usuário (o resto é do ERP).

export interface FiltrosEquipe {
  page?: number;
  busca?: string;
  ativo?: boolean;
}

export interface FiltrosVendedores extends FiltrosEquipe {
  supervisor_uuid?: string;
  sem_supervisor?: boolean;
}

export interface ContatoEquipe {
  telefone?: string | null;
  email?: string | null;
  usuario_uuid?: string | null;
}

const parametros = (f: FiltrosEquipe) => ({
  page: f.page,
  busca: f.busca || undefined,
  ativo: f.ativo === undefined ? undefined : f.ativo ? 1 : 0,
});

export async function listarSupervisores(f: FiltrosEquipe = {}): Promise<{ supervisores: Supervisor[]; meta: PaginatedMeta }> {
  const { data } = await apiClient.get('/supervisores', { params: parametros(f) });
  return data;
}

export async function listarVendedores(f: FiltrosVendedores = {}): Promise<{ vendedores: Vendedor[]; meta: PaginatedMeta }> {
  const { data } = await apiClient.get('/vendedores', {
    params: { ...parametros(f), supervisor_uuid: f.supervisor_uuid, sem_supervisor: f.sem_supervisor ? 1 : undefined },
  });
  return data;
}

export async function atualizarSupervisor(id: string, dados: ContatoEquipe): Promise<Supervisor> {
  const { data } = await apiClient.put<{ supervisor: Supervisor }>(`/supervisores/${id}`, dados);
  return data.supervisor;
}

export async function atualizarVendedor(id: string, dados: ContatoEquipe): Promise<Vendedor> {
  const { data } = await apiClient.put<{ vendedor: Vendedor }>(`/vendedores/${id}`, dados);
  return data.vendedor;
}

// Carteira (docs/73 §11.1): vínculo 1 a 1 pela tela da loja. Devolve a carteira atualizada.
export async function vincularVendedorLoja(pontoVendaId: string, vendedorId: string): Promise<VendedorDaLoja[]> {
  const { data } = await apiClient.post<{ vendedores: VendedorDaLoja[] }>(`/pontos-venda/${pontoVendaId}/vendedores/${vendedorId}`);
  return data.vendedores;
}

export async function desvincularVendedorLoja(pontoVendaId: string, vendedorId: string): Promise<VendedorDaLoja[]> {
  const { data } = await apiClient.delete<{ vendedores: VendedorDaLoja[] }>(`/pontos-venda/${pontoVendaId}/vendedores/${vendedorId}`);
  return data.vendedores;
}

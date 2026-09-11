import type { Fatura, StatusFatura } from '../../types/api';
import { apiClient } from './client';

// Registro manual de cobrança — sem gateway de pagamento (ver docs/00-VISAO-GERAL.md). Tudo
// abaixo é restrito a SUPERADMIN, aninhado em /superadmin/empresas/{uuid}/faturas.

export interface FaturasListResponse {
  faturas: Fatura[];
}

export async function listarFaturas(empresaUuid: string): Promise<FaturasListResponse> {
  const { data } = await apiClient.get<FaturasListResponse>(`/superadmin/empresas/${empresaUuid}/faturas`);
  return data;
}

export interface CriarFaturaPayload {
  valor: number;
  referencia: string;
  vencimento: string;
  status?: StatusFatura;
  pago_em?: string | null;
  observacao?: string | null;
}

export async function criarFatura(
  empresaUuid: string,
  payload: CriarFaturaPayload,
): Promise<{ fatura: Fatura }> {
  const { data } = await apiClient.post<{ fatura: Fatura }>(
    `/superadmin/empresas/${empresaUuid}/faturas`,
    payload,
  );
  return data;
}

export interface AtualizarFaturaPayload {
  valor?: number;
  referencia?: string;
  vencimento?: string;
  status?: StatusFatura;
  pago_em?: string | null;
  observacao?: string | null;
}

export async function atualizarFatura(
  empresaUuid: string,
  faturaUuid: string,
  payload: AtualizarFaturaPayload,
): Promise<{ fatura: Fatura }> {
  const { data } = await apiClient.put<{ fatura: Fatura }>(
    `/superadmin/empresas/${empresaUuid}/faturas/${faturaUuid}`,
    payload,
  );
  return data;
}

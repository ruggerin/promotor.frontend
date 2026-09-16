import type { Direcionamento, PaginatedMeta, ProgressoDirecionamento } from '../../types/api';
import { apiClient } from './client';

export interface DirecionamentosListResponse {
  direcionamentos: Direcionamento[];
  meta: PaginatedMeta;
}

export async function listarDirecionamentos(params: { ativo?: boolean } = {}): Promise<DirecionamentosListResponse> {
  const { data } = await apiClient.get<DirecionamentosListResponse>('/direcionamentos', {
    params: { ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0 },
  });
  return data;
}

export interface DirecionamentoDetailResponse {
  direcionamento: Direcionamento;
  progresso: ProgressoDirecionamento;
}

export async function buscarDirecionamento(uuid: string): Promise<DirecionamentoDetailResponse> {
  const { data } = await apiClient.get<DirecionamentoDetailResponse>(`/direcionamentos/${uuid}`);
  return data;
}

export interface FormularioDirecionamentoPayload {
  tipo_registro_uuid: string;
  obrigatorio?: boolean;
  calcula_percentual_compliance?: boolean;
}

export interface DirecionamentoPayload {
  descricao: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  ativo?: boolean;
  // Filtros multi-escolha, todos opcionais — ausência de qualquer um = vale pra empresa inteira.
  ponto_venda_uuids?: string[];
  rede_loja_uuids?: string[];
  promotor_uuids?: string[];
  // Lista completa — sempre substitui os formulários existentes por inteiro (mesmo padrão de
  // TipoRegistroController::sincronizarCampos).
  formularios: FormularioDirecionamentoPayload[];
}

export async function criarDirecionamento(payload: DirecionamentoPayload): Promise<DirecionamentoDetailResponse> {
  const { data } = await apiClient.post<DirecionamentoDetailResponse>('/direcionamentos', payload);
  return data;
}

export async function atualizarDirecionamento(
  uuid: string,
  payload: Partial<DirecionamentoPayload>,
): Promise<DirecionamentoDetailResponse> {
  const { data } = await apiClient.put<DirecionamentoDetailResponse>(`/direcionamentos/${uuid}`, payload);
  return data;
}

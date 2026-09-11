import type {
  EscopoAcaoTipoRegistro,
  GranularidadeResposta,
  PaginatedMeta,
  TipoCampoRegistro,
  TipoRegistro,
} from '../../types/api';
import { apiClient } from './client';

export interface TiposRegistroListResponse {
  tipos_registro: TipoRegistro[];
  meta: PaginatedMeta;
}

export interface TiposRegistroListParams {
  ativo?: boolean;
  // Só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
}

export async function listarTiposRegistro(params: TiposRegistroListParams = {}): Promise<TiposRegistroListResponse> {
  const { data } = await apiClient.get<TiposRegistroListResponse>('/tipos-registro', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      empresa_uuid: params.empresa_uuid,
    },
  });
  return data;
}

export interface CampoTipoRegistroPayload {
  chave: string;
  rotulo: string;
  tipo_campo: TipoCampoRegistro;
  opcoes?: string[] | null;
  obrigatorio?: boolean;
}

export interface TipoRegistroPayload {
  descricao: string;
  exige_foto?: boolean;
  permite_vincular_catalogo?: boolean;
  acao_obrigatoria?: boolean;
  escopo_acao?: EscopoAcaoTipoRegistro | null;
  campanha_auditoria_uuid?: string | null;
  granularidade_padrao?: GranularidadeResposta | null;
  // Lista completa — sempre substitui as exceções existentes por inteiro (ver
  // TipoRegistroController::sincronizarExcecoesGranularidade).
  excecoes_granularidade?: { secao_uuid: string; granularidade: GranularidadeResposta }[];
  eh_ruptura?: boolean;
  // Lista completa — sempre substitui os campos existentes por inteiro (ver
  // TipoRegistroController::sincronizarCampos).
  campos?: CampoTipoRegistroPayload[];
}

export async function criarTipoRegistro(payload: TipoRegistroPayload): Promise<{ tipo_registro: TipoRegistro }> {
  const { data } = await apiClient.post<{ tipo_registro: TipoRegistro }>('/tipos-registro', payload);
  return data;
}

export async function atualizarTipoRegistro(
  uuid: string,
  payload: Partial<TipoRegistroPayload> & { ativo?: boolean },
): Promise<{ tipo_registro: TipoRegistro }> {
  const { data } = await apiClient.put<{ tipo_registro: TipoRegistro }>(`/tipos-registro/${uuid}`, payload);
  return data;
}

export async function desativarTipoRegistro(uuid: string): Promise<void> {
  await apiClient.delete(`/tipos-registro/${uuid}`);
}

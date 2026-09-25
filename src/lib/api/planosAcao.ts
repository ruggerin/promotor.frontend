import type { PaginatedMeta, PlanoAcao, StatusEtapaPlanoAcao, StatusPlanoAcao, UserType } from '../../types/api';
import { apiClient } from './client';

// Planos de Ação — ver docs/37-PLANOS-DE-ACAO.md e App\Http\Controllers\PlanoAcaoController.

export interface ResumoPlanosAcao {
  ativos: number;
  atrasados: number;
  concluidos_mes: number;
  tempo_medio_resolucao_horas: number | null;
}

export interface PlanosAcaoListResponse {
  planos_acao: PlanoAcao[];
  meta: PaginatedMeta;
  resumo: ResumoPlanosAcao;
}

export interface FiltrosPlanosAcao {
  status?: StatusPlanoAcao[];
  atrasados?: boolean;
  responsavel_uuid?: string;
  // Rede pega também os planos das lojas dessa rede.
  ponto_venda_uuid?: string;
  rede_loja_uuid?: string;
  origem_tipo?: 'ALERTA' | 'LIVRE';
  busca?: string;
  page?: number;
}

export async function listarPlanosAcao(filtros: FiltrosPlanosAcao = {}): Promise<PlanosAcaoListResponse> {
  const { data } = await apiClient.get<PlanosAcaoListResponse>('/planos-acao', {
    params: { ...filtros, atrasados: filtros.atrasados ? 1 : undefined },
  });
  return data;
}

// O que o usuário atual pode fazer no plano — o /auth/me não expõe as permissões do perfil.
export interface PermissoesPlanoAcao {
  movimentar_etapa: boolean;
  concluir: boolean;
  cancelar: boolean;
}

export interface PlanoAcaoDetailResponse {
  plano_acao: PlanoAcao;
  permissoes: PermissoesPlanoAcao;
}

export async function buscarPlanoAcao(uuid: string): Promise<PlanoAcaoDetailResponse> {
  const { data } = await apiClient.get<PlanoAcaoDetailResponse>(`/planos-acao/${uuid}`);
  return data;
}

export interface ResponsavelPlanoAcao {
  id: string;
  nome: string;
  user_type: UserType;
}

export async function listarResponsaveisPlanoAcao(): Promise<ResponsavelPlanoAcao[]> {
  const { data } = await apiClient.get<{ responsaveis: ResponsavelPlanoAcao[] }>('/planos-acao/responsaveis');
  return data.responsaveis;
}

export interface EtapaPayload {
  titulo: string;
  descricao?: string | null;
  prazo?: string | null;
  responsavel_uuid?: string | null;
  responsavel_externo_nome?: string | null;
  responsavel_externo_contato?: string | null;
  evidencia_obrigatoria?: boolean;
}

// Com registro_uuid = plano de alerta (loja vem do alerta). Sem = plano livre, opcionalmente
// ligado a UMA loja ou UMA rede.
export interface PlanoAcaoPayload {
  registro_uuid?: string;
  ponto_venda_uuid?: string | null;
  rede_loja_uuid?: string | null;
  titulo: string;
  descricao?: string | null;
  prazo?: string | null;
  etapas: EtapaPayload[];
}

export async function criarPlanoAcao(payload: PlanoAcaoPayload): Promise<PlanoAcaoDetailResponse> {
  const { data } = await apiClient.post<PlanoAcaoDetailResponse>('/planos-acao', payload);
  return data;
}

export async function adicionarEtapaPlanoAcao(planoUuid: string, payload: EtapaPayload): Promise<PlanoAcaoDetailResponse> {
  const { data } = await apiClient.post<PlanoAcaoDetailResponse>(`/planos-acao/${planoUuid}/etapas`, payload);
  return data;
}

export interface AlterarStatusEtapaPayload {
  status: StatusEtapaPlanoAcao;
  motivo?: string;
  evidencia_texto?: string;
  evidencia_arquivo?: File | null;
}

// Multipart — pode levar o anexo de evidência junto.
export async function alterarStatusEtapa(
  planoUuid: string,
  etapaUuid: string,
  payload: AlterarStatusEtapaPayload,
): Promise<PlanoAcaoDetailResponse> {
  const form = new FormData();
  form.append('status', payload.status);
  if (payload.motivo) form.append('motivo', payload.motivo);
  if (payload.evidencia_texto) form.append('evidencia_texto', payload.evidencia_texto);
  if (payload.evidencia_arquivo) form.append('evidencia_arquivo', payload.evidencia_arquivo);

  const { data } = await apiClient.post<PlanoAcaoDetailResponse>(
    `/planos-acao/${planoUuid}/etapas/${etapaUuid}/status`,
    form,
  );
  return data;
}

export async function concluirPlanoAcao(planoUuid: string): Promise<PlanoAcaoDetailResponse> {
  const { data } = await apiClient.post<PlanoAcaoDetailResponse>(`/planos-acao/${planoUuid}/concluir`);
  return data;
}

export async function cancelarPlanoAcao(planoUuid: string, motivo: string): Promise<PlanoAcaoDetailResponse> {
  const { data } = await apiClient.post<PlanoAcaoDetailResponse>(`/planos-acao/${planoUuid}/cancelar`, { motivo });
  return data;
}

// Evidência fica em disco privado — precisa do Bearer, não dá pra usar a URL direto num <a>.
export async function baixarEvidencia(url: string): Promise<Blob> {
  const { data } = await apiClient.get<Blob>(url, { responseType: 'blob' });
  return data;
}

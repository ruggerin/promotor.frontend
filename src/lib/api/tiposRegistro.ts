import type {
  EscopoAcaoTipoRegistro,
  GranularidadeResposta,
  PaginatedMeta,
  SortimentoOrigemCampo,
  SortimentoTipoVinculo,
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
  // "Formulário desta campanha" (Fase 3 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md §3) — lista
  // só os tipos vinculados a essa campanha, usado pela seção própria na tela de Campanha.
  campanha_auditoria_uuid?: string;
}

export async function listarTiposRegistro(params: TiposRegistroListParams = {}): Promise<TiposRegistroListResponse> {
  const { data } = await apiClient.get<TiposRegistroListResponse>('/tipos-registro', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      empresa_uuid: params.empresa_uuid,
      campanha_auditoria_uuid: params.campanha_auditoria_uuid,
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
  // Campo condicional — `depende_de_chave` referencia a `chave` de outro campo deste MESMO
  // array (ver docs/20-FORMULARIO-DINAMICO-CAMPANHA.md decisão 7).
  depende_de_chave?: string | null;
  depende_de_valor?: string | null;
  // Campo SORTIMENTO (decisão 3) — só faz sentido quando tipo_campo = SORTIMENTO.
  sortimento_origem?: SortimentoOrigemCampo | null;
  sortimento_tipo_vinculo?: SortimentoTipoVinculo | null;
  sortimento_secao_uuid?: string | null;
  sortimento_departamento_uuid?: string | null;
  sortimento_marca_uuid?: string | null;
  sortimento_produtos_uuids?: string[];
  confirmar_ruptura_ausentes?: boolean;
}

export interface TipoRegistroPayload {
  descricao: string;
  icone?: string | null;
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
  eh_alerta?: boolean;
  // Fase 3 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md (decisões 5 e 8).
  usa_pontuacao?: boolean;
  disponivel_registro_livre?: boolean;
  // Lista completa — sempre substitui os campos existentes por inteiro (ver
  // TipoRegistroController::sincronizarCampos).
  campos?: CampoTipoRegistroPayload[];
}

export async function buscarTipoRegistro(uuid: string): Promise<{ tipo_registro: TipoRegistro }> {
  const { data } = await apiClient.get<{ tipo_registro: TipoRegistro }>(`/tipos-registro/${uuid}`);
  return data;
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

// Sequência de exibição (admin e mobile, ver TipoRegistroController::mover) — troca a `ordem`
// deste tipo com a do vizinho na direção pedida; sem vizinho (já é o primeiro/último), não faz
// nada, não é erro.
export async function moverTipoRegistro(uuid: string, direcao: 'cima' | 'baixo'): Promise<{ tipo_registro: TipoRegistro }> {
  const { data } = await apiClient.post<{ tipo_registro: TipoRegistro }>(`/tipos-registro/${uuid}/mover`, { direcao });
  return data;
}

// Duplicar (decisão 6 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md) — clona um tipo existente
// (com todos os campos) como ponto de partida de um formulário novo; a cópia nasce solta (sem
// ação obrigatória/campanha), independente do original depois.
export async function duplicarTipoRegistro(uuid: string): Promise<{ tipo_registro: TipoRegistro }> {
  const { data } = await apiClient.post<{ tipo_registro: TipoRegistro }>(`/tipos-registro/${uuid}/duplicar`);
  return data;
}

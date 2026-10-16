import type {
  AoContinuarAcompanhamento,
  EscopoAcaoTipoRegistro,
  GranularidadeResposta,
  ListaRecorte,
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
  // Formulário que o promotor pode abrir por conta própria na visita (registro espontâneo).
  disponivel_registro_livre?: boolean;
  busca?: string;
  // Só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa_uuid?: string;
  // "Formulário desta campanha" (Fase 3 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md §3) — lista
  // só os tipos vinculados a essa campanha, usado pela seção própria na tela de Campanha.
  campanha_auditoria_uuid?: string;
  // Opt-in (até 200) — pra quem precisa da lista toda (copiar de outro formulário).
  por_pagina?: number;
}

export async function listarTiposRegistro(params: TiposRegistroListParams = {}): Promise<TiposRegistroListResponse> {
  const { data } = await apiClient.get<TiposRegistroListResponse>('/tipos-registro', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      disponivel_registro_livre:
        params.disponivel_registro_livre === undefined ? undefined : params.disponivel_registro_livre ? 1 : 0,
      busca: params.busca || undefined,
      empresa_uuid: params.empresa_uuid,
      campanha_auditoria_uuid: params.campanha_auditoria_uuid,
      por_pagina: params.por_pagina,
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
  sortimento_segue_escolha?: boolean;
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
  // Escopo LOJA_REDE (docs/40) — ignoradas/limpas pelo backend em qualquer outro escopo.
  // Lista predefinida de produtos (só com granularidade PRODUTO; o backend limpa nas outras).
  produtos_uuids?: string[];
  pontos_venda_uuids?: string[];
  redes_lojas_uuids?: string[];
  granularidade_padrao?: GranularidadeResposta | null;
  escopo_tipo_vinculo?: SortimentoTipoVinculo | null;
  escopo_secao_uuid?: string | null;
  escopo_departamento_uuid?: string | null;
  escopo_marca_uuid?: string | null;
  ramos_atividade_uuids?: string[];
  intervalo_dias?: number;
  escolhe_marca?: boolean;
  escolhe_departamento?: boolean;
  escolhe_secao?: boolean;
  lista_recorte?: ListaRecorte;
  filtra_marca?: boolean;
  acompanha?: boolean;
  acompanha_gatilho_chave?: string | null;
  acompanha_gatilho_valor?: string | null;
  acompanha_intervalo_dias?: number;
  acompanha_rotulo_continua?: string | null;
  acompanha_rotulo_acabou?: string | null;
  acompanha_ao_continuar?: AoContinuarAcompanhamento;
  acompanha_formulario_acabou_uuid?: string | null;
  acompanha_prazo_dias?: number | null;
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
// Lojas onde a Ação vale — pré-seleção do "Enviar agora" quando o escopo depende do Mix
// (LINHA_AUSENTE), do contrato ou há filtro por ramo (docs/80).
export async function listarLojasDaAcao(uuid: string): Promise<{ id: string; fantasia: string }[]> {
  const { data } = await apiClient.get<{ pontos_venda: { id: string; fantasia: string }[] }>(`/tipos-registro/${uuid}/lojas-da-acao`);
  return data.pontos_venda;
}

// Conversão do levantamento de linha ausente (docs/80 §5.3). Datas em AAAA-MM-DD.
export interface ConversaoLinha {
  monitoradas: number;
  convertidas: number;
  percentual: number | null;
  lojas_convertidas: { id: string; fantasia: string; primeiro_levantamento_em: string; linha_entrou_em: string }[];
}

export async function buscarConversaoLinha(uuid: string, inicio: string, fim: string): Promise<ConversaoLinha> {
  const { data } = await apiClient.get<ConversaoLinha>(`/tipos-registro/${uuid}/conversao`, { params: { inicio, fim } });
  return data;
}

export async function duplicarTipoRegistro(uuid: string): Promise<{ tipo_registro: TipoRegistro }> {
  const { data } = await apiClient.post<{ tipo_registro: TipoRegistro }>(`/tipos-registro/${uuid}/duplicar`);
  return data;
}

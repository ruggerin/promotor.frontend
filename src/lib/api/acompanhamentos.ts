import type { PaginatedMeta, RespostaAcompanhamento, SituacaoAcompanhamento } from '../../types/api';
import { apiClient } from './client';

// "Ainda está lá?" (docs/83): lista, linha do tempo e encerramento pelo gestor.

export interface AcompanhamentoResumo {
  id: string;
  situacao: SituacaoAcompanhamento;
  formulario: { id: string; descricao: string } | null;
  loja: { id: string; fantasia: string } | null;
  aberto_em: string | null;
  dias_em_aberto: number;
  ultima_resposta_em: string | null;
  proxima_verificacao_em: string | null;
  /** Aberto com a verificação vencida (ninguém foi conferir). */
  atrasado: boolean;
  encerrado_em: string | null;
  expira_em: string | null;
  respostas_count: number;
}

export interface RegistroDaLinhaDoTempo {
  id: string;
  criado_em: string | null;
  formulario: string | null;
  imagens: string[];
  campos_respondidos: { chave: string; rotulo: string; valor: string | null }[];
}

export interface AcompanhamentoDetalhe extends AcompanhamentoResumo {
  encerrado_por: string | null;
  rotulo_continua: string;
  rotulo_acabou: string;
  origem: (RegistroDaLinhaDoTempo & { usuario: string | null }) | null;
  respostas: {
    id: string;
    resposta: RespostaAcompanhamento;
    /** false = chegou depois de já estar encerrado (resposta offline): só histórico. */
    aplicada: boolean;
    respondido_em: string | null;
    usuario: string | null;
    visita_id: string | null;
    registro: RegistroDaLinhaDoTempo | null;
  }[];
}

export interface FiltrosAcompanhamentos {
  page?: number;
  situacao?: SituacaoAcompanhamento;
  tipo_registro_uuid?: string;
  registro_uuid?: string;
}

export async function listarAcompanhamentos(f: FiltrosAcompanhamentos = {}): Promise<{ acompanhamentos: AcompanhamentoResumo[]; meta: PaginatedMeta }> {
  const { data } = await apiClient.get('/acompanhamentos', { params: f });
  return data;
}

export async function buscarAcompanhamento(id: string): Promise<AcompanhamentoDetalhe> {
  const { data } = await apiClient.get<{ acompanhamento: AcompanhamentoDetalhe }>(`/acompanhamentos/${id}`);
  return data.acompanhamento;
}

export async function encerrarAcompanhamento(id: string): Promise<AcompanhamentoDetalhe> {
  const { data } = await apiClient.post<{ acompanhamento: AcompanhamentoDetalhe }>(`/acompanhamentos/${id}/encerrar`);
  return data.acompanhamento;
}

export const ROTULO_SITUACAO: Record<SituacaoAcompanhamento, string> = {
  ABERTO: 'Aberto',
  ENCERRADO: 'Encerrado na loja',
  ENCERRADO_PELO_GESTOR: 'Encerrado pelo gestor',
  EXPIRADO: 'Expirado',
  SUBSTITUIDO: 'Substituído',
  CANCELADO: 'Cancelado',
};

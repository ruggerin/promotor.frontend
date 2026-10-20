import type {
  ClasseLoja,
  ComparativoXp,
  GranularidadeComparativo,
  OcorrenciaXp,
  PaginatedMeta,
  PlanejamentoXp,
  PontuacaoVisitaXp,
  RankingXp,
  RegistroParaAvaliar,
  ReguaXp,
  SemanaXp,
  StatusAvaliacao,
  SugestaoClasse,
  ValorGeradoXp,
} from '../../types/api';
import { apiClient } from './client';

// Régua de performance com XP (docs/88) — tudo atrás do recurso de plano da empresa
// (`controle_xp_habilitado`). Leitura com `xp.visualizar`; classes e classificação com `xp.gerenciar`.

export interface FiltrosRegua {
  dia?: string;
  periodo?: 'dia' | 'semana' | 'mes';
  supervisor_uuid?: string;
}

export async function buscarRegua(f: FiltrosRegua): Promise<ReguaXp> {
  const { data } = await apiClient.get<{ regua: ReguaXp }>('/xp/regua', { params: f });
  return data.regua;
}

export async function listarOcorrencias(f: FiltrosRegua & { categoria?: string }): Promise<OcorrenciaXp[]> {
  const { data } = await apiClient.get<{ ocorrencias: OcorrenciaXp[] }>('/xp/ocorrencias', { params: f });
  return data.ocorrencias;
}

export interface Classificacao {
  justificada: boolean;
  causa_uuid?: string | null;
  comentario?: string | null;
  plano_acao_uuid?: string | null;
}

// Append-only: reclassificar cria uma linha nova; o número nunca muda (docs/88 §8).
export async function classificarOcorrencia(id: string, dados: Classificacao): Promise<OcorrenciaXp> {
  const { data } = await apiClient.post<{ ocorrencia: OcorrenciaXp }>(`/xp/ocorrencias/${id}/classificar`, dados);
  return data.ocorrencia;
}

export async function buscarEvolucao(f: FiltrosRegua): Promise<SemanaXp[]> {
  const { data } = await apiClient.get<{ semanas: SemanaXp[] }>('/xp/evolucao', { params: f });
  return data.semanas;
}

export async function buscarPlanejamento(f: FiltrosRegua): Promise<PlanejamentoXp> {
  const { data } = await apiClient.get<{ planejamento: PlanejamentoXp }>('/xp/planejamento', { params: f });
  return data.planejamento;
}

export async function buscarValorGerado(mes: string): Promise<ValorGeradoXp> {
  const { data } = await apiClient.get<{ valor_gerado: ValorGeradoXp }>('/xp/valor-gerado', { params: { mes } });
  return data.valor_gerado;
}

export type PeriodoRanking = 'atual' | 'passada' | 'mes' | 'mes_passado';

// Comparativo período a período (6 meses, 8 semanas ou 14 dias), da equipe ou de um promotor.
export async function buscarComparativo(granularidade: GranularidadeComparativo, f: FiltrosRegua & { usuario_uuid?: string }): Promise<ComparativoXp> {
  const { data } = await apiClient.get<{ comparativo: ComparativoXp }>('/xp/evolucao', { params: { ...f, granularidade } });
  return data.comparativo;
}

export async function buscarRankingEquipe(semana: PeriodoRanking, supervisorUuid?: string): Promise<RankingXp> {
  const { data } = await apiClient.get<{ ranking: RankingXp }>('/xp/ranking-equipe', { params: { semana, supervisor_uuid: supervisorUuid } });
  return data.ranking;
}

export async function buscarPontuacaoVisita(visitaId: string): Promise<PontuacaoVisitaXp> {
  const { data } = await apiClient.get<{ pontuacao: PontuacaoVisitaXp }>(`/xp/visitas/${visitaId}`);
  return data.pontuacao;
}

// ---- Classes de loja (docs/88 §4) ----

export type DadosClasse = Partial<Pick<ClasseLoja, 'nome' | 'icone' | 'cor' | 'xp_base' | 'duracao_padrao_minutos' | 'eh_padrao' | 'ativo'>>;

export async function listarClasses(ativo?: boolean): Promise<ClasseLoja[]> {
  const { data } = await apiClient.get<{ classes: ClasseLoja[] }>('/classes-ponto-venda', {
    params: { ativo: ativo === undefined ? undefined : ativo ? 1 : 0 },
  });
  return data.classes;
}

export async function criarClasse(dados: DadosClasse): Promise<ClasseLoja> {
  const { data } = await apiClient.post<{ classe: ClasseLoja }>('/classes-ponto-venda', dados);
  return data.classe;
}

export async function atualizarClasse(id: string, dados: DadosClasse): Promise<ClasseLoja> {
  const { data } = await apiClient.put<{ classe: ClasseLoja }>(`/classes-ponto-venda/${id}`, dados);
  return data.classe;
}

export async function desativarClasse(id: string): Promise<void> {
  await apiClient.delete(`/classes-ponto-venda/${id}`);
}

export async function listarSugestoesClasse(): Promise<SugestaoClasse[]> {
  const { data } = await apiClient.get<{ sugestoes: SugestaoClasse[] }>('/classes-ponto-venda/sugestoes');
  return data.sugestoes;
}

export async function aceitarSugestoesClasse(pontosVendaIds: string[]): Promise<number> {
  const { data } = await apiClient.post<{ atualizadas: number }>('/classes-ponto-venda/sugestoes/aceitar', { pontos_venda_uuids: pontosVendaIds });
  return data.atualizadas;
}

// ---- Avaliação de formulário (doc 33) ----

export async function listarAvaliacoes(status: StatusAvaliacao, page = 1): Promise<{ registros: RegistroParaAvaliar[]; meta: PaginatedMeta }> {
  const { data } = await apiClient.get('/avaliacoes-formulario', { params: { status, page } });
  return data;
}

export async function avaliarRegistro(visitaId: string, registroId: string, decisao: 'APROVADO' | 'REPROVADO', motivo?: string): Promise<void> {
  await apiClient.post(`/visitas/${visitaId}/registros/${registroId}/avaliar`, { decisao, motivo: motivo || undefined });
}

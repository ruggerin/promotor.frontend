import { apiClient } from './client';

// Ver docs/32-PAINEL-OPERACAO-DO-DIA.md — endpoint agregador único (Fase 1), consumido pela
// tela de mesmo nome (Fase 2). Tipos aqui em vez de types/api.ts porque são específicos deste
// payload agregado, não entidades reaproveitadas em outra tela.

export type SituacaoPromotor = 'NO_PDV' | 'ENCERRADO' | 'ATRASADO' | 'DESLOCAMENTO';

export interface BlocoJornada {
  inicio: string;
  fim: string;
  status: 'FEITA' | 'ATUAL' | 'PREVISTA' | 'ATRASO_INICIO';
  ponto_venda: { id: string; fantasia: string } | null;
  // Só presente em FEITA/ATUAL (bloco real, já virou Visita) — null num bloco nominal
  // (PREVISTA/ATRASO_INICIO), que ainda não tem visita pra detalhar.
  visita_id: string | null;
}

export interface LinhaEquipeOperacaoDoDia {
  usuario: { id: string; nome: string; foto_url: string | null };
  status: SituacaoPromotor;
  ponto_venda_atual: { id: string; fantasia: string } | null;
  checkin_em: string | null;
  visitas: { feitas: number; total: number };
  rupturas: number;
  ultima_localizacao_em: string | null;
  sem_sinal: boolean;
  blocos_jornada: BlocoJornada[];
}

export type TipoItemFilaAcoes = 'ALERTA' | 'ATRASO' | 'SINAL';

export interface ItemFilaAcoes {
  tipo: TipoItemFilaAcoes;
  ocorrido_em: string | null;
  titulo: string;
  ponto_venda: { id: string; fantasia: string } | null;
  usuario: { id: string; nome: string } | null;
  // Só presente em tipo ALERTA — visita_id junto do id pra poder chamar resolverAlerta (mesmo
  // endpoint do Painel de Atividades, ver lib/api/atividades.ts).
  // tipo/produto/observacao pré-preenchem o "Abrir Plano de Ação"; plano_acao_ativo troca o
  // "Resolver" por "Ver plano" (docs/37-PLANOS-DE-ACAO.md).
  registro: {
    id: string;
    visita_id: string;
    tipo?: string;
    produto?: string | null;
    observacao?: string | null;
    plano_acao_ativo?: { id: string; status: string } | null;
  } | null;
}

export interface LinhaRupturaPorSku {
  produto: { id: string; descricao: string; codigo_barras: string | null };
  pdvs: number;
  desde: string;
}

export interface OperacaoDoDiaResponse {
  data: string;
  // true quando `data` não é hoje — sinal/fila de ações/rupturas por SKU somem da resposta
  // nesse caso (são sempre o estado atual, nunca "daquele dia" — ver
  // docs/32-PAINEL-OPERACAO-DO-DIA.md).
  historico: boolean;
  jornada: { inicio: string; fim: string };
  kpis: {
    visitas_realizadas: { feitas: number; total: number };
    em_campo: { atual: number; total: number; encerrados: number };
    atrasados: number;
    sem_sinal: number;
    rupturas_abertas: { total: number; pdvs: number };
    formularios_emitidos: { expedidos: number; preenchidos: number };
  };
  equipe: LinhaEquipeOperacaoDoDia[];
  fila_acoes: ItemFilaAcoes[];
  rupturas_por_sku: LinhaRupturaPorSku[];
}

export async function buscarOperacaoDoDia(data?: string): Promise<OperacaoDoDiaResponse> {
  const { data: resposta } = await apiClient.get<OperacaoDoDiaResponse>('/operacao-do-dia', { params: { data } });
  return resposta;
}

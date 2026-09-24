import { apiClient } from './client';

// Ver docs/32-PAINEL-OPERACAO-DO-DIA.md — endpoint agregador único (Fase 1), consumido pela
// tela de mesmo nome (Fase 2). Tipos aqui em vez de types/api.ts porque são específicos deste
// payload agregado, não entidades reaproveitadas em outra tela.

export type SituacaoPromotor = 'NO_PDV' | 'ENCERRADO' | 'ATRASADO' | 'DESLOCAMENTO';

export interface BlocoJornada {
  inicio: string;
  fim: string;
  status: 'FEITA' | 'ATUAL' | 'PREVISTA' | 'ATRASO_INICIO';
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
  registro: { id: string } | null;
}

export interface LinhaRupturaPorSku {
  produto: { id: string; descricao: string; codigo_barras: string | null };
  pdvs: number;
  desde: string;
}

export interface OperacaoDoDiaResponse {
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

export async function buscarOperacaoDoDia(): Promise<OperacaoDoDiaResponse> {
  const { data } = await apiClient.get<OperacaoDoDiaResponse>('/operacao-do-dia');
  return data;
}

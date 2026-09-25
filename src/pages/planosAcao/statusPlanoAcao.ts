import type { StatusEtapaPlanoAcao, StatusPlanoAcao } from '../../types/api';

// Rótulos/cores de status de Plano de Ação e etapa — compartilhados entre lista, detalhe e o
// card do Painel de Atividades. Ver docs/37-PLANOS-DE-ACAO.md §4.5.

type CorChip = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export const STATUS_PLANO: Record<StatusPlanoAcao, { label: string; cor: CorChip }> = {
  ABERTO: { label: 'Aberto', cor: 'info' },
  EM_ANDAMENTO: { label: 'Em andamento', cor: 'primary' },
  CONCLUIDO: { label: 'Concluído', cor: 'success' },
  CANCELADO: { label: 'Cancelado', cor: 'default' },
};

export const STATUS_ETAPA: Record<StatusEtapaPlanoAcao, { label: string; cor: CorChip }> = {
  PENDENTE: { label: 'Pendente', cor: 'default' },
  EM_ANDAMENTO: { label: 'Em andamento', cor: 'primary' },
  FEITA: { label: 'Feita', cor: 'success' },
  CANCELADA: { label: 'Cancelada', cor: 'default' },
  BLOQUEADA: { label: 'Bloqueada', cor: 'error' },
};

// Espelha StatusEtapaPlanoAcao::transicoesPermitidas() no backend — FEITA/CANCELADA são terminais.
export const TRANSICOES_ETAPA: Record<StatusEtapaPlanoAcao, StatusEtapaPlanoAcao[]> = {
  PENDENTE: ['EM_ANDAMENTO', 'FEITA', 'CANCELADA', 'BLOQUEADA'],
  EM_ANDAMENTO: ['PENDENTE', 'FEITA', 'CANCELADA', 'BLOQUEADA'],
  BLOQUEADA: ['PENDENTE', 'EM_ANDAMENTO', 'FEITA', 'CANCELADA'],
  FEITA: [],
  CANCELADA: [],
};

export function planoAtivo(status: StatusPlanoAcao): boolean {
  return status === 'ABERTO' || status === 'EM_ANDAMENTO';
}

// Datas de prazo vêm como YYYY-MM-DD (sem hora) — formata sem passar por Date, que jogaria pro
// dia anterior em fuso negativo.
export function formatarPrazo(prazo: string | null): string {
  if (!prazo) return '—';
  const [ano, mes, dia] = prazo.split('-');
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

// Tempo de vida do plano (aberto → concluído/cancelado, ou até agora) — calendário simples, §4.1.
export function formatarDuracao(inicioIso: string, fimIso: string | null): string {
  const ms = (fimIso ? new Date(fimIso).getTime() : Date.now()) - new Date(inicioIso).getTime();
  const horas = Math.max(0, Math.floor(ms / 3_600_000));
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  const resto = horas % 24;
  return resto > 0 ? `${dias}d ${resto}h` : `${dias}d`;
}

export function formatarHoras(horas: number | null): string {
  if (horas === null) return '—';
  if (horas < 24) return `${horas.toFixed(1).replace('.', ',')}h`;
  return `${(horas / 24).toFixed(1).replace('.', ',')} dias`;
}

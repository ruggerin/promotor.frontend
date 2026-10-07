import type { Agregacao, FormatoMetrica, Granularidade, PresetPeriodo, ValorMetrica } from '../../lib/api/relatoriosPersonalizados';

export const PRESET_LABELS: Record<PresetPeriodo, string> = {
  hoje: 'Hoje',
  ultimos_7_dias: 'Últimos 7 dias',
  ultimos_30_dias: 'Últimos 30 dias',
  mes_atual: 'Este mês',
  mes_anterior: 'Mês passado',
  trimestre_atual: 'Este trimestre',
  ultimos_12_meses: 'Últimos 12 meses',
  ano_atual: 'Este ano',
  ano_anterior: 'Ano passado',
};

// Ordem do menu de operação no chip de Valores.
export const AGREGACAO_LABELS: Record<Agregacao, string> = {
  soma: 'Soma',
  media: 'Média',
  minimo: 'Mínimo',
  maximo: 'Máximo',
  contagem: 'Contagem',
  contagem_distinta: 'Contagem distinta',
  moda: 'Moda',
  percentual_sim: '% Sim',
};

export const GRANULARIDADE_LABELS: Record<Granularidade, string> = {
  ano: 'Ano',
  trimestre: 'Trimestre',
  mes: 'Mês',
  semana: 'Semana',
  dia: 'Data',
  mes_do_ano: 'Mês do ano',
  dia_da_semana: 'Dia da semana',
};

export const ENTIDADE_LABELS: Record<string, string> = {
  ordem_servico: 'Visitas planejadas',
  visita: 'Visitas realizadas',
  registro: 'Registros e formulários',
};

// Métricas em que subir é ruim — define a cor da variação no comparativo. É só apresentação; a
// conta é toda do backend.
const PIOR_QUANDO_MAIOR = new Set(['atrasadas', 'canceladas', 'canceladas_promotor', 'desconsideradas', 'rupturas', 'percentual_ruptura', 'alertas', 'alertas_abertos']);

export function melhorQuandoMaior(chave: string): boolean {
  return !PIOR_QUANDO_MAIOR.has(chave);
}

/** "4 h 59 min", "10 min" — unidade mais legível (padrão visual Horus). */
export function formatarMinutos(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

export function formatarValor(valor: ValorMetrica | undefined, formato: FormatoMetrica): string {
  if (valor === null || valor === undefined || Array.isArray(valor)) return '—';
  if (typeof valor === 'string') return valor;
  if (formato === 'percentual') return `${valor}%`;
  if (formato === 'minutos') return formatarMinutos(valor);
  if (formato === 'moeda') return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  if (formato === 'decimal') return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return valor.toLocaleString('pt-BR');
}

export function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

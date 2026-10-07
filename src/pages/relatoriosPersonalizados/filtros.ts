import type { CampoCatalogo, Operador } from '../../lib/api/relatoriosPersonalizados';

export const OPERADOR_LABELS: Record<Operador, string> = {
  em: 'é um de',
  nao_em: 'não é nenhum de',
  igual: 'é',
  vazio: 'está vazio',
  nao_vazio: 'está preenchido',
};

export interface RegraFiltro {
  id: number;
  campo: string;
  operador: Operador;
  valor?: string[] | boolean;
  /** Rótulo de cada uuid escolhido — só pra mostrar no chip, não vai pro backend. */
  rotulos?: Record<string, string>;
}

/** Regra pronta pra mandar ao backend (operadores com valor precisam de valor). */
export function regraCompleta(r: RegraFiltro): boolean {
  if (r.operador === 'vazio' || r.operador === 'nao_vazio') return true;
  if (r.operador === 'igual') return typeof r.valor === 'boolean';
  return Array.isArray(r.valor) && r.valor.length > 0;
}

export function resumoRegra(r: RegraFiltro, campo: CampoCatalogo | undefined): string {
  const nome = campo?.rotulo ?? r.campo;
  if (r.operador === 'vazio' || r.operador === 'nao_vazio') return `${nome} ${OPERADOR_LABELS[r.operador]}`;
  if (r.operador === 'igual') return typeof r.valor === 'boolean' ? `${nome}: ${r.valor ? 'Sim' : 'Não'}` : `${nome}: escolha`;
  const valores = Array.isArray(r.valor) ? r.valor : [];
  if (valores.length === 0) return `${nome}: escolha os valores`;
  const rotulos = valores.map((v) => campo?.opcoes?.find((o) => o.valor === v)?.rotulo ?? r.rotulos?.[v] ?? '…');
  const texto = rotulos.length > 2 ? `${rotulos.slice(0, 2).join(', ')} +${rotulos.length - 2}` : rotulos.join(', ');
  return `${nome}${r.operador === 'nao_em' ? ' ≠ ' : ': '}${texto}`;
}

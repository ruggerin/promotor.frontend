import type { TipoItemCampanha } from '../types/api';

// Rótulos e resolução de "o que esse item cobre" pros 4 níveis de granularidade reaproveitados
// em CampanhaItem e SortimentoPontoVenda (mesmo discriminador `tipo_item`, ver
// docs/14-SORTIMENTO-PONTO-VENDA.md §2) — extraído de CampanhaDetailPage/PontoVendaDetailPage
// pra não manter duas cópias idênticas em sincronia manualmente (auditoria de 2026-09-10).
export const TIPO_ITEM_LABELS: Record<TipoItemCampanha, string> = {
  PRODUTO: 'Produto específico',
  SECAO: 'Seção inteira',
  DEPARTAMENTO: 'Departamento inteiro',
  MARCA: 'Marca (todos os produtos dela)',
};

interface ItemComEntidades {
  tipo_item: TipoItemCampanha;
  produto: { descricao: string } | null;
  secao: { descricao: string } | null;
  departamento: { descricao: string } | null;
  marca: { descricao: string } | null;
}

export function entidadeDoItem(item: ItemComEntidades): string {
  switch (item.tipo_item) {
    case 'PRODUTO':
      return item.produto?.descricao ?? '—';
    case 'SECAO':
      return item.secao?.descricao ?? '—';
    case 'DEPARTAMENTO':
      return item.departamento?.descricao ?? '—';
    case 'MARCA':
      return item.marca?.descricao ?? '—';
  }
}

import type { StatusPedidoVenda } from '../../types/api';

// Rótulos/cores de status de Pedido de Venda — ver docs/38-PEDIDO-VENDEDOR.md §7.

type CorChip = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';

export const STATUS_PEDIDO_VENDA: Record<StatusPedidoVenda, { label: string; cor: CorChip }> = {
  RASCUNHO: { label: 'Rascunho', cor: 'default' },
  PENDENTE_AUTORIZACAO: { label: 'Aguardando autorização', cor: 'warning' },
  APROVADO: { label: 'Aprovado', cor: 'primary' },
  CONCLUIDO: { label: 'Concluído', cor: 'success' },
  CANCELADO: { label: 'Cancelado', cor: 'default' },
};

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(valor: number | null | undefined): string {
  return valor === null || valor === undefined ? '—' : moeda.format(valor);
}

export function formatarNumero(valor: number, casas = 3): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: casas });
}

export function formatarPct(valor: number | null): string {
  return valor === null ? '—' : `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

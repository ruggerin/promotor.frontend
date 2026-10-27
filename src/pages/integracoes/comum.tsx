import { Chip } from '@mui/material';
import type { SituacaoIntegracao } from '../../lib/api/integracoes';

// docs/96 §8 — peças compartilhadas da lista e do detalhe de Integrações.

const SITUACAO: Record<SituacaoIntegracao, { rotulo: string; cor: 'success' | 'warning' | 'default' | 'error' }> = {
  ativa: { rotulo: 'Ativa', cor: 'success' },
  vencendo: { rotulo: 'Vencendo', cor: 'warning' },
  vencida: { rotulo: 'Vencida', cor: 'error' },
  pausada: { rotulo: 'Pausada', cor: 'default' },
  revogada: { rotulo: 'Revogada', cor: 'error' },
};

export function SituacaoChip({ situacao }: { situacao: SituacaoIntegracao }) {
  const { rotulo, cor } = SITUACAO[situacao];
  return <Chip size="small" label={rotulo} color={cor} variant={cor === 'default' ? 'outlined' : 'filled'} />;
}

export function rotuloValidade(dias: number | null): string {
  if (dias === null) return 'Sem validade';
  if (dias === 365) return '1 ano (recomendado)';
  return `${dias} dias`;
}

/** Dias até a data (arredondado pra cima); negativo = já passou. */
export function diasAte(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function dataCurta(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—';
}

export function dataHoraCurta(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

/** Mensagem de erro da API (422 com o primeiro erro de campo, ou `message`). */
export function mensagemErro(err: unknown, padrao: string): string {
  const resposta = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })?.response?.data;
  const primeiroCampo = resposta?.errors ? Object.values(resposta.errors)[0]?.[0] : undefined;
  return primeiroCampo ?? resposta?.message ?? padrao;
}

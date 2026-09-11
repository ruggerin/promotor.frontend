import type { ContratoMeta, FontePagamentoMeta } from '../../types/api';
import { apiClient } from './client';

export interface ContratoMetaPayload {
  marca_uuid?: string | null;
  descricao?: string | null;
  valor_investimento: number;
  meta_valor: number;
  periodo_inicio: string;
  periodo_fim: string;
  fonte_pagamento: FontePagamentoMeta;
  // Obrigatório só quando fonte_pagamento = COMPARTILHADO — ver docs/09-CONTRATO-METAS.md §3.
  percentual_industria?: number | null;
}

export async function criarContratoMeta(
  contratoUuid: string,
  payload: ContratoMetaPayload,
): Promise<{ meta: ContratoMeta }> {
  const { data } = await apiClient.post<{ meta: ContratoMeta }>(`/contratos/${contratoUuid}/metas`, payload);
  return data;
}

// Mesmo endpoint edita os dados negociados e "lança o resultado" (resultado_apurado) — não é
// uma ação separada, ver docs/09-CONTRATO-METAS.md §5.
export async function atualizarContratoMeta(
  contratoUuid: string,
  metaUuid: string,
  payload: Partial<ContratoMetaPayload> & { resultado_apurado?: number | null },
): Promise<{ meta: ContratoMeta }> {
  const { data } = await apiClient.put<{ meta: ContratoMeta }>(`/contratos/${contratoUuid}/metas/${metaUuid}`, payload);
  return data;
}

export async function removerContratoMeta(contratoUuid: string, metaUuid: string): Promise<void> {
  await apiClient.delete(`/contratos/${contratoUuid}/metas/${metaUuid}`);
}

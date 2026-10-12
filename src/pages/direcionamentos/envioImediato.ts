import type { TipoRegistro } from '../../types/api';

// "Enviar agora pro app" (docs/66): o formulário abre o Direcionamento já preenchido, e a geração é
// a do próprio Direcionamento (síncrona no POST). Aqui só se monta o pré-preenchimento.

export type ValoresDirecionamento = {
  descricao: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  pontos_venda: { uuid: string; fantasia: string }[];
  redes_loja: { uuid: string; descricao: string }[];
  promotores: { uuid: string; nome: string }[];
  formularios: { tipo_registro_uuid: string; descricao: string; obrigatorio: boolean; calcula_percentual_compliance: boolean }[];
};

/** Valor de <input type="datetime-local"> (hora local do navegador, sem fuso). */
export function paraInputDateTime(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

/**
 * Pré-preenchimento do Direcionamento a partir do formulário salvo.
 * - Início = agora menos 1 minuto: a geração só roda com `vigencia_inicio <= now()` no servidor
 *   (docs/66 §4.1), e o minuto de folga cobre relógio do navegador adiantado.
 * - Fim = fim do dia de hoje (editável).
 * - Lojas pelo escopo: LOJA_REDE usa as do formulário; CONTRATO, as lojas com contrato ativo
 *   (passadas por quem chama); SEMPRE/sem ação = sem filtro (todas as lojas ativas).
 */
export function valoresEnvioImediato(
  tipo: TipoRegistro,
  lojasComContrato: { id: string; fantasia: string }[] = [],
  agora: Date = new Date(),
): ValoresDirecionamento {
  const inicio = new Date(agora.getTime() - 60_000);
  const fimDoDia = new Date(agora);
  fimDoDia.setHours(23, 59, 0, 0);

  const escopo = tipo.acao_obrigatoria ? tipo.escopo_acao : null;
  const pontos =
    escopo === 'LOJA_REDE'
      ? (tipo.pontos_venda_escopo ?? [])
      : escopo === 'CONTRATO'
        ? lojasComContrato
        : [];

  return {
    descricao: `${tipo.descricao} — envio imediato`,
    vigencia_inicio: paraInputDateTime(inicio),
    vigencia_fim: paraInputDateTime(fimDoDia),
    pontos_venda: pontos.map((p) => ({ uuid: p.id, fantasia: p.fantasia })),
    redes_loja: escopo === 'LOJA_REDE' ? (tipo.redes_lojas_escopo ?? []).map((r) => ({ uuid: r.id, descricao: r.descricao })) : [],
    promotores: [],
    formularios: [{ tipo_registro_uuid: tipo.id, descricao: tipo.descricao, obrigatorio: true, calcula_percentual_compliance: false }],
  };
}

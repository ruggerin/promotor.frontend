// Atraso de envio do app (docs/51-ENVIO-DA-FILA-EM-TEMPO-REAL.md Fase 3): a hora gravada é a do
// campo (inicio_data, fim_data) e o servidor guarda quando o passo CHEGOU (*_recebido_em). Acima
// do limite, o admin avisa "chegou X min depois" — explica por que a visita "apareceu do nada".

// docs/51 §6 decisão 3.
export const LIMITE_ATRASO_ENVIO_MINUTOS = 5;

/** Minutos entre o feito no campo e a chegada no servidor; null se não passou do limite (ou não dá pra saber). */
export function atrasoEnvioMinutos(feitoEm: string | null | undefined, recebidoEm: string | null | undefined): number | null {
  if (!feitoEm || !recebidoEm) return null;
  const minutos = Math.round((new Date(recebidoEm).getTime() - new Date(feitoEm).getTime()) / 60_000);
  return minutos > LIMITE_ATRASO_ENVIO_MINUTOS ? minutos : null;
}

export function textoAtrasoEnvio(minutos: number): string {
  if (minutos < 60) return `chegou ${minutos} min depois`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `chegou ${h}h${m ? String(m).padStart(2, '0') : ''} depois`;
}

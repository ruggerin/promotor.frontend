// Fusos horários do Brasil (IANA) — docs/50-SUPORTE-MULTIPLOS-FUSOS-HORARIOS.md. A empresa define o
// corte de "dia"; a loja, o horário marcado (herda da empresa quando não tem o dela). Rótulo com a
// região e o UTC pra ninguém precisar saber o nome IANA.
export const FUSOS_BRASIL: { valor: string; rotulo: string }[] = [
  { valor: 'America/Sao_Paulo', rotulo: 'Brasília (UTC−3) — SP, RJ, MG, Sul, Nordeste, GO, DF, PA...' },
  { valor: 'America/Manaus', rotulo: 'Amazonas (UTC−4) — Manaus e maior parte do AM' },
  { valor: 'America/Cuiaba', rotulo: 'Mato Grosso (UTC−4)' },
  { valor: 'America/Campo_Grande', rotulo: 'Mato Grosso do Sul (UTC−4)' },
  { valor: 'America/Porto_Velho', rotulo: 'Rondônia (UTC−4)' },
  { valor: 'America/Boa_Vista', rotulo: 'Roraima (UTC−4)' },
  { valor: 'America/Rio_Branco', rotulo: 'Acre (UTC−5) — e oeste do AM' },
  { valor: 'America/Noronha', rotulo: 'Fernando de Noronha (UTC−2)' },
];

export const FUSO_PADRAO = 'America/Sao_Paulo';

export function rotuloFuso(valor: string | null | undefined): string {
  if (!valor) return '—';
  return FUSOS_BRASIL.find((f) => f.valor === valor)?.rotulo ?? valor;
}

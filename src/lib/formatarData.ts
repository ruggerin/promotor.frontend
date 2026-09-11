// Formata um campo de data "puro" (vigência de campanha, por ex.) sem passar por
// `new Date(...)`/fuso local — o backend manda `vigencia_inicio`/`vigencia_fim` como
// timestamp UTC à meia-noite (`2026-01-01T00:00:00.000000Z`), e `new Date(iso).toLocaleDateString()`
// converte pro fuso do navegador antes de formatar: num fuso negativo (ex. America/Manaus,
// UTC-4), meia-noite UTC vira o dia anterior local, exibindo a data errada pro usuário mesmo
// que ele tenha digitado o dia certo. O dia certo já está no prefixo YYYY-MM-DD da string —
// extrair direto evita a conversão de fuso inteiramente.
export function formatarDataSemFuso(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

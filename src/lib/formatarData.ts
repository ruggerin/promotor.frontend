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

// Tempo desde um instante, na unidade que faz sentido: "12 min", "3 h", "5 dias" — "7204 min"
// (sinal de GPS da Operação do dia) não diz nada a ninguém.
export function tempoDesde(iso: string): string {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

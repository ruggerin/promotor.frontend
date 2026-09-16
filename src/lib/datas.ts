// Rótulo de dia estilo "Hoje, 16/09/2026" / "Ontem, ..." / "Terça-feira, ..." — compartilhado
// entre AtividadesPage e GaleriaFotosPage (ambas agrupam por dia com cabeçalho fixo ao rolar).
export function labelDoDia(dataISO: string): string {
  const data = new Date(dataISO);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const dataFormatada = data.toLocaleDateString('pt-BR');
  if (mesmoDia(data, hoje)) return `Hoje, ${dataFormatada}`;
  if (mesmoDia(data, ontem)) return `Ontem, ${dataFormatada}`;
  const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'long' });
  return `${diaSemana.charAt(0).toUpperCase()}${diaSemana.slice(1)}, ${dataFormatada}`;
}

export function mesmaDataLocal(aISO: string, bISO: string): boolean {
  return new Date(aISO).toDateString() === new Date(bISO).toDateString();
}

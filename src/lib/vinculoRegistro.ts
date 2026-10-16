// Onde é o registro, em texto: "Biscoito · Piraquê" quando há seção/departamento + marca
// (filtro de marca do docs/82 §5.2); senão o recorte que existir.
export function descricaoDoVinculo(registro: {
  secao?: { descricao: string } | null;
  departamento?: { descricao: string } | null;
  marca?: { descricao: string } | null;
}): string | undefined {
  const principal = registro.secao?.descricao ?? registro.departamento?.descricao;
  if (principal && registro.marca?.descricao) return `${principal} · ${registro.marca.descricao}`;
  return principal ?? registro.marca?.descricao;
}

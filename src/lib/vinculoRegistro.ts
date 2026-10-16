// Onde é o registro, em texto: "Biscoito · Piraquê" quando há seção/departamento + marca
// (filtro de marca do docs/82 §5.2); senão o recorte que existir. Com embalagem (concorrente por
// marca, docs/85): "Amaciante · Downy · 500 ml".
export function descricaoDoVinculo(registro: {
  secao?: { descricao: string } | null;
  departamento?: { descricao: string } | null;
  marca?: { descricao: string } | null;
  embalagem?: { descricao: string | null } | null;
}): string | undefined {
  const principal = registro.secao?.descricao ?? registro.departamento?.descricao;
  const base = principal && registro.marca?.descricao ? `${principal} · ${registro.marca.descricao}` : (principal ?? registro.marca?.descricao);
  const embalagem = registro.embalagem?.descricao;
  return base && embalagem ? `${base} · ${embalagem}` : base;
}

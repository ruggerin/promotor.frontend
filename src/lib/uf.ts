// Unidades da federação (docs/78 §5) — mesma lista de App\Support\Uf na API.
export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

/** "Manaus/AM" — ou só a cidade, quando a loja ainda não tem UF. */
export function cidadeComUf(cidade: string | null | undefined, uf: string | null | undefined): string {
  return [cidade, uf].filter(Boolean).join('/');
}

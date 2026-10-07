import { MenuItem, TextField, Typography } from '@mui/material';
import type { TipoComparativo } from '../../lib/api/relatorios';

export const COMPARATIVO_LABELS: Record<TipoComparativo, string> = {
  anterior: 'Período anterior (mesmo nº de dias)',
  ano_anterior: 'Mesmo período do ano anterior',
};

// Seletor "comparar com..." dos painéis padrão (docs/59 §4.3). O backend calcula o período
// equivalente e devolve os dois blocos; o front só mostra a variação.
export function SeletorComparativo({
  valor,
  onChange,
}: {
  valor: TipoComparativo | '';
  onChange: (valor: TipoComparativo | '') => void;
}) {
  return (
    <TextField
      select
      size="small"
      label="Comparar com"
      value={valor}
      onChange={(e) => onChange(e.target.value as TipoComparativo | '')}
      sx={{ width: 300 }}
    >
      <MenuItem value="">Não comparar</MenuItem>
      {(Object.keys(COMPARATIVO_LABELS) as TipoComparativo[]).map((t) => (
        <MenuItem key={t} value={t}>
          {COMPARATIVO_LABELS[t]}
        </MenuItem>
      ))}
    </TextField>
  );
}

/**
 * "▲ +12% (antes 40)" — `melhorQuandoMaior` define a cor: mais visitas cumpridas é bom, mais
 * visitas atrasadas/canceladas não.
 */
export function Variacao({
  atual,
  anterior,
  melhorQuandoMaior = true,
  sufixo = '',
}: {
  atual: number | null;
  anterior: number | null | undefined;
  melhorQuandoMaior?: boolean;
  sufixo?: string;
}) {
  if (anterior === undefined || anterior === null || atual === null) return null;

  const diferenca = atual - anterior;
  const pct = anterior === 0 ? null : Math.round((diferenca / anterior) * 100);
  const seta = diferenca === 0 ? '■' : diferenca > 0 ? '▲' : '▼';
  const bom = diferenca === 0 ? null : diferenca > 0 === melhorQuandoMaior;
  const cor = bom === null ? 'text.secondary' : bom ? 'success.main' : 'error.main';
  const sinal = diferenca > 0 ? '+' : '';

  return (
    <Typography variant="caption" sx={{ color: cor, fontWeight: 600, display: 'block' }}>
      {seta} {pct === null ? `${sinal}${diferenca}${sufixo}` : `${sinal}${pct}%`} (antes {anterior}
      {sufixo})
    </Typography>
  );
}

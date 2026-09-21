import { Box, Button } from '@mui/material';
import { TextField } from '@mui/material';

export function hojeISO(deslocamentoDias = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + deslocamentoDias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Período do relatório: dois campos de data + atalhos (hoje / 7 dias / 30 dias). */
export function FiltroPeriodo({
  inicio,
  fim,
  onChange,
}: {
  inicio: string;
  fim: string;
  onChange: (inicio: string, fim: string) => void;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
      <TextField
        size="small"
        type="date"
        label="De"
        value={inicio}
        onChange={(e) => onChange(e.target.value, fim)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        size="small"
        type="date"
        label="Até"
        value={fim}
        onChange={(e) => onChange(inicio, e.target.value)}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <Button size="small" onClick={() => onChange(hojeISO(), hojeISO())}>
        Hoje
      </Button>
      <Button size="small" onClick={() => onChange(hojeISO(-6), hojeISO())}>
        7 dias
      </Button>
      <Button size="small" onClick={() => onChange(hojeISO(-29), hojeISO())}>
        30 dias
      </Button>
    </Box>
  );
}

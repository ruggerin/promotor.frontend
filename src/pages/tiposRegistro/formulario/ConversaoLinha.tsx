import { Box, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { buscarConversaoLinha } from '../../../lib/api/tiposRegistro';

const PERIODOS = [30, 90, 180];

function dataIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Conversão do levantamento de linha ausente (docs/80 §5.3): das lojas levantadas, quantas
 * passaram a ter a linha no Mix no período. Só aparece em formulário salvo com esse escopo.
 */
export function ConversaoLinha({ tipoId }: { tipoId: string }) {
  const [dias, setDias] = useState(90);
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const query = useQuery({
    queryKey: ['conversao-linha', tipoId, dias],
    queryFn: () => buscarConversaoLinha(tipoId, dataIso(inicio), dataIso(fim)),
  });
  const d = query.data;

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1, flex: 1 }}>
          Conversão da linha
        </Typography>
        <TextField
          select
          size="small"
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          slotProps={{ htmlInput: { 'aria-label': 'Período da conversão' } }}
        >
          {PERIODOS.map((p) => (
            <MenuItem key={p} value={p}>
              {p} dias
            </MenuItem>
          ))}
        </TextField>
      </Box>
      {query.isLoading && (
        <Typography variant="body2" color="text.secondary">
          Carregando…
        </Typography>
      )}
      {query.isError && (
        <Typography variant="body2" color="error">
          Não foi possível calcular a conversão.
        </Typography>
      )}
      {d && (
        <>
          <Typography variant="h5" sx={{ fontWeight: 700, mt: 0.5 }}>
            {d.convertidas} de {d.monitoradas} {d.monitoradas === 1 ? 'loja' : 'lojas'}
            {d.percentual !== null && (
              <Typography component="span" variant="body1" color="text.secondary" sx={{ ml: 1 }}>
                ({d.percentual.toLocaleString('pt-BR')}%)
              </Typography>
            )}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Lojas levantadas em que a linha entrou no Mix nos últimos {dias} dias, depois do primeiro levantamento.
          </Typography>
          {d.lojas_convertidas.map((l) => (
            <Box key={l.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" noWrap>
                {l.fantasia}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                {new Date(l.linha_entrou_em).toLocaleDateString('pt-BR')}
              </Typography>
            </Box>
          ))}
        </>
      )}
    </Paper>
  );
}

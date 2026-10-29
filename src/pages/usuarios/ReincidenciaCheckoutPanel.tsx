import { Box, CircularProgress, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { buscarReincidenciaCheckout } from '../../lib/api/usuarios';
import type { Usuario } from '../../types/api';

// "Esqueceu o checkout N vezes" (docs/92 §9): visitas que fecharam pela saída detectada,
// automaticamente ou fora do raio. Insumo pro acompanhamento de campo e pro plano de ação.

const PERIODOS = [7, 30, 90];

function Numero({ rotulo, valor, destaque }: { rotulo: string; valor: number; destaque?: boolean }) {
  return (
    <Box sx={{ minWidth: 120 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, color: destaque && valor > 0 ? 'warning.main' : 'text.primary' }}>
        {valor}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
    </Box>
  );
}

export function ReincidenciaCheckoutPanel({ usuario }: { usuario: Usuario }) {
  const [dias, setDias] = useState(30);
  const query = useQuery({
    queryKey: ['usuarios', usuario.id, 'reincidencia-checkout', dias],
    queryFn: () => buscarReincidenciaCheckout(usuario.id, dias),
  });
  const r = query.data;

  return (
    <Paper sx={{ p: 3, mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box>
          <Typography variant="h6">Checkout esquecido</Typography>
          <Typography variant="body2" color="text.secondary">
            Visitas finalizadas pela saída detectada, automaticamente ou fora do raio da loja.
          </Typography>
        </Box>
        <TextField select size="small" label="Período" value={dias} onChange={(e) => setDias(Number(e.target.value))} sx={{ minWidth: 140 }}>
          {PERIODOS.map((p) => (
            <MenuItem key={p} value={p}>
              Últimos {p} dias
            </MenuItem>
          ))}
        </TextField>
      </Box>
      {query.isLoading && <CircularProgress size={22} />}
      {query.isError && (
        <Typography variant="body2" color="error">
          Não foi possível carregar.
        </Typography>
      )}
      {r && (
        <>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Numero rotulo="esqueceu o checkout" valor={r.esqueceu} destaque />
            <Numero rotulo="pela saída detectada" valor={r.saida_detectada} />
            <Numero rotulo="fechadas automaticamente" valor={r.automatico} />
            <Numero rotulo="checkout fora do raio" valor={r.fora_do_raio} destaque />
            <Numero rotulo="forçadas pelo gestor" valor={r.forcado_pelo_gestor} />
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
            De {r.visitas_finalizadas} {r.visitas_finalizadas === 1 ? 'visita finalizada' : 'visitas finalizadas'} no período.
          </Typography>
        </>
      )}
    </Paper>
  );
}

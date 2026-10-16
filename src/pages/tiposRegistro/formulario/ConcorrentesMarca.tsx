import { Box, Chip, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { buscarConcorrentes } from '../../../lib/api/tiposRegistro';

const PERIODOS = [30, 90, 180];

function dataIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const reais = (v: number | null) => (v === null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));

/**
 * "Quem ocupa o espaço" (docs/85 §3.4): por marca + embalagem, preço e R$ por litro/kg, do mais
 * barato, com barra comparativa e circunstâncias. Só em formulário salvo por marca concorrente.
 */
export function ConcorrentesMarca({ tipoId }: { tipoId: string }) {
  const [dias, setDias] = useState(90);
  const fim = new Date();
  const inicio = new Date(fim.getTime() - dias * 86_400_000);
  const query = useQuery({
    queryKey: ['concorrentes-marca', tipoId, dias],
    queryFn: () => buscarConcorrentes(tipoId, dataIso(inicio), dataIso(fim)),
  });
  const d = query.data;
  const maiorRef = Math.max(0, ...(d?.linhas ?? []).map((l) => l.preco_por_referencia ?? 0));

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 1, flex: 1 }}>
          Quem ocupa o espaço
        </Typography>
        <TextField
          select
          size="small"
          value={dias}
          onChange={(e) => setDias(Number(e.target.value))}
          slotProps={{ htmlInput: { 'aria-label': 'Período dos concorrentes' } }}
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
          Não foi possível carregar os concorrentes.
        </Typography>
      )}
      {d && d.linhas.length === 0 && (
        <Typography variant="body2" color="text.secondary">
          Nenhuma embalagem registrada nos últimos {dias} dias.
        </Typography>
      )}
      {d && d.linhas.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {d.destaques.total_marcas} marca(s) · {d.destaques.total_embalagens} embalagem(ns) · {d.destaques.total_registros} registro(s)
            {d.destaques.mais_barato && (
              <>
                {' '}· mais barato por {d.destaques.mais_barato.referencia}: <b>{d.destaques.mais_barato.marca.descricao} {d.destaques.mais_barato.embalagem}</b>
              </>
            )}
          </Typography>
          {d.linhas.map((l) => (
            <Box key={`${l.marca.id}-${l.embalagem}`} sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>
                  {l.marca.descricao} <Typography component="span" variant="body2" color="text.secondary">{l.embalagem}</Typography>
                </Typography>
                {l.marca.a_aprovar && <Chip size="small" variant="outlined" color="warning" label="a aprovar" />}
                <Typography variant="body2">{reais(l.preco_medio)}</Typography>
              </Box>
              {l.preco_por_referencia !== null && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Box sx={{ flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover', overflow: 'hidden' }}>
                    <Box sx={{ height: '100%', width: `${maiorRef ? (l.preco_por_referencia / maiorRef) * 100 : 0}%`, bgcolor: 'primary.main' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {reais(l.preco_por_referencia)}/{l.referencia}
                  </Typography>
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {l.lojas} loja(s)
                {l.circunstancias.filter((c) => c.valor).map((c) => ` · ${c.rotulo} ${c.valor}`).join('')}
              </Typography>
            </Box>
          ))}
        </>
      )}
    </Paper>
  );
}

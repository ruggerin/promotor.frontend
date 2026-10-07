import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { completarRelatoriosPadraoEmpresa } from '../../lib/api/relatoriosPersonalizados';

// Card "Relatórios padrão" no detalhe da empresa (SUPERADMIN) — cria os relatórios padrão do
// gerador que faltam e atualiza os de versão antiga (docs/60 §6.2). Nunca mexe nos relatórios da
// própria empresa. Mesmo efeito do comando `relatorios:completar`.
export function RelatoriosPadraoCard({ empresaUuid }: { empresaUuid: string }) {
  const mutation = useMutation({ mutationFn: () => completarRelatoriosPadraoEmpresa(empresaUuid) });
  const r = mutation.data;
  const mudou = r ? r.criados.length + r.atualizados.length : 0;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h6">Relatórios padrão</Typography>
          <Typography variant="body2" color="text.secondary">
            Planejadas × canceladas × executadas e Tempo dentro do PDV
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<PlaylistAddCheckIcon />} disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Completando…' : 'Completar relatórios padrão'}
        </Button>
      </Box>
      {mutation.isError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          Não foi possível completar os relatórios padrão.
        </Alert>
      )}
      {r && (
        <Alert severity={mudou ? 'success' : 'info'} sx={{ mt: 1.5 }}>
          {mudou
            ? [r.criados.length && `${r.criados.length} criado(s)`, r.atualizados.length && `${r.atualizados.length} atualizado(s)`]
                .filter(Boolean)
                .join(' e ') + '.'
            : 'A empresa já tinha todos os relatórios padrão em dia.'}
        </Alert>
      )}
    </Paper>
  );
}

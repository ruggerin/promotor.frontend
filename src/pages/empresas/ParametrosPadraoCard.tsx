import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { buscarParametrosPadraoEmpresa, completarParametrosPadraoEmpresa } from '../../lib/api/empresas';

// Card "Parâmetros padrão" no detalhe da empresa (SUPERADMIN) — mostra quais parâmetros do
// catálogo (App\Support\ParametrosPadrao) a empresa ainda não tem e cadastra os que faltam com um
// clique. Cadastrar não muda o comportamento da empresa (o valor é o mesmo que o sistema já assume
// quando falta) — só faz o parâmetro aparecer na tela Parâmetros dela, pra poder ajustar.
export function ParametrosPadraoCard({ empresaUuid }: { empresaUuid: string }) {
  const queryClient = useQueryClient();
  const [confirmando, setConfirmando] = useState(false);
  const [criados, setCriados] = useState<string[] | null>(null);

  const query = useQuery({
    queryKey: ['superadmin', 'parametros-padrao', empresaUuid],
    queryFn: () => buscarParametrosPadraoEmpresa(empresaUuid),
  });

  const mutation = useMutation({
    mutationFn: () => completarParametrosPadraoEmpresa(empresaUuid),
    onSuccess: (data) => {
      queryClient.setQueryData(['superadmin', 'parametros-padrao', empresaUuid], data.parametros);
      setCriados(data.criados);
      setConfirmando(false);
    },
  });

  const parametros = query.data ?? [];
  const faltando = parametros.filter((p) => !p.cadastrado);
  const cadastrados = parametros.length - faltando.length;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1 }}>
        <Box>
          <Typography variant="h6">Parâmetros padrão</Typography>
          {!query.isLoading && (
            <Typography variant="body2" color="text.secondary">
              {cadastrados} de {parametros.length} cadastrados
            </Typography>
          )}
        </Box>
        {faltando.length > 0 && (
          <Button variant="contained" startIcon={<PlaylistAddCheckIcon />} onClick={() => setConfirmando(true)}>
            Cadastrar {faltando.length === 1 ? 'o que falta' : `os ${faltando.length} que faltam`}
          </Button>
        )}
      </Box>

      {query.isLoading && <CircularProgress size={22} />}
      {query.isError && <Alert severity="error">Não foi possível carregar os parâmetros da empresa.</Alert>}

      {criados && criados.length > 0 && (
        <Alert severity="success" onClose={() => setCriados(null)} sx={{ mb: 1.5 }}>
          {criados.length} {criados.length === 1 ? 'parâmetro cadastrado' : 'parâmetros cadastrados'}: {criados.join(', ')}.
        </Alert>
      )}

      {!query.isLoading && !query.isError && (
        faltando.length === 0 ? (
          <Typography variant="body2" color="success.main">
            Todos os parâmetros padrão já estão cadastrados nesta empresa.
          </Typography>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Faltam (passe o mouse pra ver o que cada um faz e o valor que será usado):
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {faltando.map((p) => (
                <Tooltip key={p.chave} title={`${p.descricao} — valor padrão: ${p.valor_padrao}`}>
                  <Chip label={p.chave} size="small" variant="outlined" sx={{ fontFamily: 'monospace' }} />
                </Tooltip>
              ))}
            </Box>
          </>
        )
      )}

      <Dialog open={confirmando} onClose={() => !mutation.isPending && setConfirmando(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cadastrar parâmetros padrão?</DialogTitle>
        <DialogContent>
          <DialogContentText component="div">
            <p style={{ marginTop: 0 }}>
              Vão ser cadastrados <b>{faltando.length}</b> parâmetros, cada um com o valor que o sistema já usa hoje
              quando o parâmetro não existe — <b>o comportamento da empresa não muda</b>. Eles só passam a aparecer na
              tela <i>Parâmetros</i> da empresa, pra ela poder ajustar.
            </p>
            <p style={{ marginBottom: 0 }}>
              Nenhum parâmetro que a empresa já tem é alterado — nem o valor, nem se está ativo ou desativado.
            </p>
          </DialogContentText>
          {mutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              Não foi possível cadastrar os parâmetros.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmando(false)} disabled={mutation.isPending}>
            Voltar
          </Button>
          <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? 'Cadastrando...' : 'Cadastrar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

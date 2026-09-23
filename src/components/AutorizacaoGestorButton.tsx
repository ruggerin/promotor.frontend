import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Snackbar, Stack, Typography } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { gerarAutorizacaoGestor } from '../lib/api/autorizacoesGestor';

// Código de 6 dígitos pra liberar cancelamento de visita travada sem o gestor digitar e-mail e
// senha no aparelho do promotor — ver docs/15-INTERVENCAO-ADMINISTRATIVA-VISITA.md §12. Só
// ADMIN/GESTOR com visitas.intervir têm o ícone (o backend também barra com 403).
export function AutorizacaoGestorButton() {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [erroCopia, setErroCopia] = useState(false);
  const [segundosRestantes, setSegundosRestantes] = useState(0);

  const [erroGeracao, setErroGeracao] = useState(false);

  const mutation = useMutation({
    mutationFn: gerarAutorizacaoGestor,
    onSuccess: () => setAberto(true),
    onError: () => setErroGeracao(true),
  });

  useEffect(() => {
    if (!mutation.data) return;
    const atualizar = () => {
      const restante = Math.max(0, Math.round((new Date(mutation.data!.expira_em).getTime() - Date.now()) / 1000));
      setSegundosRestantes(restante);
    };
    atualizar();
    const intervalo = setInterval(atualizar, 1000);
    return () => clearInterval(intervalo);
  }, [mutation.data]);

  function copiar() {
    if (!mutation.data) return;
    // Sem `navigator.clipboard` (contexto sem permissão, ex. iframe restrito) — falha visível
    // em vez de promise rejeitada sem handler; o código já está grande na tela pra copiar à mão.
    navigator.clipboard
      .writeText(mutation.data.codigo)
      .then(() => setCopiado(true))
      .catch(() => setErroCopia(true));
  }

  const expirado = segundosRestantes <= 0;
  const minutos = String(Math.floor(segundosRestantes / 60)).padStart(2, '0');
  const segundos = String(segundosRestantes % 60).padStart(2, '0');

  return (
    <>
      <IconButton onClick={() => mutation.mutate()} title="Gerar código de autorização">
        <VpnKeyIcon />
      </IconButton>

      <Dialog open={aberto} onClose={() => setAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Código de autorização</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Dite esse código pro promotor pelo telefone, em vez de digitar seu e-mail e senha no
            aparelho dele. Vale por 10 minutos e só funciona uma vez.
          </Typography>

          <Stack sx={{ alignItems: 'center', gap: 1, py: 2 }}>
            <Typography
              variant="h3"
              sx={{ fontFamily: 'monospace', letterSpacing: '0.15em', opacity: expirado ? 0.35 : 1 }}
            >
              {mutation.data?.codigo ?? '------'}
            </Typography>
            <Typography variant="body2" color={expirado ? 'error' : 'text.secondary'}>
              {expirado ? 'Código expirado' : `Expira em ${minutos}:${segundos}`}
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
          >
            Gerar novo
          </Button>
          <Button startIcon={<ContentCopyIcon />} onClick={copiar} disabled={expirado}>
            Copiar
          </Button>
          <Button onClick={() => setAberto(false)} variant="contained">
            Fechar
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={copiado}
        autoHideDuration={2500}
        onClose={() => setCopiado(false)}
        message="Código copiado"
      />
      <Snackbar
        open={erroCopia}
        autoHideDuration={2500}
        onClose={() => setErroCopia(false)}
        message="Não foi possível copiar — selecione o código na tela"
      />
      <Snackbar
        open={erroGeracao}
        autoHideDuration={2500}
        onClose={() => setErroGeracao(false)}
        message="Não foi possível gerar o código agora"
      />
    </>
  );
}

import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LockIcon from '@mui/icons-material/LockOutlined';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';

// docs/96 §6.1 — o token em texto puro aparece só aqui, uma vez. Fechar exige confirmar que foi
// copiado (sem fechar clicando fora), porque depois não tem como ver de novo.

interface Props {
  open: boolean;
  nome: string;
  token: string | null;
  /** Depois de "Gerar novo token": até quando o antigo ainda vale. */
  antigoValidoAte?: string | null;
  onClose: () => void;
}

export function TokenCriadoDialog({ open, nome, token, antigoValidoAte, onClose }: Props) {
  const [copiado, setCopiado] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (open) {
      setCopiado(false);
      setConfirmado(false);
    }
  }, [open]);

  async function copiar() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopiado(true);
      setConfirmado(true);
    } catch {
      setCopiado(false);
    }
  }

  const base = `${String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')}/integracao/v1`;

  return (
    <Dialog open={open} maxWidth="sm" fullWidth onClose={(_, motivo) => motivo !== 'backdropClick' && motivo !== 'escapeKeyDown' && onClose()}>
      <DialogTitle>{antigoValidoAte ? `Novo token de "${nome}"` : `Integração "${nome}" criada`}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Alert severity="warning" icon={<LockIcon />}>
            <strong>Copie o token agora.</strong> Por segurança, ele não vai aparecer de novo. Se perder, gere um novo na tela da integração.
          </Alert>
          {antigoValidoAte && (
            <Alert severity="info">
              O token antigo continua valendo até {new Date(antigoValidoAte).toLocaleDateString('pt-BR')}, para dar tempo de trocar no sistema do cliente. Depois disso, ele para sozinho.
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField
              label="Token"
              value={token ?? ''}
              fullWidth
              sx={{ flex: '1 1 320px' }}
              slotProps={{ htmlInput: { readOnly: true, style: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 } } }}
              onFocus={(e) => e.target.select()}
            />
            <Button variant="contained" startIcon={<ContentCopyIcon />} onClick={() => void copiar()} sx={{ minHeight: 40 }}>
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
          </Box>
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500 }} gutterBottom>
              Primeira chamada
            </Typography>
            <Box
              component="pre"
              sx={{ m: 0, p: 1.5, borderRadius: 1, bgcolor: 'grey.900', color: 'grey.100', fontFamily: 'IBM Plex Mono, monospace', fontSize: 12, overflowX: 'auto' }}
            >
              {`curl ${base}/visitas \\\n  -H "Authorization: Bearer ${token ? `${token.slice(0, 15)}…` : ''}"`}
            </Box>
          </Box>
          <FormControlLabel control={<Checkbox checked={confirmado} onChange={(e) => setConfirmado(e.target.checked)} />} label="Já copiei e guardei o token" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" disabled={!confirmado} onClick={onClose}>
          Concluir
        </Button>
      </DialogActions>
    </Dialog>
  );
}

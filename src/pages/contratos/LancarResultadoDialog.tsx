import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { atualizarContratoMeta } from '../../lib/api/contratoMetas';
import type { Contrato, ContratoMeta } from '../../types/api';

interface LancarResultadoDialogProps {
  open: boolean;
  contrato: Contrato;
  meta: ContratoMeta | null;
  onClose: () => void;
}

/**
 * "Lançar o resultado" é só editar o campo `resultado_apurado` (ver
 * docs/09-CONTRATO-METAS.md §5) — não existe integração com ERP nesta fase, alguém consulta o
 * relatório de vendas por fora e digita o número aqui.
 */
export function LancarResultadoDialog({ open, contrato, meta, onClose }: LancarResultadoDialogProps) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErro(null);
      setValor(meta?.resultado_apurado != null ? String(meta.resultado_apurado) : '');
    }
  }, [open, meta]);

  const mutation = useMutation({
    mutationFn: (resultado_apurado: number) => atualizarContratoMeta(contrato.id, meta!.id, { resultado_apurado }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contratos'] });
      onClose();
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível lançar o resultado.';
      setErro(mensagem);
    },
  });

  if (!meta) return null;

  const numero = Number(valor.replace(',', '.'));
  const valido = valor.trim() !== '' && !Number.isNaN(numero) && numero >= 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Lançar resultado</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          Quanto de venda incremental foi realmente apurado nesta meta (consultado por fora, no
          ERP/relatório de vendas do período).
        </DialogContentText>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Meta negociada: R$ {Number(meta.meta_valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </Typography>

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        <Box component="form" onSubmit={(e) => e.preventDefault()}>
          <TextField
            label="Resultado apurado (R$)"
            type="number"
            fullWidth
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!valido || mutation.isPending}
          onClick={() => mutation.mutate(numero)}
        >
          {mutation.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

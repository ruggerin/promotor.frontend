import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useEffect, useState } from 'react';
import type { Usuario } from '../../types/api';

interface AtribuirPromotorDialogProps {
  open: boolean;
  promotores: Usuario[];
  loadingPromotores: boolean;
  quantidadeSelecionada: number;
  atribuindo: boolean;
  onClose: () => void;
  onConfirmar: (promotorUuid: string) => void;
}

/**
 * Soma um promotor à atribuição de N lojas de uma vez (regra de negócio 6, ver
 * docs/02-API-BACKEND.md) — não substitui quem já estava atribuído nelas, só adiciona. Pra
 * remover um promotor de uma loja específica, usa o "x" do chip na própria listagem.
 */
export function AtribuirPromotorDialog({
  open,
  promotores,
  loadingPromotores,
  quantidadeSelecionada,
  atribuindo,
  onClose,
  onConfirmar,
}: AtribuirPromotorDialogProps) {
  const [promotorUuid, setPromotorUuid] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPromotorUuid(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Atribuir promotor</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {quantidadeSelecionada === 1
            ? 'Escolha o promotor que vai atender a loja selecionada.'
            : `Escolha o promotor que vai atender as ${quantidadeSelecionada} lojas selecionadas.`}{' '}
          Quem já estiver atribuído a elas continua — isso soma, não substitui.
        </DialogContentText>
        <Autocomplete
          options={promotores}
          getOptionLabel={(option) => option.nome}
          loading={loadingPromotores}
          onChange={(_, value) => setPromotorUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Promotor" autoFocus />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!promotorUuid || atribuindo}
          onClick={() => {
            if (promotorUuid) {
              onConfirmar(promotorUuid);
            }
          }}
        >
          {atribuindo ? 'Atribuindo...' : 'Atribuir'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

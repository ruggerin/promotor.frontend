import { Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useEffect, useState } from 'react';

// Opção extra no topo da lista pra tirar o vínculo das lojas (ex.: "Sem rede").
const LIMPAR = '__limpar__';

interface Opcao {
  id: string;
  descricao: string;
}

interface AlterarCampoEmMassaDialogProps {
  open: boolean;
  titulo: string;
  rotuloCampo: string;
  rotuloLimpar: string;
  opcoes: Opcao[];
  loadingOpcoes: boolean;
  quantidadeSelecionada: number;
  salvando: boolean;
  onClose: () => void;
  // null = remover o vínculo das lojas selecionadas.
  onConfirmar: (uuid: string | null) => void;
}

/**
 * Troca um campo de cadastro (rede, ramo de atividade) de N lojas de uma vez — diferente do
 * promotor, aqui é substituição: cada loja tem um valor só.
 */
export function AlterarCampoEmMassaDialog({
  open,
  titulo,
  rotuloCampo,
  rotuloLimpar,
  opcoes,
  loadingOpcoes,
  quantidadeSelecionada,
  salvando,
  onClose,
  onConfirmar,
}: AlterarCampoEmMassaDialogProps) {
  const [escolha, setEscolha] = useState<Opcao | null>(null);

  useEffect(() => {
    if (open) {
      setEscolha(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {quantidadeSelecionada === 1
            ? `Escolha o novo valor de ${rotuloCampo.toLowerCase()} da loja selecionada.`
            : `Escolha o novo valor de ${rotuloCampo.toLowerCase()} das ${quantidadeSelecionada} lojas selecionadas.`}{' '}
          O valor atual de cada uma é substituído.
        </DialogContentText>
        <Autocomplete
          options={[{ id: LIMPAR, descricao: rotuloLimpar }, ...opcoes]}
          getOptionLabel={(option) => option.descricao}
          loading={loadingOpcoes}
          value={escolha}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          onChange={(_, value) => setEscolha(value)}
          renderInput={(params) => <TextField {...params} label={rotuloCampo} autoFocus />}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={!escolha || salvando}
          onClick={() => {
            if (escolha) {
              onConfirmar(escolha.id === LIMPAR ? null : escolha.id);
            }
          }}
        >
          {salvando ? 'Salvando...' : 'Aplicar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

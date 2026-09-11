import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField } from '@mui/material';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarNivelExibicao, criarNivelExibicao } from '../../lib/api/niveisExibicao';
import type { NivelExibicao } from '../../types/api';

const schema = z.object({ descricao: z.string().min(1, 'Obrigatório').max(255), ativo: z.boolean() });
type FormData = z.infer<typeof schema>;
const DEFAULT_VALUES: FormData = { descricao: '', ativo: true };

interface NivelExibicaoFormDialogProps {
  open: boolean;
  nivel: NivelExibicao | null;
  onClose: () => void;
}

export function NivelExibicaoFormDialog({ open, nivel, onClose }: NivelExibicaoFormDialogProps) {
  const modoEdicao = nivel !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(nivel ? { descricao: nivel.descricao, ativo: nivel.ativo } : DEFAULT_VALUES);
    }
  }, [open, nivel, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (modoEdicao) {
        return atualizarNivelExibicao(nivel!.id, data);
      }
      return criarNivelExibicao({ descricao: data.descricao });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['niveis-exibicao'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (campo in DEFAULT_VALUES) {
              setError(campo as keyof FormData, { message: mensagens[0] });
            }
          }
        }
        setErroGeral(errors ? null : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar nível de exibição' : 'Novo nível de exibição'}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) =>
          void handleSubmit((data) => {
            setErroGeral(null);
            mutation.mutate(data);
          })(e)
        }
        noValidate
      >
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}
          <Controller
            name="descricao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Descrição"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Ex.: Prateleira, Ponta de gôndola, Checkout'}
                autoFocus
              />
            )}
          />
          {modoEdicao && (
            <Controller
              name="ativo"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Ativo"
                />
              )}
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarObjetivoVisita, criarObjetivoVisita } from '../../lib/api/objetivosVisita';
import type { ObjetivoVisita } from '../../types/api';

const schema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(60),
});

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = { descricao: '' };

interface ObjetivoVisitaFormDialogProps {
  open: boolean;
  objetivoVisita: ObjetivoVisita | null;
  onClose: () => void;
}

export function ObjetivoVisitaFormDialog({ open, objetivoVisita, onClose }: ObjetivoVisitaFormDialogProps) {
  const modoEdicao = objetivoVisita !== null;
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
      reset(objetivoVisita ? { descricao: objetivoVisita.descricao } : DEFAULT_VALUES);
    }
  }, [open, objetivoVisita, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      modoEdicao ? atualizarObjetivoVisita(objetivoVisita!.id, data) : criarObjetivoVisita(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['objetivos-visita'] });
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
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar objetivo de visita' : 'Novo objetivo de visita'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)} noValidate>
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
                placeholder="Ex.: Reposição, Negociação, Retomada de volume"
                fullWidth
                autoFocus
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
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

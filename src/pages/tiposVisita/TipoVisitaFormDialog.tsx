import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarTipoVisita, criarTipoVisita } from '../../lib/api/tiposVisita';
import type { TipoVisita } from '../../types/api';

const schema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(60),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
});

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = { descricao: '', cor: '#2563EB' };

interface TipoVisitaFormDialogProps {
  open: boolean;
  tipoVisita: TipoVisita | null;
  onClose: () => void;
}

export function TipoVisitaFormDialog({ open, tipoVisita, onClose }: TipoVisitaFormDialogProps) {
  const modoEdicao = tipoVisita !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(tipoVisita ? { descricao: tipoVisita.descricao, cor: tipoVisita.cor } : DEFAULT_VALUES);
    }
  }, [open, tipoVisita, reset]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => (modoEdicao ? atualizarTipoVisita(tipoVisita!.id, data) : criarTipoVisita(data)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tipos-visita'] });
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

  const descricao = watch('descricao');
  const cor = watch('cor');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar tipo de visita' : 'Novo tipo de visita'}</DialogTitle>
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
                placeholder="Ex.: Reposição, Auditoria, Ponto extra"
                fullWidth
                autoFocus
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <Controller
              name="cor"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Cor"
                  type="color"
                  sx={{ width: 100 }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            {descricao && <Chip label={descricao} sx={{ bgcolor: cor, color: '#fff', fontWeight: 600 }} />}
          </Box>
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

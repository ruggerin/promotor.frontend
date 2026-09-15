import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Switch, TextField } from '@mui/material';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarPlanograma, criarPlanograma } from '../../lib/api/planogramas';
import type { Planograma } from '../../types/api';

const schema = z.object({ descricao: z.string().min(1, 'Obrigatório').max(255), ativo: z.boolean() });
type FormData = z.infer<typeof schema>;
const DEFAULT_VALUES: FormData = { descricao: '', ativo: true };

interface PlanogramaFormDialogProps {
  open: boolean;
  planograma: Planograma | null;
  onClose: () => void;
}

export function PlanogramaFormDialog({ open, planograma, onClose }: PlanogramaFormDialogProps) {
  const modoEdicao = planograma !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(planograma ? { descricao: planograma.descricao, ativo: planograma.ativo } : DEFAULT_VALUES);
    }
  }, [open, planograma, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (modoEdicao) {
        return atualizarPlanograma(planograma!.id, data);
      }
      return criarPlanograma(data.descricao);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planogramas'] });
      onClose();
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível salvar.';
      setErroGeral(mensagem);
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar planograma' : 'Novo planograma'}</DialogTitle>
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
                helperText={fieldState.error?.message ?? 'Ex.: Gôndola Refrigerantes, Expositor Pilha Panasonic'}
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

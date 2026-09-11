import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
} from '@mui/material';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarParametro, criarParametro } from '../../lib/api/parametros';
import type { Parametro } from '../../types/api';

const schema = z.object({
  chave: z
    .string()
    .min(1, 'Obrigatório')
    .max(100)
    .regex(/^[A-Z0-9_]+$/, 'Só letras maiúsculas, números e underscore (ex.: CHECKIN_RAIO_METROS).'),
  valor: z.string().min(1, 'Obrigatório'),
  descricao: z.string(),
  ativo: z.boolean(),
});

type ParametroFormData = z.infer<typeof schema>;

const DEFAULT_VALUES: ParametroFormData = { chave: '', valor: '', descricao: '', ativo: true };

interface ParametroFormDialogProps {
  open: boolean;
  parametro: Parametro | null;
  onClose: () => void;
}

export function ParametroFormDialog({ open, parametro, onClose }: ParametroFormDialogProps) {
  const modoEdicao = parametro !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<ParametroFormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        parametro
          ? { chave: parametro.chave, valor: parametro.valor, descricao: parametro.descricao ?? '', ativo: parametro.ativo }
          : DEFAULT_VALUES,
      );
    }
  }, [open, parametro, reset]);

  const mutation = useMutation({
    mutationFn: async (data: ParametroFormData) => {
      const payload = {
        chave: data.chave,
        valor: data.valor,
        descricao: data.descricao || null,
      };

      if (modoEdicao) {
        return atualizarParametro(parametro!.id, { ...payload, ativo: data.ativo });
      }

      return criarParametro(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['parametros'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (campo in DEFAULT_VALUES) {
              setError(campo as keyof ParametroFormData, { message: mensagens[0] });
            }
          }
        }
        setErroGeral(errors ? null : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  function onSubmit(data: ParametroFormData) {
    setErroGeral(null);
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar parâmetro' : 'Novo parâmetro'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

          <Controller
            name="chave"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                label="Chave"
                placeholder="CHECKIN_RAIO_METROS"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Maiúsculas, números e underscore — identifica o parâmetro pro sistema.'}
                autoFocus
              />
            )}
          />
          <Controller
            name="valor"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Valor"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Sempre texto — quem consome decide como interpretar (número, sim/não etc).'}
              />
            )}
          />
          <Controller
            name="descricao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Descrição"
                placeholder="Pra que serve este parâmetro"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
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

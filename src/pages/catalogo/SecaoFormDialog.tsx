import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Autocomplete,
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
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { atualizarSecao, criarSecao } from '../../lib/api/secoes';
import type { SecaoAuditoria } from '../../types/api';

const schema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(255),
  departamento_uuid: z.string().nullable(),
  ativo: z.boolean(),
});
type FormData = z.infer<typeof schema>;
const DEFAULT_VALUES: FormData = { descricao: '', departamento_uuid: null, ativo: true };

interface SecaoFormDialogProps {
  open: boolean;
  secao: SecaoAuditoria | null;
  onClose: () => void;
}

export function SecaoFormDialog({ open, secao, onClose }: SecaoFormDialogProps) {
  const modoEdicao = secao !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const departamentosQuery = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => listarDepartamentos(),
    enabled: open,
  });

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
      reset(
        secao
          ? { descricao: secao.descricao, departamento_uuid: secao.departamento?.id ?? null, ativo: secao.ativo }
          : DEFAULT_VALUES,
      );
    }
  }, [open, secao, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (modoEdicao) {
        return atualizarSecao(secao!.id, data);
      }
      return criarSecao({ descricao: data.descricao, departamento_uuid: data.departamento_uuid });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['secoes'] });
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
      <DialogTitle>{modoEdicao ? 'Editar seção' : 'Nova seção'}</DialogTitle>
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
                helperText={fieldState.error?.message}
                autoFocus
              />
            )}
          />
          <Controller
            name="departamento_uuid"
            control={control}
            render={({ field, fieldState }) => (
              <Autocomplete
                options={departamentosQuery.data?.departamentos ?? []}
                getOptionLabel={(option) => option.descricao}
                loading={departamentosQuery.isLoading}
                value={departamentosQuery.data?.departamentos.find((d) => d.id === field.value) ?? null}
                onChange={(_, value) => field.onChange(value?.id ?? null)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Departamento"
                    margin="normal"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? 'Opcional'}
                  />
                )}
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

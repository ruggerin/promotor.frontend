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
import { atualizarPontoVenda, criarPontoVenda } from '../../lib/api/pontosVenda';
import type { PontoVenda } from '../../types/api';

const schema = z.object({
  codigo_externo: z.string(),
  cnpj: z.string(),
  razao_social: z.string().min(1, 'Obrigatório').max(255),
  fantasia: z.string().min(1, 'Obrigatório').max(255),
  latitude: z
    .string()
    .min(1, 'Obrigatório')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= -90 && Number(v) <= 90, 'Entre -90 e 90'),
  longitude: z
    .string()
    .min(1, 'Obrigatório')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= -180 && Number(v) <= 180, 'Entre -180 e 180'),
  endereco: z.string().min(1, 'Obrigatório').max(255),
  numero: z.string(),
  bairro: z.string(),
  cidade: z.string().min(1, 'Obrigatório').max(100),
  cep: z.string(),
  telefone: z.string(),
  email: z.union([z.literal(''), z.string().email('E-mail inválido')]),
  ativo: z.boolean(),
});

type PontoVendaFormData = z.infer<typeof schema>;

const DEFAULT_VALUES: PontoVendaFormData = {
  codigo_externo: '',
  cnpj: '',
  razao_social: '',
  fantasia: '',
  latitude: '',
  longitude: '',
  endereco: '',
  numero: '',
  bairro: '',
  cidade: '',
  cep: '',
  telefone: '',
  email: '',
  ativo: true,
};

interface PontoVendaFormDialogProps {
  open: boolean;
  pontoVenda: PontoVenda | null;
  onClose: () => void;
}

export function PontoVendaFormDialog({ open, pontoVenda, onClose }: PontoVendaFormDialogProps) {
  const modoEdicao = pontoVenda !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<PontoVendaFormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        pontoVenda
          ? {
              codigo_externo: pontoVenda.codigo_externo ?? '',
              cnpj: pontoVenda.cnpj ?? '',
              razao_social: pontoVenda.razao_social,
              fantasia: pontoVenda.fantasia,
              latitude: String(pontoVenda.latitude),
              longitude: String(pontoVenda.longitude),
              endereco: pontoVenda.endereco,
              numero: pontoVenda.numero ?? '',
              bairro: pontoVenda.bairro ?? '',
              cidade: pontoVenda.cidade,
              cep: pontoVenda.cep ?? '',
              telefone: pontoVenda.telefone ?? '',
              email: pontoVenda.email ?? '',
              ativo: pontoVenda.ativo,
            }
          : DEFAULT_VALUES,
      );
    }
  }, [open, pontoVenda, reset]);

  const mutation = useMutation({
    mutationFn: async (data: PontoVendaFormData) => {
      const payload = {
        codigo_externo: data.codigo_externo || null,
        cnpj: data.cnpj || null,
        razao_social: data.razao_social,
        fantasia: data.fantasia,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        endereco: data.endereco,
        numero: data.numero || null,
        bairro: data.bairro || null,
        cidade: data.cidade,
        cep: data.cep || null,
        telefone: data.telefone || null,
        email: data.email || null,
      };

      if (modoEdicao) {
        return atualizarPontoVenda(pontoVenda!.id, { ...payload, ativo: data.ativo });
      }

      return criarPontoVenda(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (campo in DEFAULT_VALUES) {
              setError(campo as keyof PontoVendaFormData, { message: mensagens[0] });
            }
          }
        }
        setErroGeral(errors ? null : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  function onSubmit(data: PontoVendaFormData) {
    setErroGeral(null);
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar ponto de venda' : 'Novo ponto de venda'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

          <Controller
            name="fantasia"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nome fantasia"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                autoFocus
              />
            )}
          />
          <Controller
            name="razao_social"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Razão social"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="codigo_externo"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Código externo"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="cnpj"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="CNPJ"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="latitude"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Latitude"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="longitude"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Longitude"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
          <Controller
            name="endereco"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Endereço"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="numero"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Número"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="bairro"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Bairro"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="cidade"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Cidade"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="cep"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="CEP"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="telefone"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Telefone"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="E-mail"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
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

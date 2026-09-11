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
  MenuItem,
  TextField,
} from '@mui/material';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { criarContratoMeta } from '../../lib/api/contratoMetas';
import { listarMarcas } from '../../lib/api/marcas';
import type { Contrato, FontePagamentoMeta } from '../../types/api';

const FONTES: { value: FontePagamentoMeta; label: string }[] = [
  { value: 'EMPRESA', label: 'Empresa (distribuidora)' },
  { value: 'INDUSTRIA', label: 'Indústria (fabricante)' },
  { value: 'COMPARTILHADO', label: 'Compartilhado (empresa + indústria)' },
];

const schema = z
  .object({
    marca_uuid: z.string().nullable(),
    descricao: z.string(),
    valor_investimento: z
      .string()
      .min(1, 'Obrigatório')
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Deve ser um número > 0'),
    meta_valor: z
      .string()
      .min(1, 'Obrigatório')
      .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0, 'Deve ser um número > 0'),
    periodo_inicio: z.string().min(1, 'Obrigatório'),
    periodo_fim: z.string().min(1, 'Obrigatório'),
    fonte_pagamento: z.enum(['EMPRESA', 'INDUSTRIA', 'COMPARTILHADO']),
    percentual_industria: z.string(),
  })
  .refine((data) => data.periodo_fim >= data.periodo_inicio, {
    message: 'Deve ser depois do início',
    path: ['periodo_fim'],
  })
  .refine(
    (data) =>
      data.fonte_pagamento !== 'COMPARTILHADO'
      || (!Number.isNaN(Number(data.percentual_industria)) && Number(data.percentual_industria) >= 0 && Number(data.percentual_industria) <= 100),
    { message: 'Obrigatório entre 0 e 100 quando compartilhado', path: ['percentual_industria'] },
  );

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  marca_uuid: null,
  descricao: '',
  valor_investimento: '',
  meta_valor: '',
  periodo_inicio: '',
  periodo_fim: '',
  fonte_pagamento: 'EMPRESA',
  percentual_industria: '',
};

interface ContratoMetaFormDialogProps {
  open: boolean;
  contrato: Contrato;
  onClose: () => void;
}

/**
 * Só criação — editar os campos negociados depois de já existir não é um fluxo previsto no
 * desenho (ver docs/09-CONTRATO-METAS.md §6), só "lançar resultado" (LancarResultadoDialog) e
 * remover.
 */
export function ContratoMetaFormDialog({ open, contrato, onClose }: ContratoMetaFormDialogProps) {
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(DEFAULT_VALUES);
    }
  }, [open, reset]);

  const fontePagamento = watch('fonte_pagamento');

  // Escopada pela empresa do contrato (relevante pro SUPERADMIN, que não tem empresa própria
  // pra herdar o filtro automático — ver docs/02-API-BACKEND.md#catálogo-de-auditoria).
  const marcasQuery = useQuery({
    queryKey: ['marcas', { empresaUuid: contrato.empresa?.id }],
    queryFn: () => listarMarcas({ empresa_uuid: contrato.empresa?.id, ativo: true }),
    enabled: open,
  });
  const marcas = marcasQuery.data?.marcas ?? [];

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      criarContratoMeta(contrato.id, {
        marca_uuid: data.marca_uuid,
        descricao: data.descricao || null,
        valor_investimento: Number(data.valor_investimento),
        meta_valor: Number(data.meta_valor),
        periodo_inicio: data.periodo_inicio,
        periodo_fim: data.periodo_fim,
        fonte_pagamento: data.fonte_pagamento,
        percentual_industria: data.fonte_pagamento === 'COMPARTILHADO' ? Number(data.percentual_industria) : null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['contratos'] });
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
      <DialogTitle>Nova meta — {contrato.ponto_venda?.fantasia}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

          <Controller
            name="marca_uuid"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={marcas}
                getOptionLabel={(option) => option.descricao}
                loading={marcasQuery.isLoading}
                value={marcas.find((m) => m.id === field.value) ?? null}
                onChange={(_, value) => field.onChange(value?.id ?? null)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Marca"
                    margin="normal"
                    fullWidth
                    helperText="Deixe em branco pra meta geral do PDV, sem recorte por marca"
                  />
                )}
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
                placeholder="Ex.: Giro de pilhas alcalinas no verão"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="valor_investimento"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Valor investido (R$)"
                  type="number"
                  fullWidth
                  margin="normal"
                  slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="meta_valor"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Meta de venda incremental (R$)"
                  type="number"
                  fullWidth
                  margin="normal"
                  slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="periodo_inicio"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Período início"
                  type="date"
                  fullWidth
                  margin="normal"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="periodo_fim"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Período fim"
                  type="date"
                  fullWidth
                  margin="normal"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="fonte_pagamento"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Quem banca"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {FONTES.map((fonte) => (
                    <MenuItem key={fonte.value} value={fonte.value}>
                      {fonte.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            {fontePagamento === 'COMPARTILHADO' && (
              <Controller
                name="percentual_industria"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="% indústria"
                    type="number"
                    fullWidth
                    margin="normal"
                    slotProps={{ htmlInput: { step: '1', min: 0, max: 100 } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? 'Resto fica com a empresa'}
                  />
                )}
              />
            )}
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

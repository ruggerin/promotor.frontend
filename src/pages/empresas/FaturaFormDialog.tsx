import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarFatura, criarFatura } from '../../lib/api/faturas';
import type { Fatura, StatusFatura } from '../../types/api';

const STATUS_OPCOES: { value: StatusFatura; label: string }[] = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'PAGA', label: 'Paga' },
  { value: 'CANCELADA', label: 'Cancelada' },
];

const schema = z
  .object({
    valor: z.string().min(1, 'Obrigatório'),
    referencia: z.string().min(1, 'Obrigatório'),
    vencimento: z.string().min(1, 'Obrigatório'),
    status: z.enum(['PENDENTE', 'PAGA', 'CANCELADA']),
    pago_em: z.string(),
    observacao: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!/^\d+([.,]\d{1,2})?$/.test(data.valor)) {
      ctx.addIssue({ code: 'custom', message: 'Valor inválido (ex.: 199.90)', path: ['valor'] });
    }
  });

type FaturaFormData = z.infer<typeof schema>;

interface FaturaFormDialogProps {
  open: boolean;
  empresaUuid: string;
  fatura: Fatura | null;
  onClose: () => void;
}

// Registro manual de cobrança — sem gateway de pagamento (ver docs/00-VISAO-GERAL.md). Mesmo
// padrão de EmpresaFormDialog: um dialog só, alterna criar/editar por `fatura !== null`.
export function FaturaFormDialog({ open, empresaUuid, fatura, onClose }: FaturaFormDialogProps) {
  const modoEdicao = fatura !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { isSubmitting },
  } = useForm<FaturaFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      valor: '',
      referencia: '',
      vencimento: '',
      status: 'PENDENTE',
      pago_em: '',
      observacao: '',
    },
  });

  const statusAtual = watch('status');

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        fatura
          ? {
              valor: String(fatura.valor),
              referencia: fatura.referencia,
              vencimento: fatura.vencimento,
              status: fatura.status,
              pago_em: fatura.pago_em ?? '',
              observacao: fatura.observacao ?? '',
            }
          : {
              valor: '',
              referencia: '',
              vencimento: '',
              status: 'PENDENTE',
              pago_em: '',
              observacao: '',
            },
      );
    }
  }, [open, fatura, reset]);

  const mutation = useMutation({
    mutationFn: (data: FaturaFormData) => {
      const payload = {
        valor: Number(data.valor.replace(',', '.')),
        referencia: data.referencia,
        vencimento: data.vencimento,
        status: data.status,
        pago_em: data.pago_em || null,
        observacao: data.observacao || null,
      };

      return modoEdicao
        ? atualizarFatura(empresaUuid, fatura!.id, payload)
        : criarFatura(empresaUuid, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['faturas', empresaUuid] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string }>(err) && err.response) {
        setErroGeral(err.response.data.message ?? 'Não foi possível salvar a fatura.');
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  function onSubmit(data: FaturaFormData) {
    setErroGeral(null);
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar fatura' : 'Nova fatura'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

          <Controller
            name="valor"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Valor (R$)"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                autoFocus
              />
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="referencia"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Mês de referência"
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
              name="vencimento"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Vencimento"
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
              name="status"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  select
                  label="Status"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                >
                  {STATUS_OPCOES.map((opcao) => (
                    <MenuItem key={opcao.value} value={opcao.value}>
                      {opcao.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
            {statusAtual === 'PAGA' && (
              <Controller
                name="pago_em"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Pago em"
                    type="date"
                    fullWidth
                    margin="normal"
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message ?? 'Vazio = hoje'}
                  />
                )}
              />
            )}
          </Box>
          <Controller
            name="observacao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Observação"
                fullWidth
                multiline
                minRows={2}
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

import { zodResolver } from '@hookform/resolvers/zod';
import {
  Alert,
  Box,
  Button,
  Checkbox,
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
import { atualizarCampanha, criarCampanha } from '../../lib/api/campanhas';
import type { CampanhaAuditoria } from '../../types/api';

const schema = z
  .object({
    descricao: z.string().min(1, 'Obrigatório').max(155),
    observacao: z.string(),
    layout: z.string(),
    vigencia_inicio: z.string().min(1, 'Obrigatório'),
    vigencia_fim: z.string().min(1, 'Obrigatório'),
    restricao: z.string(),
    exclusividade: z.string(),
    frequencia_dias: z.string().refine((v) => v === '' || (/^\d+$/.test(v) && Number(v) >= 1), 'Deve ser um número inteiro >= 1'),
    execucao_recorrente: z.boolean(),
    possui_restricao: z.boolean(),
    possui_exclusividade: z.boolean(),
    ativo: z.boolean(),
  })
  .refine((data) => data.vigencia_fim >= data.vigencia_inicio, {
    message: 'Deve ser depois do início',
    path: ['vigencia_fim'],
  });

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  descricao: '',
  observacao: '',
  layout: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  restricao: '',
  exclusividade: '',
  frequencia_dias: '',
  execucao_recorrente: false,
  possui_restricao: false,
  possui_exclusividade: false,
  ativo: true,
};

function paraInputDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

interface CampanhaFormDialogProps {
  open: boolean;
  campanha: CampanhaAuditoria | null;
  onClose: () => void;
}

export function CampanhaFormDialog({ open, campanha, onClose }: CampanhaFormDialogProps) {
  const modoEdicao = campanha !== null;
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
      reset(
        campanha
          ? {
              descricao: campanha.descricao,
              observacao: campanha.observacao ?? '',
              layout: campanha.layout ?? '',
              vigencia_inicio: paraInputDate(campanha.vigencia_inicio),
              vigencia_fim: paraInputDate(campanha.vigencia_fim),
              restricao: campanha.restricao ?? '',
              exclusividade: campanha.exclusividade ?? '',
              frequencia_dias: campanha.frequencia_dias === null ? '' : String(campanha.frequencia_dias),
              execucao_recorrente: campanha.execucao_recorrente,
              possui_restricao: campanha.possui_restricao,
              possui_exclusividade: campanha.possui_exclusividade,
              ativo: campanha.ativo,
            }
          : DEFAULT_VALUES,
      );
    }
  }, [open, campanha, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        descricao: data.descricao,
        observacao: data.observacao || null,
        layout: data.layout || null,
        vigencia_inicio: data.vigencia_inicio,
        vigencia_fim: data.vigencia_fim,
        restricao: data.restricao || null,
        exclusividade: data.exclusividade || null,
        frequencia_dias: data.frequencia_dias === '' ? null : Number(data.frequencia_dias),
        execucao_recorrente: data.execucao_recorrente,
        possui_restricao: data.possui_restricao,
        possui_exclusividade: data.possui_exclusividade,
      };

      if (modoEdicao) {
        return atualizarCampanha(campanha!.id, { ...payload, ativo: data.ativo });
      }

      return criarCampanha(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campanhas'] });
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
      <DialogTitle>{modoEdicao ? 'Editar campanha' : 'Nova campanha'}</DialogTitle>
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
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="vigencia_inicio"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Vigência início"
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
              name="vigencia_fim"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Vigência fim"
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
          <Controller
            name="observacao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Observação"
                fullWidth
                margin="normal"
                multiline
                minRows={2}
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="layout"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Layout"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="frequencia_dias"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Frequência (dias)"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    'Com "Execução recorrente" marcado, gera automaticamente uma ordem de serviço por PDV a cada N dias'
                  }
                />
              )}
            />
          </Box>
          <Controller
            name="restricao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Restrição"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="exclusividade"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Exclusividade"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Controller
            name="execucao_recorrente"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Execução recorrente"
              />
            )}
          />
          <Controller
            name="possui_restricao"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Possui restrição"
              />
            )}
          />
          <Controller
            name="possui_exclusividade"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Possui exclusividade"
              />
            )}
          />
          {modoEdicao && (
            <Controller
              name="ativo"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  sx={{ mt: 1, display: 'block' }}
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Ativa"
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

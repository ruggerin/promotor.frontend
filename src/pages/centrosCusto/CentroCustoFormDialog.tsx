import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { atualizarCentroCusto, criarCentroCusto } from '../../lib/api/centrosCusto';
import type { CategoriaCentroCustoItem, CentroCusto } from '../../types/api';

const CATEGORIAS: { value: CategoriaCentroCustoItem; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Individual (por promotor)' },
  { value: 'GERAL', label: 'Geral (dividido entre os promotores)' },
];

const itemSchema = z.object({
  categoria: z.enum(['INDIVIDUAL', 'GERAL']),
  descricao: z.string().min(1, 'Obrigatório').max(255),
  valor_mensal: z
    .string()
    .min(1, 'Obrigatório')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) >= 0, 'Deve ser um número >= 0'),
});

const schema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(255),
  carga_horaria_semanal: z
    .string()
    .min(1, 'Obrigatório')
    .refine((v) => !Number.isNaN(Number(v)) && Number(v) > 0 && Number(v) <= 168, 'Entre 0 e 168 horas'),
  ativo: z.boolean(),
  itens: z.array(itemSchema),
});

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  descricao: '',
  carga_horaria_semanal: '44',
  ativo: true,
  itens: [],
};

function itemVazio(categoria: CategoriaCentroCustoItem): FormData['itens'][number] {
  return { categoria, descricao: '', valor_mensal: '' };
}

function formatarReais(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

interface CentroCustoFormDialogProps {
  open: boolean;
  centroCusto: CentroCusto | null;
  onClose: () => void;
}

export function CentroCustoFormDialog({ open, centroCusto, onClose }: CentroCustoFormDialogProps) {
  const modoEdicao = centroCusto !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        centroCusto
          ? {
              descricao: centroCusto.descricao,
              carga_horaria_semanal: String(centroCusto.carga_horaria_semanal),
              ativo: centroCusto.ativo,
              itens: centroCusto.itens.map((item) => ({
                categoria: item.categoria,
                descricao: item.descricao,
                valor_mensal: String(item.valor_mensal),
              })),
            }
          : DEFAULT_VALUES,
      );
    }
  }, [open, centroCusto, reset]);

  // Prévia ao vivo do cálculo — mesma fórmula de App\Models\CentroCusto::resumoCusto (ver
  // docs/08-CENTRO-DE-CUSTO.md §4), recalculada a cada tecla, sem round-trip. A quantidade de
  // promotores vinculados só é conhecida no servidor (não muda aqui no formulário), então usa o
  // último valor conhecido do centro de custo em edição, ou 0 numa criação nova.
  const itensAtuais = useWatch({ control, name: 'itens' });
  const cargaHorariaAtual = useWatch({ control, name: 'carga_horaria_semanal' });
  const qtdPromotoresAtivos = centroCusto?.resumo.qtd_promotores_ativos ?? 0;

  const previa = useMemo(() => {
    const custoIndividual = itensAtuais
      .filter((item) => item.categoria === 'INDIVIDUAL')
      .reduce((soma, item) => soma + (Number(item.valor_mensal) || 0), 0);
    const custoGeral = itensAtuais
      .filter((item) => item.categoria === 'GERAL')
      .reduce((soma, item) => soma + (Number(item.valor_mensal) || 0), 0);
    const custoGeralPorPromotor = qtdPromotoresAtivos > 0 ? custoGeral / qtdPromotoresAtivos : custoGeral;
    const custoTotalMensal = custoIndividual + custoGeralPorPromotor;
    const cargaHoraria = Number(cargaHorariaAtual) || 0;
    const horasMensais = cargaHoraria * (52 / 12);
    const custoPorHora = horasMensais > 0 ? custoTotalMensal / horasMensais : 0;

    return { custoIndividual, custoGeral, custoGeralPorPromotor, custoTotalMensal, horasMensais, custoPorHora };
  }, [itensAtuais, cargaHorariaAtual, qtdPromotoresAtivos]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        descricao: data.descricao,
        carga_horaria_semanal: Number(data.carga_horaria_semanal),
        itens: data.itens.map((item) => ({
          categoria: item.categoria,
          descricao: item.descricao,
          valor_mensal: Number(item.valor_mensal),
        })),
      };

      if (modoEdicao) {
        return atualizarCentroCusto(centroCusto!.id, { ...payload, ativo: data.ativo });
      }
      return criarCentroCusto(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['centros-custo'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string }>(err) && err.response?.status === 422) {
        setErroGeral(err.response.data.message ?? 'Não foi possível salvar — confira os campos abaixo.');
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar centro de custo' : 'Novo centro de custo'}</DialogTitle>
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
                label="Nome do centro de custo"
                placeholder="Ex.: Promotor Padrão, Time Região Sul"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                autoFocus
              />
            )}
          />

          <Controller
            name="carga_horaria_semanal"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Carga horária semanal"
                type="number"
                slotProps={{ htmlInput: { step: '0.5', min: 0, max: 168 } }}
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Horas por semana, ex.: 44'}
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
                  label="Ativo"
                />
              )}
            />
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Itens de custo mensal
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>Individual</strong>: existe por promotor (ex.: salário, transporte).{' '}
            <strong>Geral</strong>: compartilhado entre todos os promotores deste centro de
            custo (ex.: sistema, supervisor de trade) — dividido automaticamente pela
            quantidade de promotores vinculados.
          </Typography>

          {fields.map((itemField, indice) => (
            <Box
              key={itemField.id}
              sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <Box sx={{ flexGrow: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Controller
                  name={`itens.${indice}.categoria`}
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} select label="Categoria" size="small" sx={{ minWidth: 220 }}>
                      {CATEGORIAS.map((c) => (
                        <MenuItem key={c.value} value={c.value}>
                          {c.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
                <Controller
                  name={`itens.${indice}.descricao`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Descrição"
                      placeholder="Ex.: Salário"
                      size="small"
                      sx={{ flexGrow: 1, minWidth: 160 }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name={`itens.${indice}.valor_mensal`}
                  control={control}
                  render={({ field, fieldState }) => (
                    <TextField
                      {...field}
                      label="Valor mensal (R$)"
                      type="number"
                      slotProps={{ htmlInput: { step: '0.01', min: 0 } }}
                      size="small"
                      sx={{ width: 160 }}
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message}
                    />
                  )}
                />
              </Box>
              <IconButton size="small" onClick={() => remove(indice)} sx={{ mt: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}

          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button startIcon={<AddIcon />} onClick={() => append(itemVazio('INDIVIDUAL'))}>
              Item individual
            </Button>
            <Button startIcon={<AddIcon />} onClick={() => append(itemVazio('GERAL'))}>
              Item geral
            </Button>
          </Box>

          <Paper variant="outlined" sx={{ p: 2, mt: 3, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" gutterBottom>
              Prévia do cálculo{modoEdicao ? ` (${qtdPromotoresAtivos} promotor(es) vinculado(s) hoje)` : ' (sem promotor vinculado ainda)'}
            </Typography>
            <Typography variant="body2">Custo individual mensal: {formatarReais(previa.custoIndividual)}</Typography>
            <Typography variant="body2">
              Custo geral mensal: {formatarReais(previa.custoGeral)} → {formatarReais(previa.custoGeralPorPromotor)} por promotor
            </Typography>
            <Typography variant="body2">Custo total mensal por promotor: {formatarReais(previa.custoTotalMensal)}</Typography>
            <Typography variant="body2">Horas por mês: {previa.horasMensais.toFixed(2)}</Typography>
            <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 700 }}>
              Custo por hora: {formatarReais(previa.custoPorHora)}
            </Typography>
          </Paper>
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

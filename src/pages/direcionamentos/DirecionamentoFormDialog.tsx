import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { atualizarDirecionamento, criarDirecionamento } from '../../lib/api/direcionamentos';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { Direcionamento } from '../../types/api';

// Mesmo par de helpers de OrdemServicoFormDialog — <input type="datetime-local"> não tem
// timezone, então a conversão precisa ser manual nos dois sentidos.
function paraInputDateTime(iso: string): string {
  const data = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

function paraIsoUtc(valorInputDateTime: string): string {
  return new Date(valorInputDateTime).toISOString();
}

const formularioSchema = z.object({
  tipo_registro_uuid: z.string().min(1, 'Escolha um formulário'),
  descricao: z.string(),
  obrigatorio: z.boolean(),
  calcula_percentual_compliance: z.boolean(),
});

const schema = z
  .object({
    descricao: z.string().min(1, 'Obrigatório'),
    vigencia_inicio: z.string().min(1, 'Obrigatório'),
    vigencia_fim: z.string().min(1, 'Obrigatório'),
    pontos_venda: z.array(z.object({ uuid: z.string(), fantasia: z.string() })),
    redes_loja: z.array(z.object({ uuid: z.string(), descricao: z.string() })),
    promotores: z.array(z.object({ uuid: z.string(), nome: z.string() })),
    formularios: z.array(formularioSchema).min(1, 'Adicione ao menos um formulário'),
  })
  .refine((data) => data.vigencia_fim >= data.vigencia_inicio, {
    message: 'Deve ser depois do início',
    path: ['vigencia_fim'],
  });

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  descricao: '',
  vigencia_inicio: '',
  vigencia_fim: '',
  pontos_venda: [],
  redes_loja: [],
  promotores: [],
  formularios: [],
};

function formularioVazio(): FormData['formularios'][number] {
  return { tipo_registro_uuid: '', descricao: '', obrigatorio: true, calcula_percentual_compliance: false };
}

interface DirecionamentoFormDialogProps {
  open: boolean;
  direcionamento: Direcionamento | null;
  onClose: () => void;
}

// Formulário grande, mesmo espírito de TipoRegistroFormDialog/CampanhaFormDialog: descrição +
// vigência + filtros multi-escolha (todos opcionais) + lista de formulários exigidos, tudo
// montado antes de um POST/PUT só. Ver docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md §7.1.
//
// Simplificação consciente desta primeira versão: só "adicionar formulário já existente" — o
// fluxo "+ Criar novo formulário" (ir pra TipoRegistroFormPage num contexto de Direcionamento,
// sem os toggles de Ação/Compliance) descrito no doc não foi implementado ainda; pra usar um
// formulário novo aqui, cadastre-o primeiro no menu Formulários.
export function DirecionamentoFormDialog({ open, direcionamento, onClose }: DirecionamentoFormDialogProps) {
  const modoEdicao = direcionamento !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields, append, remove } = useFieldArray({ control, name: 'formularios' });
  const formulariosAtuais = useWatch({ control, name: 'formularios' }) ?? [];

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        direcionamento
          ? {
              descricao: direcionamento.descricao,
              vigencia_inicio: paraInputDateTime(direcionamento.vigencia_inicio),
              vigencia_fim: paraInputDateTime(direcionamento.vigencia_fim),
              pontos_venda: direcionamento.filtros.pontos_venda.map((p) => ({ uuid: p.id, fantasia: p.fantasia })),
              redes_loja: direcionamento.filtros.redes_loja.map((r) => ({ uuid: r.id, descricao: r.descricao })),
              promotores: direcionamento.filtros.promotores.map((u) => ({ uuid: u.id, nome: u.nome })),
              formularios: direcionamento.formularios.map((f) => ({
                tipo_registro_uuid: f.tipo_registro.id,
                descricao: f.tipo_registro.descricao,
                obrigatorio: f.obrigatorio,
                calcula_percentual_compliance: f.calcula_percentual_compliance,
              })),
            }
          : DEFAULT_VALUES,
      );
    }
  }, [open, direcionamento, reset]);

  const pontosVendaQuery = useQuery({
    queryKey: ['pontos-venda', 'form-direcionamento'],
    queryFn: () => listarPontosVenda({ ativo: true }),
    enabled: open,
  });
  const redesLojaQuery = useQuery({
    queryKey: ['redes-lojas', 'form-direcionamento'],
    queryFn: () => listarRedesLojas({ ativo: true }),
    enabled: open,
  });
  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'form-direcionamento', { user_type: 'PROMOTOR', ativo: true }],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', ativo: true }),
    enabled: open,
  });
  const tiposRegistroQuery = useQuery({
    queryKey: ['tipos-registro', 'form-direcionamento'],
    queryFn: () => listarTiposRegistro({ ativo: true }),
    enabled: open,
  });
  const tiposRegistro = tiposRegistroQuery.data?.tipos_registro ?? [];

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        descricao: data.descricao,
        vigencia_inicio: paraIsoUtc(data.vigencia_inicio),
        vigencia_fim: paraIsoUtc(data.vigencia_fim),
        ponto_venda_uuids: data.pontos_venda.map((p) => p.uuid),
        rede_loja_uuids: data.redes_loja.map((r) => r.uuid),
        promotor_uuids: data.promotores.map((u) => u.uuid),
        formularios: data.formularios.map((f) => ({
          tipo_registro_uuid: f.tipo_registro_uuid,
          obrigatorio: f.obrigatorio,
          calcula_percentual_compliance: f.calcula_percentual_compliance,
        })),
      };

      if (modoEdicao) {
        return atualizarDirecionamento(direcionamento!.id, payload);
      }
      return criarDirecionamento(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['direcionamentos'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string }>(err) && err.response) {
        setErroGeral(err.response.data.message ?? 'Não foi possível salvar.');
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar direcionamento' : 'Novo direcionamento'}</DialogTitle>
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
                placeholder="Ex.: Ação Dia dos Pais"
                fullWidth
                autoFocus
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
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
                  type="datetime-local"
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
                  type="datetime-local"
                  fullWidth
                  margin="normal"
                  slotProps={{ inputLabel: { shrink: true } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                />
              )}
            />
          </Box>

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Filtros (opcionais — sem nenhum marcado, vale pra empresa inteira)
          </Typography>

          <Controller
            name="pontos_venda"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                sx={{ mt: 1 }}
                options={pontosVendaQuery.data?.pontos_venda.map((p) => ({ uuid: p.id, fantasia: p.fantasia })) ?? []}
                getOptionLabel={(o) => o.fantasia}
                isOptionEqualToValue={(a, b) => a.uuid === b.uuid}
                loading={pontosVendaQuery.isLoading}
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                renderInput={(params) => <TextField {...params} label="Pontos de venda" size="small" />}
              />
            )}
          />

          <Controller
            name="redes_loja"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                sx={{ mt: 2 }}
                options={redesLojaQuery.data?.redes_lojas.map((r) => ({ uuid: r.id, descricao: r.descricao })) ?? []}
                getOptionLabel={(o) => o.descricao}
                isOptionEqualToValue={(a, b) => a.uuid === b.uuid}
                loading={redesLojaQuery.isLoading}
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                renderInput={(params) => <TextField {...params} label="Redes de loja" size="small" />}
              />
            )}
          />

          <Controller
            name="promotores"
            control={control}
            render={({ field }) => (
              <Autocomplete
                multiple
                sx={{ mt: 2 }}
                options={promotoresQuery.data?.usuarios.map((u) => ({ uuid: u.id, nome: u.nome })) ?? []}
                getOptionLabel={(o) => o.nome}
                isOptionEqualToValue={(a, b) => a.uuid === b.uuid}
                loading={promotoresQuery.isLoading}
                value={field.value}
                onChange={(_, value) => field.onChange(value)}
                renderInput={(params) => <TextField {...params} label="Promotores" size="small" />}
              />
            )}
          />

          <Typography variant="subtitle2" sx={{ mt: 3 }}>
            Formulários exigidos
          </Typography>
          {errors.formularios?.message && (
            <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
              {errors.formularios.message}
            </Typography>
          )}

          {fields.map((item, indice) => {
            const jaEscolhidos = new Set(
              formulariosAtuais.map((f, i) => (i === indice ? null : f.tipo_registro_uuid)),
            );
            const opcoes = tiposRegistro.filter((t) => !jaEscolhidos.has(t.id));

            return (
              <Box
                key={item.id}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1.5, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <Box sx={{ flex: 1 }}>
                  <Controller
                    name={`formularios.${indice}.tipo_registro_uuid`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <Autocomplete
                        size="small"
                        options={opcoes}
                        getOptionLabel={(o) => o.descricao}
                        value={tiposRegistro.find((t) => t.id === field.value) ?? null}
                        onChange={(_, value) => {
                          field.onChange(value?.id ?? '');
                          setValue(`formularios.${indice}.descricao`, value?.descricao ?? '');
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Formulário"
                            error={!!fieldState.error}
                            helperText={fieldState.error?.message}
                          />
                        )}
                      />
                    )}
                  />
                  <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                    <Controller
                      name={`formularios.${indice}.obrigatorio`}
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="Obrigatório"
                        />
                      )}
                    />
                    <Controller
                      name={`formularios.${indice}.calcula_percentual_compliance`}
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                          label="Calcula % de compliance"
                        />
                      )}
                    />
                  </Box>
                </Box>
                <IconButton size="small" onClick={() => remove(indice)} sx={{ mt: 0.5 }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          })}

          <Button startIcon={<AddIcon />} sx={{ mt: 1.5 }} onClick={() => append(formularioVazio())}>
            Adicionar formulário
          </Button>
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

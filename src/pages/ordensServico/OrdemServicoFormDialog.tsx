import { zodResolver } from '@hookform/resolvers/zod';
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
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { listarObjetivosVisita } from '../../lib/api/objetivosVisita';
import { atualizarOrdemServico, criarOrdemServico } from '../../lib/api/ordensServico';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarTiposVisita } from '../../lib/api/tiposVisita';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { OrdemServico } from '../../types/api';

// <input type="datetime-local"> mostra/edita sempre em horário LOCAL do navegador, sem
// timezone — só cortar os primeiros 16 caracteres do ISO (UTC) que a API devolve mostraria a
// hora errada pro usuário (ex.: 09:00 local virou "05:00" na tela ao editar, América/Manaus é
// UTC-4). Os `get*` (não `getUTC*`) do Date já convertem UTC → horário local do navegador.
function paraInputDateTime(iso: string): string {
  const data = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}T${pad(data.getHours())}:${pad(data.getMinutes())}`;
}

// Sentido inverso: o valor de um <input type="datetime-local"> ("YYYY-MM-DDTHH:mm") não tem
// timezone — o construtor Date o interpreta como horário LOCAL (comportamento padrão do
// ECMA-262 pra strings de data-hora sem offset), então `.toISOString()` já devolve o UTC
// correto pra mandar à API.
function paraIsoUtc(valorInputDateTime: string): string {
  return new Date(valorInputDateTime).toISOString();
}

const formularioSchema = z.object({
  tipo_registro_uuid: z.string().min(1, 'Escolha um formulário'),
  obrigatorio: z.boolean(),
  calcula_percentual_compliance: z.boolean(),
});

const schema = z
  .object({
    ponto_venda_uuid: z.string().min(1, 'Obrigatório'),
    usuario_uuid: z.string().nullable(),
    tipo_visita_uuid: z.string().nullable(),
    objetivo_visita_uuid: z.string().nullable(),
    prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA', '']),
    horario_previsto: z.string(),
    obrigatoria: z.boolean(),
    prazo_inicio: z.string().min(1, 'Obrigatório'),
    prazo_fim: z.string().min(1, 'Obrigatório'),
    observacao: z.string(),
    // Vínculo direto de formulário nesta OS avulsa, sem Direcionamento — ver
    // docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md §7.2. Opcional, diferente do Direcionamento.
    formularios: z.array(formularioSchema),
  })
  .refine((data) => data.prazo_fim >= data.prazo_inicio, {
    message: 'Deve ser depois do início',
    path: ['prazo_fim'],
  });

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  ponto_venda_uuid: '',
  usuario_uuid: null,
  tipo_visita_uuid: null,
  objetivo_visita_uuid: null,
  prioridade: '',
  horario_previsto: '',
  obrigatoria: true,
  prazo_inicio: '',
  prazo_fim: '',
  observacao: '',
  formularios: [],
};

function formularioVazio(): FormData['formularios'][number] {
  return { tipo_registro_uuid: '', obrigatorio: true, calcula_percentual_compliance: false };
}

interface OrdemServicoFormDialogProps {
  open: boolean;
  ordemServico: OrdemServico | null;
  onClose: () => void;
}

export function OrdemServicoFormDialog({ open, ordemServico, onClose }: OrdemServicoFormDialogProps) {
  const modoEdicao = ordemServico !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields, append, remove } = useFieldArray({ control, name: 'formularios' });
  const formulariosAtuais = useWatch({ control, name: 'formularios' }) ?? [];

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        ordemServico
          ? {
              ponto_venda_uuid: ordemServico.ponto_venda?.id ?? '',
              usuario_uuid: ordemServico.usuario?.id ?? null,
              tipo_visita_uuid: ordemServico.tipo_visita?.id ?? null,
              objetivo_visita_uuid: ordemServico.objetivo_visita?.id ?? null,
              prioridade: ordemServico.prioridade ?? '',
              horario_previsto: ordemServico.horario_previsto ?? '',
              obrigatoria: ordemServico.obrigatoria,
              prazo_inicio: paraInputDateTime(ordemServico.prazo_inicio),
              prazo_fim: paraInputDateTime(ordemServico.prazo_fim),
              observacao: ordemServico.observacao ?? '',
              formularios: (ordemServico.formularios ?? []).map((f) => ({
                tipo_registro_uuid: f.tipo_registro.id,
                obrigatorio: f.obrigatorio,
                calcula_percentual_compliance: f.calcula_percentual_compliance,
              })),
            }
          : DEFAULT_VALUES,
      );
    }
  }, [open, ordemServico, reset]);

  const pontosVendaQuery = useQuery({
    queryKey: ['pontos-venda', 'form-ordem-servico'],
    queryFn: () => listarPontosVenda({ ativo: true }),
    enabled: open,
  });
  const pontosVenda = pontosVendaQuery.data?.pontos_venda ?? [];

  // Exige a permissão usuarios.gerenciar pra carregar — se o perfil do gestor não tiver, a
  // lista vem vazia e ele só consegue deixar em fila aberta (mesma limitação já aceita em
  // PontoVendaDetailPage ao atribuir promotores a uma loja).
  const promotoresQuery = useQuery({
    queryKey: ['usuarios', { user_type: 'PROMOTOR', ativo: true }],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', ativo: true }),
    enabled: open,
  });
  const promotores = promotoresQuery.data?.usuarios ?? [];

  const tiposVisitaQuery = useQuery({
    queryKey: ['tipos-visita', { ativo: true }],
    queryFn: () => listarTiposVisita({ ativo: true }),
    enabled: open,
  });
  const tiposVisita = tiposVisitaQuery.data?.tipos_visita ?? [];

  const objetivosVisitaQuery = useQuery({
    queryKey: ['objetivos-visita', { ativo: true }],
    queryFn: () => listarObjetivosVisita({ ativo: true }),
    enabled: open,
  });
  const objetivosVisita = objetivosVisitaQuery.data?.objetivos_visita ?? [];

  const tiposRegistroQuery = useQuery({
    queryKey: ['tipos-registro', 'form-ordem-servico'],
    queryFn: () => listarTiposRegistro({ ativo: true }),
    enabled: open,
  });
  const tiposRegistro = tiposRegistroQuery.data?.tipos_registro ?? [];

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ponto_venda_uuid: data.ponto_venda_uuid,
        usuario_uuid: data.usuario_uuid,
        tipo_visita_uuid: data.tipo_visita_uuid,
        objetivo_visita_uuid: data.objetivo_visita_uuid,
        prioridade: data.prioridade || undefined,
        horario_previsto: data.horario_previsto || null,
        obrigatoria: data.obrigatoria,
        prazo_inicio: paraIsoUtc(data.prazo_inicio),
        prazo_fim: paraIsoUtc(data.prazo_fim),
        observacao: data.observacao || null,
        formularios: data.formularios,
      };

      if (modoEdicao) {
        return atualizarOrdemServico(ordemServico!.id, payload);
      }
      return criarOrdemServico(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
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
      <DialogTitle>{modoEdicao ? 'Editar ordem de serviço' : 'Nova ordem de serviço'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

          <Controller
            name="ponto_venda_uuid"
            control={control}
            render={({ field, fieldState }) => (
              <Autocomplete
                options={pontosVenda}
                getOptionLabel={(option) => option.fantasia}
                loading={pontosVendaQuery.isLoading}
                value={pontosVenda.find((p) => p.id === field.value) ?? null}
                onChange={(_, value) => field.onChange(value?.id ?? '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Ponto de venda"
                    margin="normal"
                    fullWidth
                    autoFocus
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            )}
          />

          <Controller
            name="usuario_uuid"
            control={control}
            render={({ field }) => (
              <Autocomplete
                options={promotores}
                getOptionLabel={(option) => option.nome}
                loading={promotoresQuery.isLoading}
                value={promotores.find((p) => p.id === field.value) ?? null}
                onChange={(_, value) => field.onChange(value?.id ?? null)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Promotor destinado"
                    margin="normal"
                    fullWidth
                    helperText="Deixe em branco para fila aberta — qualquer promotor da empresa pode atender"
                  />
                )}
              />
            )}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="tipo_visita_uuid"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={tiposVisita}
                  getOptionLabel={(option) => option.descricao}
                  loading={tiposVisitaQuery.isLoading}
                  value={tiposVisita.find((t) => t.id === field.value) ?? null}
                  onChange={(_, value) => field.onChange(value?.id ?? null)}
                  renderInput={(params) => <TextField {...params} label="Tipo de visita" margin="normal" fullWidth />}
                />
              )}
            />
            <Controller
              name="objetivo_visita_uuid"
              control={control}
              render={({ field }) => (
                <Autocomplete
                  sx={{ flex: 1 }}
                  options={objetivosVisita}
                  getOptionLabel={(option) => option.descricao}
                  loading={objetivosVisitaQuery.isLoading}
                  value={objetivosVisita.find((o) => o.id === field.value) ?? null}
                  onChange={(_, value) => field.onChange(value?.id ?? null)}
                  renderInput={(params) => <TextField {...params} label="Objetivo" margin="normal" fullWidth />}
                />
              )}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="prioridade"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Prioridade" sx={{ flex: 1 }} margin="normal">
                  <MenuItem value="">—</MenuItem>
                  <MenuItem value="BAIXA">Baixa</MenuItem>
                  <MenuItem value="MEDIA">Média</MenuItem>
                  <MenuItem value="ALTA">Alta</MenuItem>
                </TextField>
              )}
            />
            <Controller
              name="horario_previsto"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Horário (opcional)"
                  type="time"
                  sx={{ flex: 1 }}
                  margin="normal"
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              )}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="prazo_inicio"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Prazo início"
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
              name="prazo_fim"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Prazo fim"
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

          <Controller
            name="observacao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Observação"
                placeholder="Ex.: focar na ponta de gôndola do corredor 3"
                fullWidth
                multiline
                minRows={2}
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Controller
            name="obrigatoria"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ mt: 1, display: 'block' }}
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Obrigatória (bloqueante) — se desmarcado, aparece só como sugestão pro promotor"
              />
            )}
          />

          {/* Vínculo direto de formulário, sem Direcionamento — ver
              docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md §7.2 ("só esse promotor, só essa loja, uma
              vez, não precisa do aparato inteiro de filtro + geração em massa"). */}
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Formulários (opcional)
          </Typography>
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
                        onChange={(_, value) => field.onChange(value?.id ?? '')}
                        renderInput={(params) => (
                          <TextField {...params} label="Formulário" error={!!fieldState.error} helperText={fieldState.error?.message} />
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
          <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1.5 }} onClick={() => append(formularioVazio())}>
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

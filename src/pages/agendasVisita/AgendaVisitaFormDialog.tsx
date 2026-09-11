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
  MenuItem,
  Switch,
  TextField,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarAgendaVisita, criarAgendaVisita } from '../../lib/api/agendasVisita';
import { listarObjetivosVisita } from '../../lib/api/objetivosVisita';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarTiposVisita } from '../../lib/api/tiposVisita';
import type { AgendaVisita } from '../../types/api';

const DIAS_SEMANA = [
  { valor: 0, label: 'Domingo' },
  { valor: 1, label: 'Segunda-feira' },
  { valor: 2, label: 'Terça-feira' },
  { valor: 3, label: 'Quarta-feira' },
  { valor: 4, label: 'Quinta-feira' },
  { valor: 5, label: 'Sexta-feira' },
  { valor: 6, label: 'Sábado' },
];

const schema = z
  .object({
    ponto_venda_uuid: z.string().min(1, 'Obrigatório'),
    usuario_uuid: z.string().min(1, 'Obrigatório'),
    tipo_visita_uuid: z.string().nullable(),
    objetivo_visita_uuid: z.string().nullable(),
    prioridade: z.enum(['BAIXA', 'MEDIA', 'ALTA']),
    recorrencia: z.enum(['SEMANAL', 'DATA_UNICA']),
    dia_semana: z.number().nullable(),
    data: z.string().nullable(),
    horario_previsto: z.string(),
    obrigatoria: z.boolean(),
    observacao: z.string(),
  })
  .refine((d) => d.recorrencia !== 'SEMANAL' || d.dia_semana !== null, {
    message: 'Escolha o dia da semana',
    path: ['dia_semana'],
  })
  .refine((d) => d.recorrencia !== 'DATA_UNICA' || !!d.data, {
    message: 'Escolha a data',
    path: ['data'],
  });

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  ponto_venda_uuid: '',
  usuario_uuid: '',
  tipo_visita_uuid: null,
  objetivo_visita_uuid: null,
  prioridade: 'MEDIA',
  recorrencia: 'SEMANAL',
  dia_semana: 1,
  data: null,
  horario_previsto: '',
  obrigatoria: true,
  observacao: '',
};

interface AgendaVisitaFormDialogProps {
  open: boolean;
  agendaVisita: AgendaVisita | null;
  // PDV pré-selecionado (e travado) ao abrir a partir da tela de detalhe da loja — ver
  // PontoVendaDetailPage.
  pontoVendaFixo?: { id: string; fantasia: string } | null;
  onClose: () => void;
}

export function AgendaVisitaFormDialog({ open, agendaVisita, pontoVendaFixo, onClose }: AgendaVisitaFormDialogProps) {
  const modoEdicao = agendaVisita !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    watch,
    formState: { isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        agendaVisita
          ? {
              ponto_venda_uuid: agendaVisita.ponto_venda?.id ?? '',
              usuario_uuid: agendaVisita.usuario.id,
              tipo_visita_uuid: agendaVisita.tipo_visita?.id ?? null,
              objetivo_visita_uuid: agendaVisita.objetivo_visita?.id ?? null,
              prioridade: agendaVisita.prioridade,
              recorrencia: agendaVisita.recorrencia,
              dia_semana: agendaVisita.dia_semana,
              data: agendaVisita.data,
              horario_previsto: agendaVisita.horario_previsto ?? '',
              obrigatoria: agendaVisita.obrigatoria,
              observacao: agendaVisita.observacao ?? '',
            }
          : { ...DEFAULT_VALUES, ponto_venda_uuid: pontoVendaFixo?.id ?? '' },
      );
    }
  }, [open, agendaVisita, pontoVendaFixo, reset]);

  const pontosVendaQuery = useQuery({
    queryKey: ['pontos-venda', 'form-agenda-visita'],
    queryFn: () => listarPontosVenda({ ativo: true }),
    enabled: open,
  });
  const pontosVenda = pontosVendaQuery.data?.pontos_venda ?? [];

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

  const pontoVendaUuid = watch('ponto_venda_uuid');
  const recorrencia = watch('recorrencia');
  // Só promotores vinculados ao PDV escolhido podem ser destinados — mesma regra que a API
  // valida (StoreAgendaVisitaRequest::withValidator). Ver docs/10-AGENDA-VISITA.md, decisão 1.
  const pdvSelecionado = pontosVenda.find((p) => p.id === pontoVendaUuid);
  const promotoresDoPdv = pdvSelecionado?.promotores ?? [];

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      const payload = {
        ponto_venda_uuid: data.ponto_venda_uuid,
        usuario_uuid: data.usuario_uuid,
        tipo_visita_uuid: data.tipo_visita_uuid,
        objetivo_visita_uuid: data.objetivo_visita_uuid,
        prioridade: data.prioridade,
        recorrencia: data.recorrencia,
        dia_semana: data.recorrencia === 'SEMANAL' ? data.dia_semana : null,
        data: data.recorrencia === 'DATA_UNICA' ? data.data : null,
        horario_previsto: data.horario_previsto || null,
        obrigatoria: data.obrigatoria,
        observacao: data.observacao || null,
      };

      if (modoEdicao) {
        return atualizarAgendaVisita(agendaVisita!.id, payload);
      }
      return criarAgendaVisita(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agendas-visita'] });
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
      <DialogTitle>{modoEdicao ? 'Editar agenda de visita' : 'Nova agenda de visita'}</DialogTitle>
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
                disabled={!!pontoVendaFixo}
                value={pontosVenda.find((p) => p.id === field.value) ?? pontoVendaFixo ?? null}
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
            render={({ field, fieldState }) => (
              <Autocomplete
                options={promotoresDoPdv}
                getOptionLabel={(option) => option.nome}
                disabled={!pontoVendaUuid}
                value={promotoresDoPdv.find((p) => p.id === field.value) ?? null}
                onChange={(_, value) => field.onChange(value?.id ?? '')}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Promotor"
                    margin="normal"
                    fullWidth
                    error={!!fieldState.error}
                    helperText={
                      fieldState.error?.message ??
                      (pontoVendaUuid && promotoresDoPdv.length === 0
                        ? 'Este PDV ainda não tem promotor vinculado — atribua na tela do PDV primeiro.'
                        : 'Só promotores já vinculados a este PDV')
                    }
                  />
                )}
              />
            )}
          />

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="recorrencia"
              control={control}
              render={({ field }) => (
                <TextField {...field} select label="Recorrência" fullWidth margin="normal">
                  <MenuItem value="SEMANAL">Toda semana</MenuItem>
                  <MenuItem value="DATA_UNICA">Data específica</MenuItem>
                </TextField>
              )}
            />

            {recorrencia === 'SEMANAL' ? (
              <Controller
                name="dia_semana"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    select
                    label="Dia da semana"
                    fullWidth
                    margin="normal"
                    value={field.value ?? ''}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  >
                    {DIAS_SEMANA.map((d) => (
                      <MenuItem key={d.valor} value={d.valor}>
                        {d.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            ) : (
              <Controller
                name="data"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    value={field.value ?? ''}
                    label="Data"
                    type="date"
                    fullWidth
                    margin="normal"
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            )}
          </Box>

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

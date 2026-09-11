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
  FormGroup,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarPerfil, criarPerfil } from '../../lib/api/perfis';
import type { Perfil, Permissao } from '../../types/api';

const PERMISSOES: { value: Permissao; label: string }[] = [
  { value: 'pontos_venda.gerenciar', label: 'Pontos de venda' },
  { value: 'catalogo.gerenciar', label: 'Catálogo (departamentos, seções, marcas, produtos)' },
  { value: 'campanhas.gerenciar', label: 'Campanhas de auditoria' },
  { value: 'parametros.gerenciar', label: 'Parâmetros' },
  { value: 'usuarios.gerenciar', label: 'Usuários' },
  { value: 'contratos.gerenciar', label: 'Contratos (comodato, ponto extra)' },
  { value: 'ordens_servico.gerenciar', label: 'Ordens de serviço' },
  { value: 'centros_custo.gerenciar', label: 'Centros de custo (dado financeiro)' },
  {
    value: 'pontos_venda.visualizar_todos',
    label: 'Ver todos os pontos de venda no app (ignora vínculo) — única atribuível a Promotor',
  },
  {
    value: 'visitas.intervir',
    label: 'Intervir em visita (cancelar, forçar checkout, corrigir horários) — só tem efeito em Gestor',
  },
];

const schema = z.object({
  nome: z.string().min(1, 'Obrigatório').max(255),
  descricao: z.string(),
  permissoes: z.array(z.string()),
  ativo: z.boolean(),
});

type PerfilFormData = z.infer<typeof schema>;

const DEFAULT_VALUES: PerfilFormData = { nome: '', descricao: '', permissoes: [], ativo: true };

interface PerfilFormDialogProps {
  open: boolean;
  perfil: Perfil | null;
  onClose: () => void;
}

export function PerfilFormDialog({ open, perfil, onClose }: PerfilFormDialogProps) {
  const modoEdicao = perfil !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<PerfilFormData>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
  });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        perfil
          ? { nome: perfil.nome, descricao: perfil.descricao ?? '', permissoes: perfil.permissoes, ativo: perfil.ativo }
          : DEFAULT_VALUES,
      );
    }
  }, [open, perfil, reset]);

  const mutation = useMutation({
    mutationFn: async (data: PerfilFormData) => {
      const payload = {
        nome: data.nome,
        descricao: data.descricao || null,
        permissoes: data.permissoes as Permissao[],
      };

      if (modoEdicao) {
        return atualizarPerfil(perfil!.id, { ...payload, ativo: data.ativo });
      }

      return criarPerfil(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['perfis'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (campo in DEFAULT_VALUES) {
              setError(campo as keyof PerfilFormData, { message: mensagens[0] });
            }
          }
        }
        setErroGeral(errors ? null : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  function onSubmit(data: PerfilFormData) {
    setErroGeral(null);
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar perfil' : 'Novo perfil'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

          <Controller
            name="nome"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nome"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                autoFocus
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
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />

          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            Permissões
          </Typography>
          <Typography variant="caption" color="text.secondary">
            A maioria é permissão de escrita no admin web, atribuível só a Gestor — a única
            exceção é "ver todos os pontos de venda", que também vale pra Promotor (visibilidade
            no app, ver docs/12-VISIBILIDADE-PONTOS-DE-VENDA.md).
          </Typography>
          <Controller
            name="permissoes"
            control={control}
            render={({ field }) => (
              <FormGroup>
                {PERMISSOES.map((permissao) => (
                  <FormControlLabel
                    key={permissao.value}
                    control={
                      <Checkbox
                        checked={field.value.includes(permissao.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            field.onChange([...field.value, permissao.value]);
                          } else {
                            field.onChange(field.value.filter((v) => v !== permissao.value));
                          }
                        }}
                      />
                    }
                    label={permissao.label}
                  />
                ))}
              </FormGroup>
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
                  label="Ativo (desativar tira as permissões de todo usuário com esse perfil)"
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

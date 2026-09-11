import { zodResolver } from '@hookform/resolvers/zod';
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
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { atualizarEmpresaSuperadmin, criarEmpresaSuperadmin } from '../../lib/api/empresas';
import type { Empresa, PlanoEmpresa } from '../../types/api';

const PLANOS: { value: PlanoEmpresa; label: string }[] = [
  { value: 'GRATUITO', label: 'Gratuito' },
  { value: 'START', label: 'Start' },
  { value: 'PRO', label: 'Pro' },
  { value: 'BUSINESS', label: 'Business' },
];

// admin_* só é obrigatório na criação (superRefine abaixo) — mantido no schema mesmo em modo
// edição pra o tipo do form não mudar de formato entre os dois modos.
function buildSchema(modoEdicao: boolean) {
  return z
    .object({
      razao_social: z.string().min(1, 'Obrigatório').max(255),
      nome_fantasia: z.string().min(1, 'Obrigatório').max(255),
      cnpj: z.string().min(1, 'Obrigatório').max(20),
      plano: z.enum(['GRATUITO', 'START', 'PRO', 'BUSINESS']),
      limite_usuarios: z.string(),
      limite_pontos_venda: z.string(),
      limite_licencas: z.string(),
      ativo: z.boolean(),
      admin_nome: z.string(),
      admin_email: z.string(),
      admin_senha: z.string(),
    })
    .superRefine((data, ctx) => {
      if (data.limite_usuarios && !/^\d+$/.test(data.limite_usuarios)) {
        ctx.addIssue({ code: 'custom', message: 'Deve ser um número inteiro', path: ['limite_usuarios'] });
      }
      if (data.limite_pontos_venda && !/^\d+$/.test(data.limite_pontos_venda)) {
        ctx.addIssue({ code: 'custom', message: 'Deve ser um número inteiro', path: ['limite_pontos_venda'] });
      }
      if (data.limite_licencas && !/^\d+$/.test(data.limite_licencas)) {
        ctx.addIssue({ code: 'custom', message: 'Deve ser um número inteiro', path: ['limite_licencas'] });
      }

      if (modoEdicao) {
        return;
      }

      if (!data.admin_nome.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Obrigatório', path: ['admin_nome'] });
      }
      if (!data.admin_email.trim()) {
        ctx.addIssue({ code: 'custom', message: 'Obrigatório', path: ['admin_email'] });
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.admin_email)) {
        ctx.addIssue({ code: 'custom', message: 'E-mail inválido', path: ['admin_email'] });
      }
      if (data.admin_senha.length < 8) {
        ctx.addIssue({ code: 'custom', message: 'Mínimo 8 caracteres', path: ['admin_senha'] });
      }
    });
}

type EmpresaFormData = z.infer<ReturnType<typeof buildSchema>>;

interface EmpresaFormDialogProps {
  open: boolean;
  empresa: Empresa | null;
  onClose: () => void;
}

export function EmpresaFormDialog({ open, empresa, onClose }: EmpresaFormDialogProps) {
  const modoEdicao = empresa !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const schema = useMemo(() => buildSchema(modoEdicao), [modoEdicao]);

  const {
    control,
    handleSubmit,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<EmpresaFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      razao_social: '',
      nome_fantasia: '',
      cnpj: '',
      plano: 'GRATUITO',
      limite_usuarios: '',
      limite_pontos_venda: '',
      limite_licencas: '',
      ativo: true,
      admin_nome: '',
      admin_email: '',
      admin_senha: '',
    },
  });

  // Mesmo padrão do UsuarioFormDialog: re-popula o form inteiro sempre que o diálogo abre, em
  // vez de sincronizar campo a campo.
  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        empresa
          ? {
              razao_social: empresa.razao_social,
              nome_fantasia: empresa.nome_fantasia,
              cnpj: empresa.cnpj,
              plano: empresa.plano,
              limite_usuarios: empresa.limite_usuarios?.toString() ?? '',
              limite_pontos_venda: empresa.limite_pontos_venda?.toString() ?? '',
              limite_licencas: empresa.limite_licencas?.toString() ?? '',
              ativo: empresa.ativo,
              admin_nome: '',
              admin_email: '',
              admin_senha: '',
            }
          : {
              razao_social: '',
              nome_fantasia: '',
              cnpj: '',
              plano: 'GRATUITO',
              limite_usuarios: '',
              limite_pontos_venda: '',
              limite_licencas: '',
              ativo: true,
              admin_nome: '',
              admin_email: '',
              admin_senha: '',
            },
      );
    }
  }, [open, empresa, reset]);

  const mutation = useMutation({
    mutationFn: async (data: EmpresaFormData) => {
      const limiteUsuarios = data.limite_usuarios ? Number(data.limite_usuarios) : null;
      const limitePontosVenda = data.limite_pontos_venda ? Number(data.limite_pontos_venda) : null;
      const limiteLicencas = data.limite_licencas ? Number(data.limite_licencas) : null;

      if (modoEdicao) {
        return atualizarEmpresaSuperadmin(empresa!.id, {
          razao_social: data.razao_social,
          nome_fantasia: data.nome_fantasia,
          cnpj: data.cnpj,
          plano: data.plano,
          limite_usuarios: limiteUsuarios,
          limite_pontos_venda: limitePontosVenda,
          limite_licencas: limiteLicencas,
          ativo: data.ativo,
        });
      }

      return criarEmpresaSuperadmin({
        razao_social: data.razao_social,
        nome_fantasia: data.nome_fantasia,
        cnpj: data.cnpj,
        plano: data.plano,
        limite_usuarios: limiteUsuarios,
        limite_pontos_venda: limitePontosVenda,
        limite_licencas: limiteLicencas,
        admin_nome: data.admin_nome,
        admin_email: data.admin_email,
        admin_senha: data.admin_senha,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['empresas'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (campo in { razao_social: 1, nome_fantasia: 1, cnpj: 1, plano: 1, limite_usuarios: 1, limite_pontos_venda: 1, limite_licencas: 1, admin_nome: 1, admin_email: 1, admin_senha: 1 }) {
              setError(campo as keyof EmpresaFormData, { message: mensagens[0] });
            }
          }
        }
        setErroGeral(errors ? null : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  function onSubmit(data: EmpresaFormData) {
    setErroGeral(null);
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar empresa' : 'Nova empresa'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

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
                autoFocus
              />
            )}
          />
          <Controller
            name="nome_fantasia"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nome fantasia"
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
          <Controller
            name="plano"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                label="Plano"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              >
                {PLANOS.map((plano) => (
                  <MenuItem key={plano.value} value={plano.value}>
                    {plano.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Controller
              name="limite_usuarios"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Limite de usuários"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Vazio = sem limite'}
                />
              )}
            />
            <Controller
              name="limite_pontos_venda"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label="Limite de PDVs"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Vazio = sem limite'}
                />
              )}
            />
          </Box>
          <Controller
            name="limite_licencas"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Limite de licenças (promotores)"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? 'Cobrança por dispositivo — vazio = sem limite'}
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
                  label="Ativa (desmarcar bloqueia a empresa e derruba todas as sessões dela)"
                />
              )}
            />
          )}

          {!modoEdicao && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Primeiro usuário (ADMIN) — sem ele ninguém consegue logar nessa empresa.
              </Typography>
              <Controller
                name="admin_nome"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Nome do admin"
                    fullWidth
                    margin="normal"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="admin_email"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="E-mail do admin"
                    type="email"
                    fullWidth
                    margin="normal"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                name="admin_senha"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Senha do admin"
                    type="password"
                    fullWidth
                    margin="normal"
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </>
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

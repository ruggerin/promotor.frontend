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
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { listarCentrosCusto } from '../../lib/api/centrosCusto';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { listarPerfis } from '../../lib/api/perfis';
import { atualizarUsuario, criarUsuario } from '../../lib/api/usuarios';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Usuario, UserType } from '../../types/api';

const USER_TYPES: { value: UserType; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'GESTOR', label: 'Gestor' },
  { value: 'PROMOTOR', label: 'Promotor' },
];

// empresa_uuid só é obrigatório na criação por SUPERADMIN (superRefine abaixo) — mantido no
// schema sempre pra o tipo do form não mudar de formato entre os casos.
function buildSchema(modoEdicao: boolean, isSuperadmin: boolean) {
  return z
    .object({
      nome: z.string().min(1, 'Obrigatório').max(255),
      email: z.string().min(1, 'Obrigatório').email('E-mail inválido'),
      senha: modoEdicao
        ? z.union([z.literal(''), z.string().min(8, 'Mínimo 8 caracteres')])
        : z.string().min(8, 'Mínimo 8 caracteres'),
      user_type: z.enum(['ADMIN', 'GESTOR', 'PROMOTOR']),
      perfil_uuid: z.string().nullable(),
      centro_custo_uuid: z.string().nullable(),
      empresa_uuid: z.string().nullable(),
      ativo: z.boolean(),
    })
    .refine((data) => data.user_type === 'GESTOR' || data.user_type === 'PROMOTOR' || !data.perfil_uuid, {
      message: 'Perfil só pode ser atribuído a usuários Gestor ou Promotor.',
      path: ['perfil_uuid'],
    })
    .refine((data) => data.user_type === 'PROMOTOR' || !data.centro_custo_uuid, {
      message: 'Centro de custo só pode ser atribuído a usuários Promotor.',
      path: ['centro_custo_uuid'],
    })
    .refine((data) => modoEdicao || !isSuperadmin || !!data.empresa_uuid, {
      message: 'Obrigatório escolher a empresa.',
      path: ['empresa_uuid'],
    });
}

type UsuarioFormData = z.infer<ReturnType<typeof buildSchema>>;

interface UsuarioFormDialogProps {
  open: boolean;
  usuario: Usuario | null;
  onClose: () => void;
}

export function UsuarioFormDialog({ open, usuario, onClose }: UsuarioFormDialogProps) {
  const modoEdicao = usuario !== null;
  const queryClient = useQueryClient();
  const { usuario: usuarioLogado } = useAuth();
  // SUPERADMIN não tem perfis pra listar fora da própria empresa (que ele não tem) — por isso
  // o campo Perfil fica escondido pra ele, mesmo criando um GESTOR; quem atribui o perfil
  // depois é o ADMIN da empresa em questão, editando o usuário normalmente.
  const isSuperadmin = usuarioLogado?.user_type === 'SUPERADMIN';
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const schema = useMemo(() => buildSchema(modoEdicao, isSuperadmin), [modoEdicao, isSuperadmin]);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { isSubmitting },
  } = useForm<UsuarioFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: '',
      email: '',
      senha: '',
      user_type: 'PROMOTOR',
      perfil_uuid: null,
      centro_custo_uuid: null,
      empresa_uuid: null,
      ativo: true,
    },
  });

  // Re-popula o form sempre que o diálogo abre com um usuário diferente (ou fecha e reabre
  // vazio pra criação) — mais simples que sincronizar campo a campo via useEffect por campo.
  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        usuario
          ? {
              nome: usuario.nome,
              email: usuario.email,
              senha: '',
              user_type: usuario.user_type === 'SUPERADMIN' ? 'ADMIN' : usuario.user_type,
              perfil_uuid: usuario.perfil?.id ?? null,
              centro_custo_uuid: usuario.centro_custo?.id ?? null,
              empresa_uuid: null,
              ativo: usuario.ativo,
            }
          : {
              nome: '',
              email: '',
              senha: '',
              user_type: 'PROMOTOR',
              perfil_uuid: null,
              centro_custo_uuid: null,
              empresa_uuid: null,
              ativo: true,
            },
      );
    }
  }, [open, usuario, reset]);

  const userTypeAtual = watch('user_type');

  // Lista pequena e sem paginação (mesmo padrão do endpoint) — só busca quando o diálogo está
  // aberto, não precisa em toda a tela de usuários. SUPERADMIN não tem acesso a esse endpoint
  // (é restrito a user_type:ADMIN), por isso nunca busca nesse caso — ver isSuperadmin acima.
  const perfisQuery = useQuery({
    queryKey: ['perfis'],
    queryFn: listarPerfis,
    enabled: open && !isSuperadmin,
  });

  // Exige a permissão centros_custo.gerenciar pra carregar — se o perfil do gestor logado não
  // tiver essa permissão (dado financeiro, separada de usuarios.gerenciar), a lista vem vazia
  // e ele só consegue deixar sem centro de custo. Mesma limitação já aceita pro seletor de
  // promotor em OrdemServicoFormDialog.
  const centrosCustoQuery = useQuery({
    queryKey: ['centros-custo'],
    queryFn: () => listarCentrosCusto({ ativo: true }),
    enabled: open && !isSuperadmin,
  });

  // Mesma query/cache da tela de listagem (['empresas','superadmin']) — só busca quando é
  // SUPERADMIN criando (edição não tem esse campo, ver schema).
  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: open && isSuperadmin && !modoEdicao,
  });

  const mutation = useMutation({
    mutationFn: async (data: UsuarioFormData) => {
      if (modoEdicao) {
        const payload: Parameters<typeof atualizarUsuario>[1] = {
          nome: data.nome,
          email: data.email,
          user_type: data.user_type,
          ativo: data.ativo,
        };
        // SUPERADMIN nunca edita perfil (o campo fica escondido pra ele, ver acima) — omitir a
        // chave em vez de mandar o valor antigo evita 422 (o backend valida perfil_uuid contra
        // a própria empresa do chamador, que pra SUPERADMIN é null) e garante que o perfil já
        // atribuído pelo ADMIN da empresa não seja mexido sem querer.
        if (!isSuperadmin) {
          payload.perfil_uuid = data.user_type === 'GESTOR' || data.user_type === 'PROMOTOR' ? data.perfil_uuid : null;
          payload.centro_custo_uuid = data.user_type === 'PROMOTOR' ? data.centro_custo_uuid : null;
        }
        if (data.senha) {
          payload.senha = data.senha;
        }
        return atualizarUsuario(usuario!.id, payload);
      }

      return criarUsuario({
        nome: data.nome,
        email: data.email,
        senha: data.senha,
        user_type: data.user_type,
        perfil_uuid: data.user_type === 'GESTOR' || data.user_type === 'PROMOTOR' ? data.perfil_uuid : null,
        centro_custo_uuid: data.user_type === 'PROMOTOR' ? data.centro_custo_uuid : null,
        empresa_uuid: isSuperadmin ? (data.empresa_uuid ?? undefined) : undefined,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (
              campo in
              { nome: 1, email: 1, senha: 1, user_type: 1, perfil_uuid: 1, centro_custo_uuid: 1, empresa_uuid: 1, ativo: 1 }
            ) {
              setError(campo as keyof UsuarioFormData, { message: mensagens[0] });
            }
          }
        }
        setErroGeral(errors ? null : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  function onSubmit(data: UsuarioFormData) {
    setErroGeral(null);
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar usuário' : 'Novo usuário'}</DialogTitle>
      <Box component="form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

          {isSuperadmin && !modoEdicao && (
            <Controller
              name="empresa_uuid"
              control={control}
              render={({ field, fieldState }) => (
                <Autocomplete
                  options={empresasQuery.data?.empresas ?? []}
                  getOptionLabel={(option) => option.nome_fantasia}
                  loading={empresasQuery.isLoading}
                  value={empresasQuery.data?.empresas.find((e) => e.id === field.value) ?? null}
                  onChange={(_, value) => field.onChange(value?.id ?? null)}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Empresa"
                      margin="normal"
                      fullWidth
                      error={!!fieldState.error}
                      helperText={fieldState.error?.message ?? 'Em qual empresa esse usuário vai ser criado'}
                    />
                  )}
                />
              )}
            />
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
                autoFocus={!isSuperadmin || modoEdicao}
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
                type="email"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                // "username" (não "email") é o valor que os navegadores reconhecem pra
                // associar este campo ao de senha logo abaixo — sem isso o Chrome às vezes não
                // entende que os dois formam um par e some com o autopreenchimento errado de
                // qualquer forma.
                autoComplete="username"
              />
            )}
          />
          <Controller
            name="senha"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label={modoEdicao ? 'Nova senha' : 'Senha'}
                type="password"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message ?? (modoEdicao ? 'Deixe em branco para manter a atual' : undefined)}
                // Sem isso o navegador (Chrome principalmente) autopreenche este campo com uma
                // senha salva pra este site assim que o modal abre — o promotor nem repara, o
                // campo já não está mais vazio, e o "deixe em branco pra manter a atual" vira
                // mentira: o submit manda essa senha autopreenchida e sobrescreve a de verdade.
                // "new-password" é o valor padrão que instrui o navegador a NÃO sugerir/preencher
                // uma senha salva aqui (diferente de "current-password", que é pra tela de login).
                autoComplete="new-password"
              />
            )}
          />
          <Controller
            name="user_type"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                select
                label="Tipo de usuário"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              >
                {USER_TYPES.map((tipo) => (
                  <MenuItem key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />
          {(userTypeAtual === 'GESTOR' || userTypeAtual === 'PROMOTOR') && !isSuperadmin && (
            <Controller
              name="perfil_uuid"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  select
                  label="Perfil"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={
                    fieldState.error?.message ??
                    (userTypeAtual === 'GESTOR'
                      ? 'Define as permissões de escrita deste gestor'
                      : 'Só precisa se este promotor for "supervisor" — ex.: ver todos os PDVs no app')
                  }
                >
                  <MenuItem value="">Nenhum (sem permissões extras)</MenuItem>
                  {perfisQuery.data?.perfis.map((perfil) => (
                    <MenuItem key={perfil.id} value={perfil.id}>
                      {perfil.nome}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}
          {(userTypeAtual === 'GESTOR' || userTypeAtual === 'PROMOTOR') && isSuperadmin && !modoEdicao && (
            <Alert severity="info" sx={{ mt: 1 }}>
              O perfil (permissões) desse usuário precisa ser definido depois pelo ADMIN da
              empresa, editando o usuário.
            </Alert>
          )}
          {userTypeAtual === 'PROMOTOR' && !isSuperadmin && (
            <Controller
              name="centro_custo_uuid"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  select
                  label="Centro de custo"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Usado pro cálculo de custo/hora deste promotor'}
                >
                  <MenuItem value="">Nenhum</MenuItem>
                  {centrosCustoQuery.data?.centros_custo.map((centroCusto) => (
                    <MenuItem key={centroCusto.id} value={centroCusto.id}>
                      {centroCusto.descricao}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}
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

import { zodResolver } from '@hookform/resolvers/zod';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import axios from 'axios';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../lib/auth/AuthContext';

const loginSchema = z.object({
  email: z.string().min(1, 'Obrigatório').email('E-mail inválido'),
  senha: z.string().min(1, 'Obrigatório'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);

  // Hooks sempre chamados incondicionalmente (Regras dos Hooks) — o return antecipado abaixo
  // só acontece DEPOIS de todos eles, nunca antes.
  const {
    control,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', senha: '' },
  });

  // Defesa extra: se por qualquer motivo a sessão já estiver válida (ex.: um redirecionamento
  // prematuro enquanto o /auth/me ainda estava carregando), volta sozinho pro app em vez de
  // deixar o usuário preso na tela de login.
  if (isAuthenticated) {
    return <Navigate to="/visitas" replace />;
  }

  async function onSubmit(data: LoginFormData) {
    setErro(null);

    try {
      await login(data.email, data.senha);
      navigate('/visitas', { replace: true });
    } catch (err) {
      if (axios.isAxiosError<{ errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const primeiraMensagem = err.response.data.errors
          ? Object.values(err.response.data.errors)[0]?.[0]
          : null;
        setErro(primeiraMensagem ?? 'Credenciais inválidas.');
      } else {
        setErro('Não foi possível conectar à API. Tente novamente.');
      }
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        bgcolor: 'grey.100',
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: 360 }}>
        <Typography variant="h5" component="h1" gutterBottom>
          PDV Admin
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Entre com sua conta ADMIN ou GESTOR.
        </Typography>

        {erro && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {erro}
          </Alert>
        )}

        <Box component="form" onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
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
                autoFocus
              />
            )}
          />
          <Controller
            name="senha"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Senha"
                type="password"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
              />
            )}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            sx={{ mt: 3 }}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

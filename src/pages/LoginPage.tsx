import { zodResolver } from '@hookform/resolvers/zod';
import LockIcon from '@mui/icons-material/LockOutlined';
import MailIcon from '@mui/icons-material/MailOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import { Box, ButtonBase, Link, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import axios from 'axios';
import { useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { LogoHorus } from '../components/LogoHorus';
import { useAuth } from '../lib/auth/AuthContext';
import { configSuporte, mailtoLogin } from '../lib/suporte';
import { useTema } from '../lib/tema/TemaProvider';
import type { PreferenciaTema } from '../types/api';
import { horus } from '../theme';
import { IlustracaoLogin, TELA_BAIXA } from './login/IlustracaoLogin';

// Tela dividida (protótipo docs/login-prototipo.html): formulário à esquerda, painel ilustrado
// e animado à direita; abaixo de md empilha, formulário primeiro.

// Termos e Política são páginas públicas da própria API (docs/58 §5.2), fora do prefixo /api.
const URL_SITE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

const loginSchema = z.object({
  email: z.string().min(1, 'Obrigatório').email('E-mail inválido'),
  senha: z.string().min(1, 'Obrigatório'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [erro, setErro] = useState<string | null>(null);
  const [verSenha, setVerSenha] = useState(false);
  // Não há redefinição de senha self-service na API — o link só mostra a quem pedir.
  const [mostrarAjudaSenha, setMostrarAjudaSenha] = useState(false);
  // Canal de suporte (.env, ver src/lib/suporte.ts): o e-mail abre com assunto e um roteiro pronto.
  const EMAIL_SUPORTE = configSuporte().email;

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
      component="main"
      sx={{
        minHeight: '100vh',
        // Altura real da tela no celular (descontando a barra de endereço que aparece/some).
        '@supports (min-height: 100dvh)': { minHeight: '100dvh' },
        // No desktop a tela trava na altura da janela: o painel ilustrado sempre cabe inteiro e,
        // se faltar espaço, só o formulário rola.
        height: { md: '100vh' },
        display: 'grid',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(0, 1fr)' },
        bgcolor: horus.painel,
        color: horus.texto,
        fontSize: 15,
      }}
    >
      <Box
        component="section"
        aria-label="Entrar no painel"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          px: 'clamp(16px, 6vw, 72px)',
          py: { xs: 3.5, md: 5 },
          minWidth: 0,
          overflowY: { md: 'auto' },
          [TELA_BAIXA]: { gap: 2, py: 3 },
        }}
      >
        {/* Tema no topo, junto do logo — longe dos campos de e-mail e senha. */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <LogoHorus largura={132} />
          <SeletorTema />
        </Box>

        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 3, [TELA_BAIXA]: { gap: 2 } }}>
            <div>
              <Typography
                sx={{
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: 'primary.main',
                  mb: 1,
                  [TELA_BAIXA]: { display: 'none' },
                }}
              >
                Painel de gestão
              </Typography>
              <Typography
                component="h1"
                sx={{ fontSize: 28, lineHeight: 1.2, fontWeight: 700, textWrap: 'balance', [TELA_BAIXA]: { fontSize: 24 } }}
              >
                Bem-vindo de volta
              </Typography>
              <Typography sx={{ mt: 1, color: horus.textoSecundario, fontSize: 15, lineHeight: 1.5 }}>
                Entre com seu e-mail corporativo para acompanhar a operação nos pontos de venda.
              </Typography>
            </div>

            <Box
              component="form"
              onSubmit={(e) => void handleSubmit(onSubmit)(e)}
              noValidate
              sx={{ display: 'flex', flexDirection: 'column', gap: 2, [TELA_BAIXA]: { gap: 1.5 } }}
            >
              {erro && <Aviso tom="erro">{erro}</Aviso>}

              <Controller
                name="email"
                control={control}
                render={({ field, fieldState }) => (
                  <CampoLogin
                    {...field}
                    id="email"
                    rotulo="E-mail"
                    icone={<MailIcon />}
                    erro={fieldState.error?.message}
                    type="email"
                    autoComplete="username"
                    placeholder="nome@empresa.com.br"
                    autoFocus
                  />
                )}
              />
              <Controller
                name="senha"
                control={control}
                render={({ field, fieldState }) => (
                  <CampoLogin
                    {...field}
                    id="senha"
                    rotulo="Senha"
                    icone={<LockIcon />}
                    erro={fieldState.error?.message}
                    type={verSenha ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    acao={
                      <ButtonBase
                        onClick={() => setVerSenha((v) => !v)}
                        aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
                        aria-pressed={verSenha}
                        sx={{
                          p: 0.75,
                          mr: -0.75,
                          borderRadius: '6px',
                          color: horus.textoSecundario,
                          '&:hover': { color: 'primary.main', bgcolor: horus.hover },
                          '&.Mui-focusVisible': { outline: `2px solid ${horus.indigo}`, outlineOffset: 2 },
                          '& svg': { fontSize: 18 },
                        }}
                      >
                        {verSenha ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </ButtonBase>
                    }
                  />
                )}
              />

              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Link
                  component="button"
                  type="button"
                  underline="hover"
                  onClick={() => setMostrarAjudaSenha((v) => !v)}
                  aria-expanded={mostrarAjudaSenha}
                  sx={{ fontSize: 14, fontWeight: 500, fontFamily: 'inherit' }}
                >
                  Esqueci minha senha
                </Link>
              </Box>
              {mostrarAjudaSenha && (
                <Aviso tom="info">Peça ao administrador da sua empresa para redefinir sua senha.</Aviso>
              )}

              <ButtonBase
                type="submit"
                disabled={isSubmitting}
                sx={{
                  height: 48,
                  [TELA_BAIXA]: { height: 44 },
                  borderRadius: '10px',
                  bgcolor: 'primary.main',
                  color: '#fff',
                  font: `600 15px ${horus.fonte}`,
                  transition: 'background-color .15s',
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { opacity: 0.75, cursor: 'progress', color: '#fff' },
                  '&.Mui-focusVisible': { outline: `2px solid ${horus.indigo}`, outlineOffset: 2 },
                }}
              >
                {isSubmitting ? 'Entrando…' : 'Entrar'}
              </ButtonBase>
              <Typography sx={{ fontSize: 13, color: horus.textoSecundario, textAlign: 'center', lineHeight: 1.5 }}>
                Ao entrar, você concorda com os{' '}
                <Link href={`${URL_SITE}/termos-de-uso`} target="_blank" rel="noopener" underline="hover" sx={{ fontWeight: 500 }}>
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link href={`${URL_SITE}/politica-de-privacidade`} target="_blank" rel="noopener" underline="hover" sx={{ fontWeight: 500 }}>
                  Política de Privacidade
                </Link>
                .
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box component="footer" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Typography sx={{ fontSize: 12, color: horus.textoSecundario }}>© {new Date().getFullYear()} Prossiga Tecnologia</Typography>
          {/* Suporte no rodapé, discreto, pra não disputar atenção com o formulário. */}
          {EMAIL_SUPORTE && (
            <Typography sx={{ fontSize: 12, color: horus.textoSecundario }}>
              Problemas para entrar?{' '}
              <Link href={mailtoLogin(EMAIL_SUPORTE)} underline="hover" sx={{ fontWeight: 500 }}>
                {EMAIL_SUPORTE}
              </Link>
            </Typography>
          )}
        </Box>
      </Box>

      <IlustracaoLogin />
    </Box>
  );
}

function Aviso({ tom, children }: { tom: 'erro' | 'info'; children: ReactNode }) {
  return (
    <Box
      role={tom === 'erro' ? 'alert' : 'status'}
      sx={{
        fontSize: 13,
        px: 1.5,
        py: 1.25,
        borderRadius: '8px',
        bgcolor: tom === 'erro' ? horus.problemaClaro : horus.ambarClaro,
        color: tom === 'erro' ? horus.problema : horus.ambarEscuro,
      }}
    >
      {children}
    </Box>
  );
}

type CampoLoginProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  rotulo: string;
  icone: ReactNode;
  erro?: string;
  acao?: ReactNode;
};

function CampoLogin({ id, rotulo, icone, erro, acao, ref, ...input }: CampoLoginProps & { ref?: Ref<HTMLInputElement> }) {
  const idErro = `${id}-erro`;
  return (
    <div>
      <Box component="label" htmlFor={id} sx={{ display: 'block', fontSize: 13, fontWeight: 500, mb: 0.75 }}>
        {rotulo}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          height: 48,
          [TELA_BAIXA]: { height: 44 },
          px: 1.5,
          border: '1px solid',
          borderColor: erro ? horus.problema : horus.bordaCampo,
          borderRadius: '10px',
          bgcolor: horus.painel,
          transition: 'border-color .15s, box-shadow .15s',
          '&:focus-within': {
            borderColor: erro ? horus.problema : 'primary.main',
            boxShadow: erro ? '0 0 0 3px rgba(185,28,28,.12)' : '0 0 0 3px rgba(79,70,229,.15)',
          },
          '& > svg': { color: horus.textoSecundario, fontSize: 18, flex: 'none' },
        }}
      >
        {icone}
        <Box
          component="input"
          ref={ref}
          id={id}
          aria-invalid={Boolean(erro)}
          aria-describedby={erro ? idErro : undefined}
          {...input}
          sx={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 0,
            outline: 0,
            bgcolor: 'transparent',
            font: 'inherit',
            fontSize: 15,
            color: horus.texto,
            '&::placeholder': { color: horus.textoFraco, opacity: 1 },
          }}
        />
        {acao}
      </Box>
      {erro && (
        <Typography id={idErro} sx={{ mt: 0.5, fontSize: 12.5, color: horus.problema }}>
          {erro}
        </Typography>
      )}
    </div>
  );
}

const OPCOES_TEMA: { valor: PreferenciaTema; rotulo: string; icone: ReactNode }[] = [
  { valor: 'sistema', rotulo: 'Igual ao sistema', icone: <SettingsBrightnessIcon /> },
  { valor: 'claro', rotulo: 'Claro', icone: <LightModeIcon /> },
  { valor: 'escuro', rotulo: 'Escuro', icone: <DarkModeIcon /> },
];

/** Tema na tela de entrada (docs/65): vale só neste navegador até a pessoa entrar. */
function SeletorTema() {
  const { preferencia, definir } = useTema();
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={preferencia}
      onChange={(_, v: PreferenciaTema | null) => v && definir(v)}
      aria-label="Tema"
      sx={{ '& .MuiToggleButton-root': { height: 28, width: 32, p: 0, '& svg': { fontSize: 16 } } }}
    >
      {OPCOES_TEMA.map(({ valor, rotulo, icone }) => (
        <Tooltip key={valor} title={rotulo}>
          <ToggleButton value={valor} aria-label={`Tema: ${rotulo}`}>
            {icone}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  );
}

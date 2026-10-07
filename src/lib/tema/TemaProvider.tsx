import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { atualizarPreferencias } from '../api/auth';
import { useAuth } from '../auth/AuthContext';
import { criarTema, type ModoTema } from '../../theme';
import type { PreferenciaTema, Usuario } from '../../types/api';

// Tema do admin escolhido por usuário (docs/65): fica no cadastro dele (vale em qualquer
// navegador) e numa cópia local, só pra abrir já no tema certo antes do /auth/me responder.
// Padrão é "sistema" (segue o claro/escuro do sistema operacional) — pra quem nunca escolheu e na
// tela de login, que usa a última escolha feita neste navegador.

const CHAVE_CACHE = 'pdv-admin:tema';

function lerCache(): PreferenciaTema | null {
  try {
    const v = localStorage.getItem(CHAVE_CACHE);
    return v === 'claro' || v === 'escuro' || v === 'sistema' ? v : null;
  } catch {
    return null;
  }
}

function gravarCache(tema: PreferenciaTema) {
  try {
    localStorage.setItem(CHAVE_CACHE, tema);
  } catch {
    // Storage indisponível — só abre no tema padrão até o /auth/me chegar.
  }
}

type TemaContexto = {
  preferencia: PreferenciaTema;
  modo: ModoTema;
  definir: (tema: PreferenciaTema) => void;
};

const Contexto = createContext<TemaContexto | undefined>(undefined);

export function TemaProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const queryClient = useQueryClient();
  const sistemaEscuro = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  // Escolha feita nesta sessão (vale até a resposta da API voltar no próximo /auth/me).
  const [escolha, setEscolha] = useState<{ usuarioId: string | null; tema: PreferenciaTema } | null>(null);

  const preferencia: PreferenciaTema =
    escolha && escolha.usuarioId === (usuario?.id ?? null)
      ? escolha.tema
      : usuario
        ? (usuario.tema ?? 'sistema')
        : (lerCache() ?? 'sistema');
  const modo: ModoTema = preferencia === 'sistema' ? (sistemaEscuro ? 'escuro' : 'claro') : preferencia;

  const salvar = useMutation({
    mutationFn: atualizarPreferencias,
    onSuccess: ({ usuario: atualizado }) => {
      queryClient.setQueryData<{ usuario: Usuario }>(['auth', 'me'], (atual) => (atual ? { usuario: atualizado } : atual));
    },
  });

  function definir(tema: PreferenciaTema) {
    setEscolha({ usuarioId: usuario?.id ?? null, tema });
    gravarCache(tema);
    // Sem login (tela de entrada) fica só neste navegador; logado, vai pro cadastro.
    if (usuario) salvar.mutate({ tema });
  }

  // Mantém a cópia local igual ao cadastro (ex.: trocou o tema em outro navegador).
  useEffect(() => {
    if (usuario?.tema) gravarCache(usuario.tema);
  }, [usuario?.tema]);

  const tema = useMemo(() => criarTema(modo), [modo]);

  return (
    <Contexto.Provider value={{ preferencia, modo, definir }}>
      <ThemeProvider theme={tema}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </Contexto.Provider>
  );
}

export function useTema(): TemaContexto {
  const c = useContext(Contexto);
  if (!c) throw new Error('useTema deve ser usado dentro de um TemaProvider');
  return c;
}

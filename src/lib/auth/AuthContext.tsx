import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as authApi from '../api/auth';
import { UNAUTHORIZED_EVENT } from '../api/client';
import { tokenStorage } from './tokenStorage';
import type { Usuario } from '../../types/api';

interface AuthContextValue {
  usuario: Usuario | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => tokenStorage.get());
  // Só guarda o usuário vindo direto da resposta do login (fonte imediata, sem round-trip).
  // Quando a sessão é reidratada a partir de um token salvo (reload de página), `usuario`
  // abaixo deriva de `meQuery.data` na MESMA renderização — nunca copiado via useEffect pra
  // um segundo useState, porque isso abre uma janela de 1 frame onde os dados já chegaram mas
  // ainda não foram copiados, e nesse frame isLoading falso + usuario nulo faz o RequireAuth
  // redirecionar pro login por engano antes do próximo render corrigir.
  const [usuarioDoLogin, setUsuarioDoLogin] = useState<Usuario | null>(null);

  const meQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.me,
    enabled: Boolean(token) && !usuarioDoLogin,
    retry: false,
  });

  const usuario = usuarioDoLogin ?? meQuery.data?.usuario ?? null;

  // A API pode invalidar um token a qualquer momento (usuário desativado, troca de
  // dispositivo) — o interceptor do Axios detecta o 401 e dispara este evento pra limpar a
  // sessão local, em vez da UI travar numa tela quebrada.
  useEffect(() => {
    function handleUnauthorized() {
      setToken(null);
      setUsuarioDoLogin(null);
      queryClient.clear();
    }

    window.addEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handleUnauthorized);
  }, [queryClient]);

  async function login(email: string, senha: string) {
    const response = await authApi.login({ email, senha });
    tokenStorage.set(response.token);
    setToken(response.token);
    setUsuarioDoLogin(response.usuario);
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // Best-effort: mesmo se a chamada falhar (rede, token já expirado), limpa a sessão local.
    }
    tokenStorage.clear();
    setToken(null);
    setUsuarioDoLogin(null);
    queryClient.clear();
  }

  // meQuery.isLoading (não isPending!) é o que realmente significa "buscando pela primeira
  // vez" no TanStack Query v5 — isPending também fica true pra query desabilitada que nunca
  // rodou.
  const isLoading = Boolean(token) && !usuario && meQuery.isLoading;

  return (
    <AuthContext.Provider
      value={{
        usuario,
        isLoading,
        isAuthenticated: Boolean(token) && Boolean(usuario),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context;
}

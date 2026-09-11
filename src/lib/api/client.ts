import axios from 'axios';
import { tokenStorage } from '../auth/tokenStorage';

// Disparado quando a API responde 401 — o AuthContext escuta isso pra limpar a sessão e
// navegar pro login. Evento em vez de import direto do AuthContext aqui: este módulo roda
// fora da árvore de componentes React, então não tem acesso ao react-router.
export const UNAUTHORIZED_EVENT = 'auth:unauthorized';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.get();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      tokenStorage.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    }

    return Promise.reject(error);
  },
);

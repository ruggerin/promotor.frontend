import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../../test/renderWithProviders';
import { UNAUTHORIZED_EVENT } from '../api/client';
import { useAuth } from './AuthContext';
import { tokenStorage } from './tokenStorage';

vi.mock('../api/auth');

import * as authApi from '../api/auth';

const usuarioMock = {
  id: 'uuid-1',
  nome: 'Admin Teste',
  email: 'admin@teste.com',
  user_type: 'ADMIN' as const,
  ativo: true,
  avatar_url: null,
  created_at: '',
  updated_at: '',
};

// Componente de sonda: expõe o estado do contexto como texto/botões pra dar pra testar via
// queries do Testing Library, já que o contexto em si não é observável de fora do provider.
function SondaAuth() {
  const { usuario, isLoading, isAuthenticated, login, logout } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="autenticado">{String(isAuthenticated)}</span>
      <span data-testid="nome">{usuario?.nome ?? ''}</span>
      <button onClick={() => void login('admin@teste.com', 'senha12345')}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

// renderComProviders já embrulha em AuthProvider — mas aqui a gente monta o próprio wrapper
// direto porque alguns testes precisam controlar o momento exato em que o provider é montado
// (ex.: token já salvo antes do primeiro render).
function renderizarSonda() {
  return renderComProviders(<SondaAuth />);
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('sem token salvo, começa deslogado e sem carregar', () => {
    renderizarSonda();

    expect(screen.getByTestId('autenticado')).toHaveTextContent('false');
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
  });

  it('login preenche usuario imediatamente, sem round-trip pro /auth/me', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'token-123', usuario: usuarioMock });
    const usuario = userEvent.setup();
    renderizarSonda();

    await usuario.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('autenticado')).toHaveTextContent('true'));
    expect(screen.getByTestId('nome')).toHaveTextContent('Admin Teste');
    // /auth/me nunca precisou ser chamado — o usuário já veio na resposta do login.
    expect(authApi.me).not.toHaveBeenCalled();
    expect(tokenStorage.get()).toBe('token-123');
  });

  it('com token já salvo (reidratação), busca /auth/me e autentica sem nunca passar por um estado inconsistente', async () => {
    tokenStorage.set('token-existente');
    vi.mocked(authApi.me).mockResolvedValue({ usuario: usuarioMock });

    renderizarSonda();

    // Enquanto /auth/me ainda não respondeu: carregando, e nunca "autenticado sem usuário".
    expect(screen.getByTestId('loading')).toHaveTextContent('true');

    await waitFor(() => expect(screen.getByTestId('autenticado')).toHaveTextContent('true'));
    expect(screen.getByTestId('loading')).toHaveTextContent('false');
    expect(screen.getByTestId('nome')).toHaveTextContent('Admin Teste');
  });

  it('evento de 401 limpa a sessão local', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'token-123', usuario: usuarioMock });
    const usuario = userEvent.setup();
    renderizarSonda();

    await usuario.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('autenticado')).toHaveTextContent('true'));

    // No app de verdade é o interceptor do axios (api/client.ts) quem limpa o tokenStorage e
    // dispara esse evento — aqui simula-se as duas partes porque o interceptor não roda de
    // verdade (authApi está mockado). O que este teste cobre é só a reação do AuthContext ao
    // evento: derrubar o estado React da sessão.
    act(() => {
      tokenStorage.clear();
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    });

    expect(screen.getByTestId('autenticado')).toHaveTextContent('false');
    expect(tokenStorage.get()).toBeNull();
  });

  it('logout limpa a sessão local mesmo se a chamada de API falhar', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'token-123', usuario: usuarioMock });
    vi.mocked(authApi.logout).mockRejectedValue(new Error('offline'));
    const usuario = userEvent.setup();
    renderizarSonda();

    await usuario.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('autenticado')).toHaveTextContent('true'));

    await usuario.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('autenticado')).toHaveTextContent('false'));
    expect(tokenStorage.get()).toBeNull();
  });
});

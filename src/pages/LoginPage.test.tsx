import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError, AxiosHeaders } from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../test/renderWithProviders';
import { LoginPage } from './LoginPage';

vi.mock('../lib/api/auth');

import * as authApi from '../lib/api/auth';

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

function criarAxiosError(status: number, data: unknown): AxiosError {
  return new AxiosError('Request failed', String(status), undefined, undefined, {
    status,
    data,
    statusText: '',
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
}

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('mostra erro de campo obrigatório ao submeter vazio, sem chamar a API', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<LoginPage />, { rota: '/login' });

    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    // Campo vazio cai na regra .min(1, 'Obrigatório') antes mesmo de chegar em .email(...) —
    // aparece pros dois campos (e-mail e senha).
    expect(await screen.findAllByText('Obrigatório')).toHaveLength(2);
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('mostra erro de formato quando o e-mail é preenchido mas inválido', async () => {
    const usuario = userEvent.setup();
    renderComProviders(<LoginPage />, { rota: '/login' });

    await usuario.type(screen.getByLabelText(/e-mail/i), 'nao-e-um-email');
    await usuario.type(screen.getByLabelText(/senha/i), 'senha12345');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('faz login com sucesso e some com a mensagem de erro', async () => {
    vi.mocked(authApi.login).mockResolvedValue({ token: 'token-123', usuario: usuarioMock });
    const usuario = userEvent.setup();
    renderComProviders(<LoginPage />, { rota: '/login' });

    await usuario.type(screen.getByLabelText(/e-mail/i), 'admin@teste.com');
    await usuario.type(screen.getByLabelText(/senha/i), 'senha12345');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith({ email: 'admin@teste.com', senha: 'senha12345' });
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('mostra a mensagem de credenciais inválidas quando a API retorna 422', async () => {
    vi.mocked(authApi.login).mockRejectedValue(
      criarAxiosError(422, { errors: { email: ['Credenciais inválidas.'] } }),
    );
    const usuario = userEvent.setup();
    renderComProviders(<LoginPage />, { rota: '/login' });

    await usuario.type(screen.getByLabelText(/e-mail/i), 'admin@teste.com');
    await usuario.type(screen.getByLabelText(/senha/i), 'senha-errada');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText('Credenciais inválidas.')).toBeInTheDocument();
  });

  it('mostra mensagem de erro de conexão quando não há resposta da API', async () => {
    vi.mocked(authApi.login).mockRejectedValue(new Error('Network Error'));
    const usuario = userEvent.setup();
    renderComProviders(<LoginPage />, { rota: '/login' });

    await usuario.type(screen.getByLabelText(/e-mail/i), 'admin@teste.com');
    await usuario.type(screen.getByLabelText(/senha/i), 'senha12345');
    await usuario.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByText(/não foi possível conectar/i)).toBeInTheDocument();
  });
});

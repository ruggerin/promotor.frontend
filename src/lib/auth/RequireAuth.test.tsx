import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderComProviders } from '../../test/renderWithProviders';
import { RequireAuth } from './RequireAuth';
import { tokenStorage } from './tokenStorage';

vi.mock('../api/auth');

import * as authApi from '../api/auth';

function AppDeTeste() {
  return (
    <Routes>
      <Route path="/login" element={<div>Tela de login</div>} />
      <Route element={<RequireAuth />}>
        <Route path="/protegida" element={<div>Conteúdo protegido</div>} />
        <Route path="/aceite-termos" element={<div>Tela de aceite</div>} />
      </Route>
    </Routes>
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redireciona pro login quando não há sessão', async () => {
    renderComProviders(<AppDeTeste />, { rota: '/protegida' });

    expect(await screen.findByText('Tela de login')).toBeInTheDocument();
  });

  it('mostra o conteúdo protegido quando a sessão é válida', async () => {
    tokenStorage.set('token-existente');
    vi.mocked(authApi.me).mockResolvedValue({
      usuario: {
        id: 'uuid-1',
        nome: 'Admin',
        email: 'admin@teste.com',
        user_type: 'ADMIN',
        ativo: true,
        avatar_url: null,
        foto_url: null,
        created_at: '',
        updated_at: '',
      },
    });

    renderComProviders(<AppDeTeste />, { rota: '/protegida' });

    expect(await screen.findByText('Conteúdo protegido')).toBeInTheDocument();
  });

  it('com Termos/Política pendentes, manda pra tela de aceite antes de qualquer outra (docs/58)', async () => {
    tokenStorage.set('token-existente');
    vi.mocked(authApi.me).mockResolvedValue({
      usuario: {
        id: 'uuid-1',
        nome: 'Admin',
        email: 'admin@teste.com',
        user_type: 'ADMIN',
        ativo: true,
        avatar_url: null,
        foto_url: null,
        created_at: '',
        updated_at: '',
        documentos_pendentes: [{ tipo: 'TERMOS_USO', versao: '2026-10-06' }],
      },
    });

    renderComProviders(<AppDeTeste />, { rota: '/protegida' });

    expect(await screen.findByText('Tela de aceite')).toBeInTheDocument();
    expect(screen.queryByText('Conteúdo protegido')).not.toBeInTheDocument();
  });

  it('volta pro login se a sessão salva já não for mais válida (401 no /auth/me)', async () => {
    tokenStorage.set('token-invalido');
    vi.mocked(authApi.me).mockRejectedValue(new Error('unauthorized'));

    renderComProviders(<AppDeTeste />, { rota: '/protegida' });

    expect(await screen.findByText('Tela de login')).toBeInTheDocument();
  });
});

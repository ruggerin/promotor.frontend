import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelSuporte } from '../components/layout/PainelSuporte';
import { CONTADORES_ZERADOS, filtrarVisiveis, montarMenu } from '../components/layout/menuAdmin';
import { renderComProviders } from '../test/renderWithProviders';
import type { Usuario } from '../types/api';
import { configSuporte, descreverNavegador, mailtoLogado, type ConfigSuporte } from './suporte';

const admin = {
  id: 'u1',
  nome: 'Fabio Admin',
  email: 'fabio@empresa.com',
  user_type: 'ADMIN',
  empresa: { nome_fantasia: 'Distribuidora X' },
} as Usuario;

function corpoDe(mailto: string) {
  const url = new URL(mailto);
  return { assunto: url.searchParams.get('subject') ?? '', corpo: url.searchParams.get('body') ?? '' };
}

describe('suporte (.env)', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('lê url e e-mail do .env; vazio vira null', () => {
    vi.stubEnv('VITE_URL_SUPORTE', 'https://suporte.exemplo.com/chamados');
    vi.stubEnv('VITE_EMAIL_SUPORTE', '  ');
    expect(configSuporte()).toEqual({ url: 'https://suporte.exemplo.com/chamados', email: null });
  });

  it('item Suporte aparece pra quem está logado — inclusive GESTOR sem nenhuma tela — e some sem configuração', () => {
    const suporte = (u: Usuario | null, cfg: ConfigSuporte = { url: 'https://x', email: null }) =>
      filtrarVisiveis(montarMenu(u, CONTADORES_ZERADOS, [], cfg))
        .flatMap((g) => g.itens)
        .find((i) => i.suporte);

    expect(suporte(admin)?.rotulo).toBe('Suporte');
    expect(suporte({ ...admin, user_type: 'GESTOR', perfil: null } as Usuario)).toBeDefined();
    expect(suporte(admin, { url: null, email: null })).toBeUndefined();
  });

  it('e-mail da área logada leva quem é, empresa, tela e navegador', () => {
    const { assunto, corpo } = corpoDe(
      mailtoLogado('suporte@prossigatec.com.br', {
        usuario: admin,
        tela: 'Relatórios',
        caminho: '/relatorios-personalizados',
        navegador: 'Chrome 141 · Windows',
        agora: new Date(2026, 9, 7, 15, 42),
      }),
    );
    expect(assunto).toBe('Horus — suporte · Distribuidora X');
    expect(corpo).toContain('Usuário: Fabio Admin (fabio@empresa.com)');
    expect(corpo).toContain('Empresa: Distribuidora X');
    expect(corpo).toContain('Perfil: ADMIN');
    expect(corpo).toContain('Tela: Relatórios (/relatorios-personalizados)');
    expect(corpo).toContain('Navegador: Chrome 141 · Windows');
    expect(corpo).toContain('07/10/2026');
  });

  it('descreve o navegador sem identificador', () => {
    expect(descreverNavegador('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0')).toBe(
      'Edge 141 · Windows',
    );
    expect(descreverNavegador('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36')).toBe('Chrome 140 · Android');
  });

  it('painel abre o portal em aba nova (nunca na mesma) e oferece o e-mail', async () => {
    vi.stubEnv('VITE_URL_SUPORTE', 'https://suporte.exemplo.com/chamados');
    vi.stubEnv('VITE_EMAIL_SUPORTE', 'suporte@prossigatec.com.br');
    const ancora = document.body.appendChild(document.createElement('button'));

    renderComProviders(<PainelSuporte ancora={ancora} tela="Atividades" onFechar={() => {}} />, { rota: '/atividades' });

    const portal = await screen.findByRole('link', { name: /abrir chamado/i });
    expect(portal).toHaveAttribute('href', 'https://suporte.exemplo.com/chamados');
    expect(portal).toHaveAttribute('target', '_blank');
    expect(portal).toHaveAttribute('rel', 'noopener noreferrer');

    const email = screen.getByRole('link', { name: /enviar e-mail/i });
    expect(email.getAttribute('href')).toMatch(/^mailto:suporte@prossigatec\.com\.br\?subject=/);
    expect(decodeURIComponent(email.getAttribute('href')!)).toContain('/atividades');
    expect(screen.getByRole('button', { name: 'Copiar e-mail do suporte' })).toBeInTheDocument();
  });

  it('sem url configurada, só o e-mail aparece', async () => {
    vi.stubEnv('VITE_URL_SUPORTE', '');
    vi.stubEnv('VITE_EMAIL_SUPORTE', 'suporte@prossigatec.com.br');
    const ancora = document.body.appendChild(document.createElement('button'));

    renderComProviders(<PainelSuporte ancora={ancora} tela={null} onFechar={() => {}} />);

    await screen.findByRole('link', { name: /enviar e-mail/i });
    expect(screen.queryByRole('link', { name: /abrir chamado/i })).not.toBeInTheDocument();
  });
});

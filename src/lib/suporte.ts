import type { Usuario } from '../types/api';

// Canal de suporte do cliente: portal de chamados (abre sempre em aba nova) e e-mail. Vem do .env
// (VITE_URL_SUPORTE / VITE_EMAIL_SUPORTE) pra trocar domínio/endereço sem mexer no código —
// variável vazia esconde a opção. Lido a cada chamada (não numa constante) pra os testes
// conseguirem simular o .env com vi.stubEnv.

export type ConfigSuporte = { url: string | null; email: string | null };

export function configSuporte(): ConfigSuporte {
  const limpo = (v: unknown) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
  return { url: limpo(import.meta.env.VITE_URL_SUPORTE), email: limpo(import.meta.env.VITE_EMAIL_SUPORTE) };
}

/** "Chrome 141 · Windows" — só o suficiente pro suporte reproduzir, nada de identificador. */
export function descreverNavegador(ua: string = typeof navigator !== 'undefined' ? navigator.userAgent : ''): string {
  const versao = (re: RegExp) => ua.match(re)?.[1];
  const navegador =
    (versao(/Edg\/(\d+)/) && `Edge ${versao(/Edg\/(\d+)/)}`) ||
    (versao(/OPR\/(\d+)/) && `Opera ${versao(/OPR\/(\d+)/)}`) ||
    (versao(/Firefox\/(\d+)/) && `Firefox ${versao(/Firefox\/(\d+)/)}`) ||
    (versao(/Chrome\/(\d+)/) && `Chrome ${versao(/Chrome\/(\d+)/)}`) ||
    (versao(/Version\/(\d+).*Safari/) && `Safari ${versao(/Version\/(\d+).*Safari/)}`) ||
    'Navegador desconhecido';
  const sistema = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'Sistema desconhecido';
  return `${navegador} · ${sistema}`;
}

function mailto(email: string, assunto: string, corpo: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
}

/** E-mail da tela de login: ainda não se sabe quem é, então vai um roteiro pra pessoa preencher. */
export function mailtoLogin(email: string): string {
  return mailto(
    email,
    'Horus — problema para entrar no painel',
    'Olá, equipe Horus.\n\nE-mail que uso para entrar:\nEmpresa:\nO que aconteceu (mensagem de erro, se apareceu):\n\n',
  );
}

/**
 * E-mail da área logada: já leva quem é, de qual empresa e em que tela estava, pro ticket chegar
 * completo. Só dados que o próprio usuário vê — nunca senha nem token.
 */
export function mailtoLogado(
  email: string,
  dados: { usuario: Usuario | null; tela: string | null; caminho: string; agora?: Date; navegador?: string },
): string {
  const { usuario } = dados;
  const empresa = usuario?.empresa?.nome_fantasia ?? null;
  const quando = (dados.agora ?? new Date()).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const linhas = [
    usuario ? `Usuário: ${usuario.nome} (${usuario.email})` : null,
    empresa ? `Empresa: ${empresa}` : null,
    usuario ? `Perfil: ${usuario.perfil?.nome ?? usuario.user_type}` : null,
    `Tela: ${dados.tela ? `${dados.tela} (${dados.caminho})` : dados.caminho}`,
    `Navegador: ${dados.navegador ?? descreverNavegador()}`,
    `Data/hora: ${quando}`,
  ].filter(Boolean);

  return mailto(
    email,
    `Horus — suporte${empresa ? ` · ${empresa}` : ''}`,
    `Olá, equipe Horus.\n\nDescreva o problema:\n\n\n— dados para o suporte (não apague) —\n${linhas.join('\n')}\n`,
  );
}

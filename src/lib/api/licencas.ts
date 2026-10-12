import type { AcessoAppResponse, LicencasResponse } from '../../types/api';
import { apiClient } from './client';

// Licenças do app mobile e aparelhos — docs/67-LICENCIAMENTO-E-SESSAO-UNICA.md §3/§4.

/** Tela "Licenças e plano" (só ADMIN). */
export async function buscarLicencas(): Promise<LicencasResponse> {
  const { data } = await apiClient.get<LicencasResponse>('/empresa/licencas');
  return data;
}

/** Seção "Acesso ao app mobile" do usuário (usuarios.gerenciar). */
export async function buscarAcessoApp(usuarioUuid: string): Promise<AcessoAppResponse> {
  const { data } = await apiClient.get<AcessoAppResponse>(`/usuarios/${usuarioUuid}/acesso-app`);
  return data;
}

/** Libera o aparelho pedido: o atual cai e só o aprovado entra. */
export async function aprovarSolicitacaoAparelho(uuid: string): Promise<void> {
  await apiClient.post(`/solicitacoes-aparelho/${uuid}/aprovar`);
}

export async function recusarSolicitacaoAparelho(uuid: string): Promise<void> {
  await apiClient.post(`/solicitacoes-aparelho/${uuid}/recusar`);
}

/** O próximo aparelho novo entra sem pedido; o atual segue até lá. */
export async function liberarTrocaAparelho(usuarioUuid: string): Promise<void> {
  await apiClient.post(`/usuarios/${usuarioUuid}/liberar-troca-aparelho`);
}

/** Atribui ou remove a licença (remover desvincula o aparelho e derruba a sessão do app). */
export async function definirLicencaMobile(usuarioUuid: string, licenca: boolean): Promise<void> {
  await apiClient.put(`/usuarios/${usuarioUuid}`, { licenca_mobile: licenca });
}

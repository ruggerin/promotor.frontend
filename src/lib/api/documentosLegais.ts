import type { AceiteDocumentoLegal, DocumentoPendente, TipoDocumentoLegal, Usuario } from '../../types/api';
import { apiClient } from './client';

// Termos de Uso e Política de Privacidade — docs/58-ACEITE-TERMOS-E-PRIVACIDADE.md.

/** Raiz do site da API (sem /api): as páginas públicas dos textos ficam lá (§5.2). */
const URL_SITE = String(import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '');

const SLUG: Record<TipoDocumentoLegal, string> = {
  TERMOS_USO: 'termos-de-uso',
  POLITICA_PRIVACIDADE: 'politica-de-privacidade',
};

export const TITULO_DOCUMENTO: Record<TipoDocumentoLegal, string> = {
  TERMOS_USO: 'Termos de Uso',
  POLITICA_PRIVACIDADE: 'Política de Privacidade',
};

/** Página pública do texto; com `versao`, aquela versão exata (pra conferir o que alguém aceitou). */
export function urlDocumento(tipo: TipoDocumentoLegal, versao?: string): string {
  return `${URL_SITE}/${SLUG[tipo]}${versao ? `?versao=${encodeURIComponent(versao)}` : ''}`;
}

/** Registra o aceite das versões mostradas. 409 = publicaram versão nova com a tela aberta. */
export async function aceitarDocumentos(documentos: DocumentoPendente[]): Promise<{ usuario: Usuario }> {
  const { data } = await apiClient.post<{ usuario: Usuario }>('/auth/me/aceites', { documentos });
  return data;
}

export async function listarAceitesUsuario(usuarioUuid: string): Promise<AceiteDocumentoLegal[]> {
  const { data } = await apiClient.get<{ data: AceiteDocumentoLegal[] }>(`/usuarios/${usuarioUuid}/aceites`);
  return data.data;
}

/** "2026-10-06" → "06/10/2026" (a versão é a data de última atualização do texto). */
export function versaoLegivel(versao: string): string {
  const [ano, mes, dia] = versao.split('-');
  return dia && mes && ano ? `${dia}/${mes}/${ano}` : versao;
}

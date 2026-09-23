import { apiClient } from './client';

// Código de 6 dígitos pra autorizar o cancelamento de uma visita travada sem o gestor precisar
// digitar e-mail e senha no aparelho do promotor — ver
// docs/15-INTERVENCAO-ADMINISTRATIVA-VISITA.md §12. Só ADMIN, ou GESTOR com visitas.intervir
// (o backend barra com 403, mesmo gate dos outros 3 endpoints de intervenção).

export interface AutorizacaoGestor {
  codigo: string;
  expira_em: string;
}

export async function gerarAutorizacaoGestor(): Promise<AutorizacaoGestor> {
  const { data } = await apiClient.post<AutorizacaoGestor>('/autorizacoes-gestor');
  return data;
}

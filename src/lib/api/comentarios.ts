import { apiClient } from './client';

// Feedback em registro de visita (docs/28-RELATORIOS-FEEDBACK-HISTORICO.md §3): feed cronológico
// entre promotor e admin/gestor. Abrir o feed marca como lido (é o que apaga o badge).

export interface ComentarioRegistro {
  id: string;
  texto: string;
  criado_em: string;
  autor: { id: string; nome: string; tipo: string };
  meu: boolean;
}

export async function listarComentarios(visitaUuid: string, registroUuid: string): Promise<ComentarioRegistro[]> {
  const { data } = await apiClient.get<{ comentarios: ComentarioRegistro[] }>(
    `/visitas/${visitaUuid}/registros/${registroUuid}/comentarios`,
  );
  return data.comentarios;
}

export async function criarComentario(visitaUuid: string, registroUuid: string, texto: string): Promise<ComentarioRegistro> {
  const { data } = await apiClient.post<{ comentario: ComentarioRegistro }>(
    `/visitas/${visitaUuid}/registros/${registroUuid}/comentarios`,
    { texto },
  );
  return data.comentario;
}

export interface NaoLidos {
  total: number;
  registros: {
    registro_id: string;
    visita_id: string;
    ponto_venda: string | null;
    nao_lidos: number;
    ultimo: { autor: string; texto: string; em: string };
  }[];
}

export async function buscarNaoLidos(): Promise<NaoLidos> {
  const { data } = await apiClient.get<NaoLidos>('/comentarios/nao-lidos');
  return data;
}

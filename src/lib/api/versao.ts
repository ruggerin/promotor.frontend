import { apiClient } from './client';

export interface VersaoApi {
  versao: string;
  ambiente: string;
}

/** GET /versao — público; versão da API (data + commit) e ambiente do servidor. */
export async function buscarVersaoApi(): Promise<VersaoApi> {
  const { data } = await apiClient.get<VersaoApi>('/versao');
  return data;
}

/** Versão deste admin (data + commit), carimbada no build (VITE_VERSAO, ver Dockerfile). */
export const VERSAO_ADMIN = import.meta.env.VITE_VERSAO || 'dev';

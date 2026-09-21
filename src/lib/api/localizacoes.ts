import { apiClient } from './client';

export interface LocalizacaoPromotor {
  id: string;
  nome: string;
  foto_url: string | null;
  latitude: number;
  longitude: number;
  ultima_localizacao_em: string;
  // Calculado no backend (janela de 5 min, App\Support\Rastreamento) — nunca gravado.
  ativo_agora: boolean;
}

// Mapa ao vivo (docs/11-RASTREAMENTO-TEMPO-REAL.md) — exige rastreamento.visualizar.
export async function listarLocalizacoes(): Promise<LocalizacaoPromotor[]> {
  const { data } = await apiClient.get<{ localizacoes: LocalizacaoPromotor[] }>('/localizacoes');
  return data.localizacoes;
}

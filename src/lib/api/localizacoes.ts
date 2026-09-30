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
  // Situação informada pelo app (docs/47 §5.1): ATIVO, SO_DURANTE_USO, GPS_DESLIGADO... null = nunca informou.
  situacao: string | null;
}

// Mapa ao vivo (docs/11-RASTREAMENTO-TEMPO-REAL.md) — exige rastreamento.visualizar.
export async function listarLocalizacoes(): Promise<LocalizacaoPromotor[]> {
  const { data } = await apiClient.get<{ localizacoes: LocalizacaoPromotor[] }>('/localizacoes');
  return data.localizacoes;
}

// Promotores com rastreamento irregular (docs/47-RASTREAMENTO-EXIGENCIA.md §5.4) — só vem
// preenchido com RASTREAMENTO_PAINEL_CONFORMIDADE ligado e dentro da jornada.
export type MotivoIrregular =
  | 'SEM_PERMISSAO'
  | 'SO_DURANTE_USO'
  | 'GPS_DESLIGADO'
  | 'DESLIGADO_PELO_PROMOTOR'
  | 'NAO_SUPORTADO'
  | 'FALHA_AO_INICIAR'
  | 'SEM_SINAL'
  | 'NUNCA_INFORMOU';

export interface ConformidadeRastreamento {
  habilitado: boolean;
  exigencia: 'OPCIONAL' | 'AVISO' | 'OBRIGATORIO';
  dentro_da_jornada: boolean;
  jornada: { inicio: string; fim: string } | null;
  tolerancia_sem_sinal_minutos: number;
  irregulares: {
    id: string;
    nome: string;
    foto_url: string | null;
    motivo: MotivoIrregular;
    detalhe: string | null;
    desde: string | null;
    ultima_localizacao_em: string | null;
  }[];
}

export async function buscarConformidadeRastreamento(): Promise<ConformidadeRastreamento> {
  const { data } = await apiClient.get<ConformidadeRastreamento>('/localizacoes/conformidade');
  return data;
}

import type { AfastamentoTrecho } from '../../types/api';
import { apiClient } from './client';

// Rota do dia — por onde o promotor passou num dia (docs/48-ROTA-DO-DIA.md). Permissão própria
// rastreamento.trajeto.

export interface PromotorRota {
  id: string;
  nome: string;
  foto_url: string | null;
}

export async function listarPromotoresRota(): Promise<PromotorRota[]> {
  const { data } = await apiClient.get<{ promotores: PromotorRota[] }>('/rotas/promotores');
  return data.promotores;
}

type LatLng = [number, number];

export interface RotaDoDia {
  promotor: PromotorRota;
  data: string;
  parametros: {
    parada_minutos: number;
    tolerancia_sem_sinal_minutos: number;
    afastamento_metros: number;
    afastamento_minutos: number;
  };
  pontos: { latitude: number; longitude: number; em: string }[];
  // Um trecho por período contínuo de sinal, já encaixado nas ruas (Mapbox) — [lat, lng].
  linhas: LatLng[][];
  // true = sem serviço de ruas/falhou: linhas retas entre as posições.
  aproximada: boolean;
  sem_sinal: {
    inicio: string;
    fim: string;
    minutos: number;
    de: { latitude: number; longitude: number };
    ate: { latitude: number; longitude: number };
  }[];
  visitas: {
    id: string;
    ordem: number;
    status: string;
    ponto_venda: { id: string; fantasia: string } | null;
    latitude: number;
    longitude: number;
    inicio: string;
    fim: string | null;
    minutos: number | null;
    // Saídas da loja durante a visita (docs/49) e a soma delas.
    afastamentos: AfastamentoTrecho[];
    minutos_fora: number;
    sem_sinal_minutos: number;
  }[];
  paradas: { inicio: string; fim: string; minutos: number; latitude: number; longitude: number }[];
  resumo: {
    visitas: number;
    // Já descontado o tempo fora da loja durante as visitas.
    tempo_em_loja_minutos: number;
    fora_da_loja_minutos: number;
    distancia_km: number;
    parado_fora_minutos: number;
    sem_sinal_minutos: number;
    primeira_posicao_em: string | null;
    ultima_posicao_em: string | null;
  };
}

// Só a data (YYYY-MM-DD): o "dia" fecha à meia-noite do fuso da EMPRESA, decidido no backend —
// não do navegador de quem olha (docs/50 §4.3).
export async function buscarRotaDoDia(usuarioUuid: string, data: string): Promise<RotaDoDia> {
  const { data: resposta } = await apiClient.get<RotaDoDia>('/rotas', { params: { usuario_uuid: usuarioUuid, data } });
  return resposta;
}

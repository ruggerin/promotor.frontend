import axios from 'axios';
import type { EtapaPayload } from '../../lib/api/planosAcao';

// Estado de formulário de uma etapa (ver EtapaCampos) — em arquivo próprio, separado do
// componente, pro fast refresh do Vite continuar funcionando.

export interface EtapaForm {
  titulo: string;
  descricao: string;
  prazo: string;
  responsavel_uuid: string | null;
  responsavel_externo_nome: string;
  responsavel_externo_contato: string;
  evidencia_obrigatoria: boolean;
}

export function etapaVazia(titulo = ''): EtapaForm {
  return {
    titulo,
    descricao: '',
    prazo: '',
    responsavel_uuid: null,
    responsavel_externo_nome: '',
    responsavel_externo_contato: '',
    evidencia_obrigatoria: false,
  };
}

export function etapaParaPayload(e: EtapaForm): EtapaPayload {
  return {
    titulo: e.titulo.trim(),
    descricao: e.descricao.trim() || null,
    prazo: e.prazo || null,
    responsavel_uuid: e.responsavel_uuid,
    responsavel_externo_nome: e.responsavel_externo_nome.trim() || null,
    responsavel_externo_contato: e.responsavel_externo_contato.trim() || null,
    evidencia_obrigatoria: e.evidencia_obrigatoria,
  };
}

// Mensagem da API (422 com `message`/`errors`) ou um fallback genérico.
export function mensagemErro(err: unknown, fallback: string): string {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.data) {
    const primeiroErro = Object.values(err.response.data.errors ?? {})[0]?.[0];
    return primeiroErro ?? err.response.data.message ?? fallback;
  }
  return fallback;
}

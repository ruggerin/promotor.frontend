import type { IntegridadeAparelho, UserType } from '../types/api';

// Textos das telas de licença do app mobile (docs/67) — "Licenças e plano" e a seção "Acesso ao
// app mobile" do usuário.

export const TIPO_USUARIO: Record<UserType, string> = {
  SUPERADMIN: 'Suporte',
  ADMIN: 'Administrador',
  GESTOR: 'Gestor',
  PROMOTOR: 'Promotor',
};

type CorTag = 'success' | 'warning' | 'error' | 'default';

export function tagIntegridade(status: IntegridadeAparelho): { rotulo: string; cor: CorTag } {
  switch (status) {
    case 'ATESTADO':
      return { rotulo: 'Atestado', cor: 'success' };
    case 'SUSPEITO':
      return { rotulo: 'Root ou emulador', cor: 'error' };
    case 'FALHOU':
      return { rotulo: 'Atestação falhou', cor: 'error' };
    default:
      return { rotulo: 'Não atestado', cor: 'default' };
  }
}

export const ORIGEM_VINCULO: Record<'PRIMEIRO' | 'TROCA_PROPRIA' | 'LIBERADO_ADMIN', string> = {
  PRIMEIRO: 'primeiro aparelho',
  TROCA_PROPRIA: 'troca própria',
  LIBERADO_ADMIN: 'liberado pelo gestor',
};

export function nomePlataforma(plataforma: 'android' | 'ios' | null | undefined, versao?: string | null): string | null {
  if (!plataforma) return versao ?? null;
  const nome = plataforma === 'ios' ? 'iOS' : 'Android';
  return versao ? `${nome} ${versao}` : nome;
}

/** "agora", "há 4 min", "há 2 h", "ontem, 17:42", "08/10, 09:15"; null = nunca. */
export function textoUltimoUso(data: string | null | undefined, agora: Date = new Date()): string {
  if (!data) return 'nunca';
  const quando = new Date(data);
  const minutos = Math.floor((agora.getTime() - quando.getTime()) / 60_000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  if (minutos < 24 * 60 && quando.getDate() === agora.getDate()) return `há ${Math.floor(minutos / 60)} h`;
  const hora = quando.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const ontem = new Date(agora);
  ontem.setDate(agora.getDate() - 1);
  if (quando.toDateString() === ontem.toDateString()) return `ontem, ${hora}`;
  return `${quando.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}, ${hora}`;
}

export function dataHora(data: string | null | undefined): string {
  return data ? new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
}

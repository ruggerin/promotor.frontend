import type { AtividadeEvento, VisitaRegistro } from '../../types/api';

// Utilitários do Painel de Atividades (revisão de UX, docs/43-REVISAO-UX-PAINEL-ATIVIDADES.md).
// Em arquivo próprio, separado dos componentes, pro fast refresh do Vite continuar funcionando.

// Cada pessoa tem uma cor fixa (avatar + nome), como num grupo de conversa — dá pra reconhecer
// quem é sem ler. Paleta do protótipo (v2); a cor sai de um hash do id, nunca aleatória por carga.
const PALETA_PESSOAS = [
  { bg: '#ede9fe', fg: '#6d28d9' },
  { bg: '#ccfbf1', fg: '#0f766e' },
  { bg: '#ffedd5', fg: '#c2410c' },
  { bg: '#fce7f3', fg: '#be185d' },
  { bg: '#dcfce7', fg: '#15803d' },
  { bg: '#e0f2fe', fg: '#0369a1' },
  { bg: '#fef9c3', fg: '#a16207' },
  { bg: '#e0e7ff', fg: '#4338ca' },
];

export function corDaPessoa(id: string | undefined | null): { bg: string; fg: string } {
  if (!id) return { bg: '#ecebf3', fg: '#4a4766' };
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return PALETA_PESSOAS[Math.abs(hash) % PALETA_PESSOAS.length];
}

export function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatarMinutos(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
}

// "há 3h02" / "há 12 min" — tempo desde a chegada, na coluna "Em loja agora".
// Acima de 24h (visita esquecida aberta) vira "há 1d 21h" em vez de "há 45h02".
export function haQuanto(iso: string): string {
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos >= 24 * 60) {
    const dias = Math.floor(minutos / (24 * 60));
    const horas = Math.floor((minutos % (24 * 60)) / 60);
    return `há ${dias}d${horas > 0 ? ` ${horas}h` : ''}`;
  }
  return `há ${formatarMinutos(minutos)}`;
}

export function formatarDistancia(metros: number): string {
  return metros >= 1000 ? `${(metros / 1000).toFixed(1).replace('.', ',')} km` : `${metros} m`;
}

export function primeiroNome(nome: string | undefined | null): string {
  return (nome ?? '').trim().split(/\s+/)[0] || 'promotor';
}

// Separador de dia centralizado: { destaque: "Hoje", resto: "sábado, 27 de setembro" }.
export function rotuloDoDia(iso: string): { destaque: string; resto: string } {
  const data = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  const resto = data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  if (data.toDateString() === hoje.toDateString()) return { destaque: 'Hoje', resto };
  if (data.toDateString() === ontem.toDateString()) return { destaque: 'Ontem', resto };
  return { destaque: resto.charAt(0).toUpperCase() + resto.slice(1), resto: data.getFullYear() !== hoje.getFullYear() ? String(data.getFullYear()) : '' };
}

export function agruparPorDia(eventos: AtividadeEvento[]): { chave: string; eventos: AtividadeEvento[] }[] {
  const grupos = new Map<string, AtividadeEvento[]>();
  for (const evento of eventos) {
    const chave = new Date(evento.ocorrido_em).toLocaleDateString('en-CA'); // YYYY-MM-DD local
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave)!.push(evento);
  }
  return Array.from(grupos.entries()).map(([chave, doDia]) => ({ chave, eventos: doDia }));
}

// Assunto do registro: produto > seção/departamento/marca > nada (o tipo já aparece na frase).
export function assuntoDoRegistro(registro: VisitaRegistro): string | null {
  return (
    registro.produto_auditoria?.descricao ??
    registro.secao?.descricao ??
    registro.departamento?.descricao ??
    registro.marca?.descricao ??
    null
  );
}

// Período do filtro — "Hoje e ontem" é o padrão (docs/43 §6 decisão 3).
export type PresetPeriodo = 'hoje' | 'hoje_ontem' | '7_dias' | 'personalizado';

export const ROTULO_PERIODO: Record<PresetPeriodo, string> = {
  hoje: 'Hoje',
  hoje_ontem: 'Hoje e ontem',
  '7_dias': 'Últimos 7 dias',
  personalizado: 'Personalizado',
};

function isoLocal(d: Date): string {
  return d.toLocaleDateString('en-CA');
}

export function datasDoPreset(preset: Exclude<PresetPeriodo, 'personalizado'>): { inicio: string; fim: string } {
  const hoje = new Date();
  const inicio = new Date(hoje);
  if (preset === 'hoje_ontem') inicio.setDate(hoje.getDate() - 1);
  if (preset === '7_dias') inicio.setDate(hoje.getDate() - 6);
  return { inicio: isoLocal(inicio), fim: isoLocal(hoje) };
}

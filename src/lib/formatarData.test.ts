import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dataLocalISO, formatarDataSemFuso, tempoDesde } from './formatarData';
import { FUSO_PADRAO, FUSOS_BRASIL, rotuloFuso } from './fusos';

describe('tempoDesde', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-30T15:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('usa a unidade que faz sentido (min, h, dias) — nunca "7204 min"', () => {
    expect(tempoDesde('2026-09-30T14:48:00Z')).toBe('12 min');
    expect(tempoDesde('2026-09-30T12:00:00Z')).toBe('3 h');
    expect(tempoDesde('2026-09-29T14:00:00Z')).toBe('1 dia');
    expect(tempoDesde('2026-09-25T15:00:00Z')).toBe('5 dias');
  });

  it('horário no futuro (relógio adiantado) vira 0 min, não negativo', () => {
    expect(tempoDesde('2026-09-30T15:05:00Z')).toBe('0 min');
  });
});

describe('formatarDataSemFuso', () => {
  it('pega o dia do prefixo, sem converter pro fuso do navegador', () => {
    expect(formatarDataSemFuso('2026-01-01T00:00:00.000000Z')).toBe('01/01/2026');
  });
});

describe('fusos do Brasil (docs/50)', () => {
  it('padrão é Brasília e Manaus está na lista', () => {
    expect(FUSO_PADRAO).toBe('America/Sao_Paulo');
    expect(FUSOS_BRASIL.map((f) => f.valor)).toContain('America/Manaus');
  });

  it('rótulo amigável, com fallback pro nome IANA desconhecido', () => {
    expect(rotuloFuso('America/Manaus')).toMatch(/Amazonas \(UTC−4\)/);
    expect(rotuloFuso('Europe/Lisbon')).toBe('Europe/Lisbon');
    expect(rotuloFuso(null)).toBe('—');
  });
});

describe('dataLocalISO (bug do "hoje" em UTC, docs/50)', () => {
  it('usa a data local, não a UTC, perto da meia-noite', () => {
    // 23:30 local do dia 3 — em UTC (UTC-4) já seria dia 4; toISOString() errava aqui.
    expect(dataLocalISO(new Date(2026, 9, 3, 23, 30))).toBe('2026-10-03');
    expect(dataLocalISO(new Date(2026, 9, 4, 0, 5))).toBe('2026-10-04');
  });

  it('completa mês e dia com zero e cruza virada de mês e de ano', () => {
    expect(dataLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dataLocalISO(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    expect(dataLocalISO(new Date(2027, 0, 1, 0, 0))).toBe('2027-01-01');
  });
});

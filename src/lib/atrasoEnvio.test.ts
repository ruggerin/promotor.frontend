import { describe, expect, it } from 'vitest';
import { atrasoEnvioMinutos, LIMITE_ATRASO_ENVIO_MINUTOS, textoAtrasoEnvio } from './atrasoEnvio';

describe('atraso de envio do app (docs/51 Fase 3)', () => {
  it('só avisa acima do limite de 5 min', () => {
    expect(LIMITE_ATRASO_ENVIO_MINUTOS).toBe(5);
    expect(atrasoEnvioMinutos('2026-10-01T14:00:00Z', '2026-10-01T14:05:00Z')).toBeNull();
    expect(atrasoEnvioMinutos('2026-10-01T14:00:00Z', '2026-10-01T14:47:00Z')).toBe(47);
  });

  it('sem a hora da chegada (visita antiga) não dá pra saber', () => {
    expect(atrasoEnvioMinutos('2026-10-01T14:00:00Z', null)).toBeNull();
    expect(atrasoEnvioMinutos(null, '2026-10-01T14:47:00Z')).toBeNull();
  });

  it('texto em minutos ou horas', () => {
    expect(textoAtrasoEnvio(47)).toBe('chegou 47 min depois');
    expect(textoAtrasoEnvio(120)).toBe('chegou 2h depois');
    expect(textoAtrasoEnvio(135)).toBe('chegou 2h15 depois');
  });
});

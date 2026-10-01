import { describe, expect, it } from 'vitest';
import { diasDesde, textoAppsAcesso, textoUltimoAcesso } from './acesso';

// docs/52 — datas de uso vêm como YYYY-MM-DD (dia), nunca com hora.
describe('último acesso', () => {
  const hoje = new Date(2026, 9, 1, 15, 0); // 01/10/2026 15:00 local

  it('hoje, ontem, há N dias', () => {
    expect(textoUltimoAcesso('2026-10-01', hoje)).toBe('hoje');
    expect(textoUltimoAcesso('2026-09-30', hoje)).toBe('ontem');
    expect(textoUltimoAcesso('2026-09-22', hoje)).toBe('há 9 dias');
  });

  it('nunca usou desde que a medição começou', () => {
    expect(textoUltimoAcesso(null, hoje)).toBe('sem acesso registrado');
  });

  it('conta dias de calendário, sem depender da hora', () => {
    expect(diasDesde('2026-09-30', new Date(2026, 9, 1, 0, 5))).toBe(1);
    expect(diasDesde('2026-09-30', new Date(2026, 9, 1, 23, 55))).toBe(1);
  });

  it('em qual app usou', () => {
    expect(textoAppsAcesso('2026-10-01', '2026-09-28')).toBe('app e admin web');
    expect(textoAppsAcesso('2026-10-01', null)).toBe('app');
    expect(textoAppsAcesso(null, '2026-09-28')).toBe('admin web');
    expect(textoAppsAcesso(null, null)).toBeNull();
  });
});

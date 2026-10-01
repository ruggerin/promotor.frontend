// Uso do sistema (docs/52-LOG-DE-ACESSO-E-ADESAO.md) — as datas vêm como YYYY-MM-DD (dia no fuso da
// empresa), sem hora: o registro é "usou neste dia", não "logou às tantas".

/** Dias inteiros entre uma data YYYY-MM-DD e hoje (no relógio de quem olha). */
export function diasDesde(data: string, hoje: Date = new Date()): number {
  const [a, m, d] = data.slice(0, 10).split('-').map(Number);
  const dia = Date.UTC(a, m - 1, d);
  const hojeUtc = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.max(0, Math.round((hojeUtc - dia) / 86_400_000));
}

/** "hoje", "ontem", "há 5 dias" — null = nunca usou desde que a medição começou. */
export function textoUltimoAcesso(data: string | null | undefined, hoje: Date = new Date()): string {
  if (!data) return 'sem acesso registrado';
  const dias = diasDesde(data, hoje);
  if (dias === 0) return 'hoje';
  if (dias === 1) return 'ontem';
  return `há ${dias} dias`;
}

/** Onde usou: só no app, só no admin web, ou nos dois. */
export function textoAppsAcesso(mobileEm: string | null | undefined, adminEm: string | null | undefined): string | null {
  if (mobileEm && adminEm) return 'app e admin web';
  if (mobileEm) return 'app';
  if (adminEm) return 'admin web';
  return null;
}

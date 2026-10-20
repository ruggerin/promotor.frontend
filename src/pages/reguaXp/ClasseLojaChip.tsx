import { Chip } from '@mui/material';
import { MdiIcon } from '../../components/MdiIcon';
import type { ClasseLojaResumo } from '../../types/api';

// Classe da loja na régua de XP (docs/88 §4) — ícone MDI e cor do cadastro.
export function ClasseLojaChip({ classe, xp }: { classe: ClasseLojaResumo | null | undefined; xp?: number }) {
  if (!classe) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={classe.icone ? <MdiIcon icone={classe.icone} size={16} sx={{ color: classe.cor ?? undefined }} /> : undefined}
      label={xp !== undefined ? `${classe.nome} · ${xp.toLocaleString('pt-BR')} XP` : classe.nome}
      sx={{ borderColor: classe.cor ?? undefined }}
    />
  );
}

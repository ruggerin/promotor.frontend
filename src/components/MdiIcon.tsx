import { Box, type SxProps, type Theme } from '@mui/material';

/**
 * Ícone de `TipoRegistro.icone` — slug do Material Design Icons (pictogrammers.com/library/mdi,
 * sem o prefixo "mdi-"), renderizado via a fonte `@mdi/font` (classe CSS `mdi mdi-{slug}`,
 * importada uma vez em main.tsx). O mesmo slug renderiza no mobile via
 * `MaterialCommunityIcons` (`@expo/vector-icons`) — nenhuma tradução entre plataformas. Slug
 * inválido/digitado errado não quebra nada, só não desenha glifo nenhum (span vazio).
 */
export function MdiIcon({
  icone,
  size = 20,
  sx,
}: {
  icone?: string | null;
  size?: number;
  sx?: SxProps<Theme>;
}) {
  if (!icone) {
    return null;
  }

  return (
    <Box
      component="span"
      className={`mdi mdi-${icone}`}
      sx={{ fontSize: size, lineHeight: 1, ...sx }}
    />
  );
}

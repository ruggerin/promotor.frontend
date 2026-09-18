import { createTheme } from '@mui/material/styles';

// Ponto único de configuração visual do admin web (docs/24-TEMA-ADMIN-WEB.md, Cenário A —
// tema geral, o mesmo pra toda empresa que usa o sistema, não configurável por tela nenhuma).
// Trocar cor ou fonte é editar este arquivo — nenhum componente do admin usa cor/fonte fixa
// fora daqui, todos herdam de `theme.palette`/`theme.typography` (MUI já resolve isso sozinho
// pra Button/Chip/TextField/etc.; telas com cor "fixa" hoje, como o Drawer/AppBar padrão do
// MUI, também herdam automaticamente sem precisar tocar em cada uma).
export const theme = createTheme({
  palette: {
    primary: {
      main: '#4f46e5',
      dark: '#3730a3',
      light: '#818cf8',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#f59e0b',
      dark: '#b45309',
      light: '#fbbf24',
      contrastText: '#1a1830',
    },
  },
  typography: {
    fontFamily: '"IBM Plex Sans", "Roboto", system-ui, sans-serif',
  },
  shape: {
    borderRadius: 10,
  },
});

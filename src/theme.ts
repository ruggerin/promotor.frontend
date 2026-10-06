import { ptBR } from '@mui/material/locale';
import { createTheme } from '@mui/material/styles';

// Ponto único de configuração visual do admin web (docs/24-TEMA-ADMIN-WEB.md, Cenário A —
// tema geral, o mesmo pra toda empresa que usa o sistema). Valores seguem o "Padrão visual do
// admin Horus" (6/10/2026): borda no lugar de sombra, raio pequeno, IBM Plex Sans 13px, índigo
// só pra ação/ativo e âmbar só pra atenção. Trocar cor ou fonte é editar este arquivo.

/** Tokens do padrão Horus — usados direto onde o palette do MUI não cobre (menu lateral, header). */
export const horus = {
  indigo: '#4f46e5',
  indigoEscuro: '#3730a3',
  indigoClaro: '#eef0fe',
  ambar: '#f59e0b',
  ambarEscuro: '#b45309',
  ambarClaro: '#fef3c7',
  fundo: '#f3f4f8',
  painel: '#ffffff',
  subcard: '#fbfbfd',
  cinzaSuave: '#f0f0f5',
  borda: '#e7e7ef',
  bordaCampo: '#dedeea',
  hover: '#f4f4f9',
  texto: '#1b1b2b',
  texto2: '#3f3f55',
  textoSecundario: '#6e6e85',
  textoFraco: '#a3a3b8',
  ok: '#15803d',
  okClaro: '#dcfce7',
  problema: '#b91c1c',
  problemaClaro: '#fee2e2',
  fonte: '"IBM Plex Sans", Roboto, system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
} as const;

// Tag de status: fundo claro + texto escuro da mesma cor, nunca cheia com texto branco.
const tagSuave = {
  primary: { bg: horus.indigoClaro, fg: horus.indigoEscuro },
  secondary: { bg: horus.ambarClaro, fg: horus.ambarEscuro },
  success: { bg: horus.okClaro, fg: horus.ok },
  warning: { bg: horus.ambarClaro, fg: horus.ambarEscuro },
  error: { bg: horus.problemaClaro, fg: horus.problema },
  info: { bg: horus.indigoClaro, fg: horus.indigoEscuro },
  default: { bg: horus.cinzaSuave, fg: horus.textoSecundario },
} as const;

export const theme = createTheme(
  {
    palette: {
      primary: { main: horus.indigo, dark: horus.indigoEscuro, light: horus.indigoClaro, contrastText: '#ffffff' },
      secondary: { main: horus.ambar, dark: horus.ambarEscuro, light: horus.ambarClaro, contrastText: horus.texto },
      success: { main: horus.ok, light: horus.okClaro, contrastText: '#ffffff' },
      warning: { main: horus.ambarEscuro, light: horus.ambarClaro, contrastText: '#ffffff' },
      error: { main: horus.problema, light: horus.problemaClaro, contrastText: '#ffffff' },
      info: { main: horus.indigo, dark: horus.indigoEscuro, light: horus.indigoClaro, contrastText: '#ffffff' },
      background: { default: horus.fundo, paper: horus.painel },
      text: { primary: horus.texto, secondary: horus.textoSecundario, disabled: horus.textoFraco },
      divider: horus.borda,
      action: { hover: horus.hover },
    },
    typography: {
      fontFamily: horus.fonte,
      fontSize: 13,
      h4: { fontSize: 22, fontWeight: 600, lineHeight: 1.3 },
      h5: { fontSize: 17, fontWeight: 600, lineHeight: 1.3 },
      h6: { fontSize: 15, fontWeight: 600, lineHeight: 1.3 },
      subtitle1: { fontSize: 13.5, fontWeight: 600, lineHeight: 1.4 },
      subtitle2: { fontSize: 12.5, fontWeight: 500, lineHeight: 1.4 },
      body1: { fontSize: 13, lineHeight: 1.5 },
      body2: { fontSize: 12.5, lineHeight: 1.5 },
      caption: { fontSize: 12, lineHeight: 1.4 },
      overline: { fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', lineHeight: 1.6 },
      button: { fontSize: 13, fontWeight: 500, textTransform: 'none' },
    },
    shape: { borderRadius: 6 },
    // Sombra só no menu suspenso (MuiPopover/MuiMenu, abaixo) — o resto é borda de 1px.
    shadows: ['none', ...Array<string>(24).fill('none')] as never,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { WebkitFontSmoothing: 'antialiased', fontVariantNumeric: 'tabular-nums' },
          'code, kbd, samp': { fontFamily: horus.mono },
        },
      },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: { rounded: { borderRadius: 8 } },
        variants: [
          { props: { variant: 'elevation', elevation: 0 }, style: { border: `1px solid ${horus.borda}` } },
        ],
      },
      MuiCard: { defaultProps: { elevation: 0 } },
      MuiDialog: {
        styleOverrides: { paper: { border: `1px solid ${horus.borda}`, borderRadius: 8 } },
      },
      MuiDialogTitle: { styleOverrides: { root: { fontSize: 15, fontWeight: 600 } } },
      MuiPopover: {
        styleOverrides: {
          paper: {
            border: `1px solid ${horus.bordaCampo}`,
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(27, 27, 43, 0.08)',
          },
        },
      },
      MuiAutocomplete: {
        styleOverrides: {
          paper: {
            border: `1px solid ${horus.bordaCampo}`,
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(27, 27, 43, 0.08)',
          },
        },
      },
      MuiMenu: { styleOverrides: { list: { padding: 4 } } },
      MuiMenuItem: {
        styleOverrides: {
          root: { fontSize: 13, minHeight: 32, borderRadius: 4, padding: '6px 10px' },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { height: 34, padding: '0 14px', borderRadius: 6, whiteSpace: 'nowrap' },
          sizeSmall: { height: 26, padding: '0 10px', fontSize: 12 },
          sizeLarge: { height: 40 },
          startIcon: { marginRight: 6, '& > *:nth-of-type(1)': { fontSize: 17 } },
          endIcon: { marginLeft: 6, '& > *:nth-of-type(1)': { fontSize: 17 } },
        },
        variants: [
          // Secundário: fundo branco, borda de campo, texto normal (não índigo).
          {
            props: { variant: 'outlined' },
            style: {
              borderColor: horus.bordaCampo,
              color: horus.texto,
              backgroundColor: horus.painel,
              '&:hover': { borderColor: horus.bordaCampo, backgroundColor: horus.hover },
            },
          },
          {
            props: { variant: 'outlined', color: 'error' },
            style: { color: horus.problema },
          },
          {
            props: { variant: 'contained', color: 'primary' },
            style: { '&:hover': { backgroundColor: horus.indigoEscuro } },
          },
        ],
      },
      MuiIconButton: {
        styleOverrides: { root: { borderRadius: 6 }, sizeSmall: { padding: 4 } },
      },
      MuiToggleButton: {
        styleOverrides: { root: { textTransform: 'none', height: 34, borderColor: horus.bordaCampo } },
      },
      MuiTextField: { defaultProps: { size: 'small' } },
      MuiFormControl: { defaultProps: { size: 'small' } },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            backgroundColor: horus.painel,
            '& .MuiOutlinedInput-notchedOutline': { borderColor: horus.bordaCampo },
            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: horus.textoFraco },
          },
          input: { '&::placeholder': { color: horus.textoFraco, opacity: 1 } },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { fontSize: 13 } } },
      MuiTable: { defaultProps: { size: 'small' } },
      MuiTableCell: {
        styleOverrides: {
          root: { height: 40, borderColor: horus.borda, fontSize: 13, padding: '0 12px' },
          head: {
            height: 36,
            backgroundColor: horus.cinzaSuave,
            color: horus.textoSecundario,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            borderBottom: 0,
          },
        },
      },
      MuiTableRow: {
        styleOverrides: { root: { '&:last-child td': { borderBottom: 0 } } },
      },
      MuiTablePagination: {
        styleOverrides: { root: { borderTop: `1px solid ${horus.borda}`, color: horus.textoSecundario } },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, height: 22, fontSize: 11.5, fontWeight: 500 },
          label: { paddingLeft: 8, paddingRight: 8 },
          sizeSmall: { height: 20 },
          icon: { fontSize: 14, marginLeft: 6 },
          deleteIcon: { fontSize: 15 },
        },
        variants: [
          ...(Object.entries(tagSuave) as [keyof typeof tagSuave, { bg: string; fg: string }][]).map(
            ([color, { bg, fg }]) => ({
              props: { variant: 'filled' as const, color },
              style: {
                backgroundColor: bg,
                color: fg,
                '& .MuiChip-icon, & .MuiChip-deleteIcon': { color: fg },
                '&.MuiChip-clickable:hover': { backgroundColor: bg, filter: 'brightness(0.97)' },
              },
            }),
          ),
          { props: { variant: 'outlined' }, style: { borderColor: horus.bordaCampo } },
        ],
      },
      MuiTabs: {
        styleOverrides: {
          root: { minHeight: 40, borderBottom: `1px solid ${horus.borda}` },
          indicator: { height: 2 },
        },
      },
      MuiTab: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            minHeight: 40,
            minWidth: 0,
            padding: '8px 0',
            marginRight: 20,
            fontSize: 13,
            fontWeight: 400,
            color: horus.textoSecundario,
            '&.Mui-selected': { fontWeight: 500 },
            '&:hover': { color: horus.texto },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: { backgroundColor: horus.texto, fontSize: 12, fontWeight: 400, borderRadius: 4, padding: '4px 8px' },
          arrow: { color: horus.texto },
        },
      },
      MuiAlert: {
        styleOverrides: { root: { borderRadius: 6, fontSize: 13, alignItems: 'center' } },
      },
      MuiDivider: { styleOverrides: { root: { borderColor: horus.borda } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4 } } },
      MuiAccordion: {
        defaultProps: { disableGutters: true },
        styleOverrides: { root: { '&:before': { display: 'none' } } },
      },
    },
  },
  // Textos nativos dos componentes MUI em português (paginação "1–15 de 100", "Linhas por página", etc.).
  ptBR,
);

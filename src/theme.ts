import { ptBR } from '@mui/material/locale';
import { createTheme, type Theme } from '@mui/material/styles';

// Ponto único de configuração visual do admin web (docs/24-TEMA-ADMIN-WEB.md, Cenário A —
// tema geral, o mesmo pra toda empresa que usa o sistema). Valores seguem o "Padrão visual do
// admin Horus" (6/10/2026): borda no lugar de sombra, raio pequeno, IBM Plex Sans 13px, índigo
// só pra ação/ativo e âmbar só pra atenção. Trocar cor ou fonte é editar este arquivo.
//
// Tema claro e escuro (docs/65): as cores existem em dois conjuntos com as mesmas chaves. Os
// componentes usam `horus.x`, que é uma variável CSS (`var(--horus-x)`) — trocar de tema só troca
// o valor das variáveis, sem re-renderizar nada que use `horus`. O palette do MUI precisa de cor
// de verdade (calcula transparências), então recebe os valores do conjunto do tema ativo.

export type ModoTema = 'claro' | 'escuro';

type Cores = {
  indigo: string;
  /** Texto sobre o fundo índigo suave (tag, item com hover). */
  indigoEscuro: string;
  /** Fundo índigo suave (tag, item ativo leve). */
  indigoClaro: string;
  /** Hover do botão índigo cheio. */
  indigoHover: string;
  ambar: string;
  ambarEscuro: string;
  ambarClaro: string;
  fundo: string;
  painel: string;
  subcard: string;
  cinzaSuave: string;
  borda: string;
  bordaCampo: string;
  hover: string;
  texto: string;
  texto2: string;
  textoSecundario: string;
  textoFraco: string;
  ok: string;
  okClaro: string;
  problema: string;
  problemaClaro: string;
  /** Fundo vermelho bem leve (lista de alertas). */
  problemaSuave: string;
  /** Fundo do tooltip (escuro nos dois temas). */
  tooltip: string;
  sombra: string;
};

const CLARO: Cores = {
  indigo: '#4f46e5',
  indigoEscuro: '#3730a3',
  indigoClaro: '#eef0fe',
  indigoHover: '#3730a3',
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
  problemaSuave: '#fbf7f7',
  tooltip: '#1b1b2b',
  sombra: 'rgba(27, 27, 43, 0.08)',
};

// Escuro: fundo grafite levemente azulado (não preto puro), painel um degrau acima, borda sutil.
// Os pares "claro/escuro" de cada cor se invertem: o fundo da tag fica escuro e o texto, claro.
const ESCURO: Cores = {
  indigo: '#6366f1',
  indigoEscuro: '#c7c9ff',
  indigoClaro: '#26274a',
  indigoHover: '#4f46e5',
  ambar: '#f59e0b',
  ambarEscuro: '#fbbf24',
  ambarClaro: '#3a2c0e',
  fundo: '#0f1017',
  painel: '#171821',
  subcard: '#1b1c27',
  cinzaSuave: '#1f2130',
  borda: '#2a2c3b',
  bordaCampo: '#363949',
  hover: '#222433',
  texto: '#e7e7f0',
  texto2: '#c8c8d6',
  textoSecundario: '#9b9bb2',
  textoFraco: '#6c6c84',
  ok: '#4ade80',
  okClaro: '#13301f',
  problema: '#f87171',
  problemaClaro: '#3a1719',
  problemaSuave: '#211518',
  tooltip: '#2c2f40',
  sombra: 'rgba(0, 0, 0, 0.45)',
};

export const CORES: Record<ModoTema, Cores> = { claro: CLARO, escuro: ESCURO };

const nomeVar = (chave: string) => `--horus-${chave.replace(/[A-Z]/g, (l) => `-${l.toLowerCase()}`)}`;

/** Tokens do padrão Horus — usados direto onde o palette do MUI não cobre (menu lateral, header). */
export const horus = {
  ...(Object.fromEntries(Object.keys(CLARO).map((k) => [k, `var(${nomeVar(k)})`])) as Record<keyof Cores, string>),
  fonte: '"IBM Plex Sans", Roboto, system-ui, sans-serif',
  mono: '"IBM Plex Mono", ui-monospace, Menlo, monospace',
} as const;

function variaveis(cores: Cores): Record<string, string> {
  return Object.fromEntries(Object.entries(cores).map(([k, v]) => [nomeVar(k), v]));
}

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

export function criarTema(modo: ModoTema): Theme {
  const c = CORES[modo];
  const escuro = modo === 'escuro';
  return createTheme(
    {
      palette: {
        mode: escuro ? 'dark' : 'light',
        primary: { main: c.indigo, dark: c.indigoHover, light: c.indigoClaro, contrastText: '#ffffff' },
        secondary: { main: c.ambar, dark: c.ambarEscuro, light: c.ambarClaro, contrastText: '#1b1b2b' },
        success: escuro
          ? { main: '#22c55e', light: c.okClaro, contrastText: '#0b1a10' }
          : { main: c.ok, light: c.okClaro, contrastText: '#ffffff' },
        warning: escuro
          ? { main: '#f59e0b', light: c.ambarClaro, contrastText: '#1b1b2b' }
          : { main: c.ambarEscuro, light: c.ambarClaro, contrastText: '#ffffff' },
        error: escuro
          ? { main: '#ef4444', light: c.problemaClaro, contrastText: '#ffffff' }
          : { main: c.problema, light: c.problemaClaro, contrastText: '#ffffff' },
        info: { main: c.indigo, dark: c.indigoHover, light: c.indigoClaro, contrastText: '#ffffff' },
        background: { default: c.fundo, paper: c.painel },
        text: { primary: c.texto, secondary: c.textoSecundario, disabled: c.textoFraco },
        divider: c.borda,
        action: { hover: c.hover },
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
            ':root': { ...variaveis(c), colorScheme: escuro ? 'dark' : 'light' },
            body: { WebkitFontSmoothing: 'antialiased', fontVariantNumeric: 'tabular-nums' },
            'code, kbd, samp': { fontFamily: horus.mono },
          },
        },
        MuiPaper: {
          defaultProps: { elevation: 0 },
          styleOverrides: { rounded: { borderRadius: 8 } },
          variants: [{ props: { variant: 'elevation', elevation: 0 }, style: { border: `1px solid ${horus.borda}` } }],
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
              boxShadow: `0 8px 24px ${c.sombra}`,
            },
          },
        },
        MuiAutocomplete: {
          styleOverrides: {
            paper: {
              border: `1px solid ${horus.bordaCampo}`,
              borderRadius: 6,
              boxShadow: `0 8px 24px ${c.sombra}`,
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
              style: { '&:hover': { backgroundColor: horus.indigoHover } },
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
            ...(Object.entries(tagSuave) as [keyof typeof tagSuave, { bg: string; fg: string }][]).map(([color, { bg, fg }]) => ({
              props: { variant: 'filled' as const, color },
              style: {
                backgroundColor: bg,
                color: fg,
                '& .MuiChip-icon, & .MuiChip-deleteIcon': { color: fg },
                '&.MuiChip-clickable:hover': { backgroundColor: bg, filter: 'brightness(0.97)' },
              },
            })),
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
            tooltip: {
              backgroundColor: horus.tooltip,
              color: '#f3f3f8',
              fontSize: 12,
              fontWeight: 400,
              borderRadius: 4,
              padding: '4px 8px',
            },
            arrow: { color: horus.tooltip },
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
}

/** Tema claro — o padrão (login, testes e quem nunca escolheu). */
export const theme = criarTema('claro');

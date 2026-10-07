import { Box, Typography } from '@mui/material';
import { keyframes } from '@mui/material/styles';

// Painel direito da tela de login (protótipo docs/login-prototipo.html, variação índigo):
// promotor fazendo o registro da gôndola, com o pin de GPS pulsando e os cards flutuando.

// Onda que sai do pin de GPS sobre a loja.
const pulso = keyframes`
  0% { transform: scale(0.6); opacity: 0.9; }
  100% { transform: scale(1.6); opacity: 0; }
`;

// Sobe e desce suave dos cards; o "b" roda meio ciclo defasado pra não andarem juntos.
const flutuar = keyframes`
  50% { transform: translateY(-5px); }
`;

const COR = {
  deco: 'rgba(255,255,255,.07)',
  fundoGondola: 'rgba(255,255,255,.10)',
  estrutura: '#3730a3',
  prateleira: '#e4e3fb',
  sombra: 'rgba(39,33,130,.55)',
  piso: 'rgba(39,33,130,.45)',
  feixe: 'rgba(255,255,255,.16)',
  texto: '#1f1d3a',
  textoFraco: '#6b6889',
  indigoMedio: '#818cf8',
  ambarMedio: '#fbbf24',
  pele: '#b97a52',
  peleSombra: '#a96a44',
  cabelo: '#2a1d17',
  calca: '#3b3a4a',
  vermelho: '#dc2626',
  verde: '#16a34a',
};

const fonteSvg = '"IBM Plex Sans", Roboto, system-ui, sans-serif';

/** Desktop com pouca altura (notebook 14", monitor pequeno): o login todo encolhe pra caber sem rolar. */
export const TELA_BAIXA = '@media (min-width: 900px) and (max-height: 760px)';

export function IlustracaoLogin() {
  return (
    <Box
      component="section"
      aria-label="Ilustração: promotor fazendo o registro da gôndola no ponto de venda"
      sx={{
        position: 'relative',
        bgcolor: 'primary.main',
        // No celular/tablet o banner sai: só o formulário, ocupando a tela.
        display: { xs: 'none', md: 'flex' },
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 3.5,
        px: 'clamp(16px, 4vw, 56px)',
        py: 5,
        overflow: 'hidden',
        minWidth: 0,
        [TELA_BAIXA]: { py: 3, gap: 2 },
        '& .pulso': { transformOrigin: '445px 92px', animation: `${pulso} 2.4s ease-out infinite` },
        '& .flutuar-a': { animation: `${flutuar} 6s ease-in-out infinite` },
        '& .flutuar-b': { animation: `${flutuar} 6s ease-in-out -3s infinite` },
        '@media (prefers-reduced-motion: reduce)': {
          '& .pulso, & .flutuar-a, & .flutuar-b': { animation: 'none' },
        },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 600 800"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <circle fill={COR.deco} cx="560" cy="90" r="190" />
        <circle fill={COR.deco} cx="40" cy="760" r="230" />
      </Box>

      <Box
        component="svg"
        viewBox="0 0 560 500"
        role="img"
        aria-label="Promotor de camiseta âmbar faz o registro de uma gôndola com o celular. Um alerta mostra check-in confirmado a 42 metros da loja e um card mostra ruptura de 3,8 por cento no dia."
        sx={{
          position: 'relative',
          width: '100%',
          maxWidth: 560,
          height: 'auto',
          display: 'block',
          // A cena encolhe pela altura também, sobrando espaço pro texto abaixo dela.
          maxHeight: { md: 'calc(100vh - 240px)' },
          [TELA_BAIXA]: { maxHeight: 'calc(100vh - 170px)' },
        }}
      >
        {/* piso */}
        <ellipse fill={COR.piso} cx="300" cy="474" rx="250" ry="16" />

        {/* gôndola */}
        <rect fill={COR.fundoGondola} x="312" y="150" width="176" height="318" />
        <rect fill={COR.estrutura} x="300" y="140" width="12" height="330" rx="3" />
        <rect fill={COR.estrutura} x="488" y="140" width="12" height="330" rx="3" />
        <rect x="300" y="112" width="200" height="34" rx="6" fill="#f59e0b" />
        <text fontFamily={fonteSvg} x="400" y="134" textAnchor="middle" fontSize="13" fontWeight="700" letterSpacing="1.5" fill="#ffffff">
          MERCEARIA
        </text>

        {/* prateleira 1: garrafas */}
        <g>
          {[
            [322, '#ffffff'],
            [346, '#ffffff'],
            [370, COR.ambarMedio],
            [394, COR.ambarMedio],
            [418, COR.indigoMedio],
            [442, COR.indigoMedio],
            [466, COR.indigoMedio],
          ].map(([x, cor]) => (
            <path key={x} d={`M${x},226 v-34 q0-8 5-12 v-8 h8 v8 q5 4 5 12 v34 z`} fill={cor as string} />
          ))}
          <rect x="322" y="198" width="18" height="10" fill="#4f46e5" opacity=".85" />
          <rect x="346" y="198" width="18" height="10" fill="#4f46e5" opacity=".85" />
        </g>
        <rect fill={COR.prateleira} x="312" y="226" width="176" height="8" />
        <rect x="380" y="234" width="22" height="9" rx="1.5" fill="#f59e0b" />

        {/* prateleira 2: caixas, com uma ruptura */}
        <g>
          <rect x="320" y="260" width="34" height="44" rx="2" fill="#f59e0b" />
          <rect x="320" y="270" width="34" height="8" fill="#ffffff" opacity=".7" />
          <rect x="358" y="260" width="34" height="44" rx="2" fill="#f59e0b" />
          <rect x="358" y="270" width="34" height="8" fill="#ffffff" opacity=".7" />
          <rect x="400" y="272" width="28" height="28" rx="3" fill="none" stroke={COR.vermelho} strokeWidth="2" strokeDasharray="4 3" />
          <rect x="436" y="260" width="44" height="44" rx="2" fill="#ffffff" />
          <rect x="444" y="272" width="28" height="12" rx="2" fill={COR.indigoMedio} />
        </g>
        <rect fill={COR.prateleira} x="312" y="304" width="176" height="8" />
        <g>
          <rect x="389" y="246" width="50" height="16" rx="8" fill={COR.vermelho} />
          <text fontFamily={fonteSvg} x="414" y="258" textAnchor="middle" fontSize="10" fontWeight="600" fill="#ffffff">
            Ruptura
          </text>
        </g>

        {/* prateleira 3: latas */}
        <g>
          {[
            [320, '#ffffff'],
            [343, '#ffffff'],
            [366, COR.indigoMedio],
            [389, COR.indigoMedio],
            [412, COR.ambarMedio],
            [435, COR.ambarMedio],
            [458, COR.ambarMedio],
          ].map(([x, cor]) => (
            <rect key={x} x={x} y="352" width="20" height="30" rx="4" fill={cor as string} />
          ))}
          <rect x="320" y="342" width="20" height="10" rx="3" fill="#ffffff" opacity=".7" />
          <rect x="343" y="342" width="20" height="10" rx="3" fill="#ffffff" opacity=".7" />
        </g>
        <rect fill={COR.prateleira} x="312" y="382" width="176" height="8" />
        {/* base */}
        <rect fill={COR.estrutura} x="312" y="450" width="176" height="20" />

        {/* pin de GPS sobre a loja */}
        <ellipse className="pulso" cx="445" cy="92" rx="16" ry="5" fill="none" stroke="#f59e0b" strokeWidth="2" />
        <ellipse cx="445" cy="92" rx="7" ry="2.5" fill={COR.sombra} />
        <path d="M445,90 C445,90 426,66 426,52 a19,19 0 0 1 38,0 C464,66 445,90 445,90 Z" fill="#f59e0b" />
        <circle cx="445" cy="52" r="7" fill="#ffffff" />

        {/* feixe da câmera */}
        <path fill={COR.feixe} d="M296,214 L394,266 L394,304 L296,226 Z" />
        <g stroke="#ffffff" fill="none" strokeWidth="2.5" strokeLinecap="round">
          <path d="M400,266 h-6 v7" />
          <path d="M428,266 h6 v7" />
          <path d="M400,304 h-6 v-7" />
          <path d="M428,304 h6 v-7" />
        </g>

        {/* promotor */}
        <g>
          {/* pernas */}
          <path d="M204,336 L196,456" stroke={COR.calca} strokeWidth="26" strokeLinecap="round" fill="none" />
          <path d="M230,336 L240,456" stroke={COR.calca} strokeWidth="26" strokeLinecap="round" fill="none" />
          <path d="M178,468 q0-14 16-14 h12 q6 0 6 8 v6 z" fill={COR.texto} />
          <path d="M228,468 v-6 q0-8 6-8 h12 q18 0 18 14 z" fill={COR.texto} />
          <rect x="184" y="328" width="66" height="20" rx="6" fill={COR.calca} />
          {/* braço de trás */}
          <path d="M240,226 L264,254" stroke="#d98a06" strokeWidth="18" strokeLinecap="round" fill="none" />
          <path d="M264,254 L286,226" stroke={COR.peleSombra} strokeWidth="13" strokeLinecap="round" fill="none" />
          {/* tronco (camiseta âmbar) */}
          <path d="M182,232 Q184,212 204,208 L230,208 Q250,212 252,232 L250,338 L184,338 Z" fill="#f59e0b" />
          <path d="M206,208 L217,224 L228,208 Z" fill="#ffffff" />
          {/* crachá */}
          <path d="M207,212 L214,262 M227,212 L220,262" stroke="#3730a3" strokeWidth="2" fill="none" />
          <rect x="207" y="260" width="20" height="26" rx="3" fill="#ffffff" />
          <rect x="207" y="260" width="20" height="7" rx="2" fill="#4f46e5" />
          <rect x="211" y="272" width="12" height="2.5" rx="1" fill="#c5c3dc" />
          <rect x="211" y="277" width="8" height="2.5" rx="1" fill="#c5c3dc" />
          {/* pescoço e cabeça */}
          <rect x="209" y="190" width="16" height="22" rx="4" fill={COR.pele} />
          <circle cx="218" cy="170" r="26" fill={COR.pele} />
          <path d="M192,174 Q188,140 220,141 Q248,143 245,166 Q236,157 218,159 Q204,161 200,182 Z" fill={COR.cabelo} />
          <circle cx="203" cy="176" r="5" fill={COR.peleSombra} />
          <circle cx="234" cy="170" r="2.2" fill={COR.cabelo} />
          <path d="M232,184 q5 2 9 -1" stroke="#7a4a2c" strokeWidth="2" strokeLinecap="round" fill="none" />
          {/* boné âmbar */}
          <path d="M193,160 Q196,136 220,136 Q244,137 246,158 Z" fill="#b45309" />
          <path d="M240,154 Q256,152 262,158 L244,160 Z" fill="#b45309" />
          {/* braço da frente */}
          <path d="M192,232 L208,272" stroke="#f59e0b" strokeWidth="18" strokeLinecap="round" fill="none" />
          <path d="M208,272 L280,236" stroke={COR.pele} strokeWidth="13" strokeLinecap="round" fill="none" />
          {/* celular */}
          <rect x="282" y="200" width="16" height="34" rx="4" fill={COR.texto} transform="rotate(8 290 217)" />
          <rect x="284.5" y="203" width="4" height="28" rx="1.5" fill={COR.indigoMedio} transform="rotate(8 290 217)" />
          <circle cx="286" cy="230" r="7.5" fill={COR.pele} />
          <circle cx="289" cy="222" r="6.5" fill={COR.peleSombra} />
        </g>

        {/* card: check-in */}
        <g className="flutuar-a">
          <rect fill={COR.sombra} x="22" y="46" width="232" height="66" rx="12" />
          <rect x="18" y="40" width="232" height="66" rx="12" fill="#ffffff" />
          <circle cx="46" cy="73" r="15" fill="#dcfce7" />
          <path d="M39,73 l5,5 l9,-10" stroke={COR.verde} strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <text fontFamily={fonteSvg} x="70" y="68" fontSize="13.5" fontWeight="600" fill={COR.texto}>
            Check-in confirmado
          </text>
          <text fontFamily={fonteSvg} x="70" y="87" fontSize="12" fill={COR.textoFraco}>
            Mercado Bom Preço · a 42 m
          </text>
          <text x="238" y="68" textAnchor="end" fontSize="11" fill={COR.textoFraco} fontFamily='"IBM Plex Mono", monospace'>
            08:12
          </text>
        </g>

        {/* card: KPI de ruptura */}
        <g className="flutuar-b">
          <rect fill={COR.sombra} x="400" y="402" width="148" height="88" rx="12" />
          <rect x="396" y="396" width="148" height="88" rx="12" fill="#ffffff" />
          <text fontFamily={fonteSvg} x="410" y="418" fontSize="11" fontWeight="500" fill={COR.textoFraco}>
            Ruptura no dia
          </text>
          <text fontFamily={fonteSvg} x="410" y="446" fontSize="24" fontWeight="700" fill={COR.texto}>
            3,8%
          </text>
          <text fontFamily={fonteSvg} x="474" y="446" fontSize="11" fontWeight="600" fill={COR.verde}>
            −1,2 pp
          </text>
          <g fill="#c7c4f6">
            <rect x="410" y="462" width="12" height="12" rx="2" />
            <rect x="426" y="458" width="12" height="16" rx="2" />
            <rect x="442" y="464" width="12" height="10" rx="2" />
            <rect x="458" y="456" width="12" height="18" rx="2" />
            <rect x="474" y="461" width="12" height="13" rx="2" />
            <rect x="490" y="465" width="12" height="9" rx="2" />
          </g>
          <rect x="506" y="467" width="12" height="7" rx="2" fill="#4f46e5" />
        </g>

        {/* chip: registros */}
        <g className="flutuar-a">
          <rect x="50" y="286" width="150" height="30" rx="15" fill="#ffffff" />
          <rect x="64" y="295" width="16" height="12" rx="2.5" fill="none" stroke="#4f46e5" strokeWidth="1.8" />
          <circle cx="72" cy="301" r="3" fill="none" stroke="#4f46e5" strokeWidth="1.6" />
          <text fontFamily={fonteSvg} x="88" y="305" fontSize="12" fontWeight="600" fill={COR.texto}>
            Registro 3 de 5
          </text>
        </g>
      </Box>

      <Box sx={{ position: 'relative', maxWidth: 440, textAlign: 'center' }}>
        <Typography
          component="h2"
          sx={{
            color: '#fff',
            fontSize: { xs: 20, md: 24 },
            lineHeight: 1.25,
            fontWeight: 600,
            mb: 1.25,
            textWrap: 'balance',
            [TELA_BAIXA]: { fontSize: 20, mb: 0.75 },
          }}
        >
          Sua operação de trade em ordem, loja por loja
        </Typography>
        <Typography sx={{ color: 'rgba(255,255,255,.84)', fontSize: 15, lineHeight: 1.55, [TELA_BAIXA]: { fontSize: 14 } }}>
          Registros de gôndola, rupturas, alertas estratégicos e visitas organizados num só lugar para a equipe agir rápido no PDV.
        </Typography>
      </Box>
    </Box>
  );
}

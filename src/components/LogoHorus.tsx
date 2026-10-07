import { horus } from '../theme';

/** Logotipo Horus (Manual da marca) — menu lateral e tela de login. */
export function LogoHorus({ largura }: { largura: number }) {
  return (
    <svg viewBox="-20 18 860 204" role="img" aria-label="Horus" style={{ width: largura, height: 'auto', display: 'block' }}>
      <g fill="#4f46e5">
        <path d="M0,40 H36 V200 H0 Z" />
        <path d="M104,40 H140 V200 H104 Z" />
      </g>
      <path
        fill="#f59e0b"
        d="M0,40 H36 C36,86 50,102 70,102 C112,102 140,132 140,200 H104 C104,154 92,138 70,138 C28,138 0,108 0,40 Z"
      />
      <path
        fill="#f59e0b"
        fillRule="evenodd"
        d="M246,38 A82,82 0 1 1 246,202 A82,82 0 1 1 246,38 Z M246,74 A46,46 0 1 0 246,166 A46,46 0 1 0 246,74 Z"
      />
      {/* "ORUS" acompanha o tema: índigo escuro no claro, lavanda no escuro (docs/65). */}
      <g fill={horus.indigoEscuro} fillRule="evenodd">
        <path transform="translate(352,0)" d="M0,200 V40 H70 A49,49 0 0 1 70,138 H36 V200 Z M36,76 V102 H70 A13,13 0 0 0 70,76 Z" />
        <path transform="translate(352,0)" d="M58,126 H100 L140,200 H98 Z" />
        <path transform="translate(516,0)" d="M0,40 V130 A70,70 0 0 0 140,130 V40 H104 V130 A34,34 0 0 1 36,130 V40 Z" />
        <path
          transform="translate(680,0)"
          d="M140,40 H49 A49,49 0 0 0 49,138 H91 A13,13 0 0 1 91,164 H0 V200 H91 A49,49 0 0 0 91,102 H49 A13,13 0 0 1 49,76 H140 Z"
        />
      </g>
    </svg>
  );
}

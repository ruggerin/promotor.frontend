import { useTheme } from '@mui/material/styles';
import logoClaro from '../assets/marca/logo-claro.svg';
import logoEscuro from '../assets/marca/logo-escuro.svg';
import simbolo from '../assets/marca/simbolo.svg';
import simboloEscuro from '../assets/marca/simbolo-escuro.svg';

/**
 * Logotipo Horus oficial (logos_sistema, 10/10/2026) — menu lateral e tela de login. Tema claro usa
 * a versão "fundo claro" com o RUS no índigo escuro da paleta (#3730a3, o #4f46e5 oficial ficou claro
 * demais no branco); escuro, a "limpa" (RUS creme) com as hastes do H clareadas (o azul-marinho do
 * degradê sumia no fundo escuro). `soSimbolo` mostra só o H — menu recolhido. Vai como <img> (não
 * SVG inline) pra os gradientes de duas logos na mesma página não colidirem pelos ids.
 */
export function LogoHorus({ largura, soSimbolo = false }: { largura: number; soSimbolo?: boolean }) {
  const escuro = useTheme().palette.mode === 'dark';
  const src = soSimbolo ? (escuro ? simboloEscuro : simbolo) : escuro ? logoEscuro : logoClaro;

  return <img src={src} alt="Horus" width={largura} style={{ display: 'block', height: 'auto' }} />;
}

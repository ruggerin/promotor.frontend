import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Fab, Tooltip, Zoom } from '@mui/material';
import { useEffect, useState } from 'react';

/** Distância rolada (px) a partir da qual o botão aparece. */
const LIMIAR = 600;

/**
 * Botão flutuante "voltar ao topo" — aparece depois de rolar a página (ex.: feed de Atividades) e
 * leva de volta ao início. Quem pediu "reduzir movimento" no sistema vai direto, sem animação.
 */
export function VoltarAoTopo() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const aoRolar = () => setVisivel(window.scrollY > LIMIAR);
    aoRolar();
    window.addEventListener('scroll', aoRolar, { passive: true });
    return () => window.removeEventListener('scroll', aoRolar);
  }, []);

  function subir() {
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: reduzir ? 'auto' : 'smooth' });
  }

  return (
    <Zoom in={visivel}>
      <Tooltip title="Voltar ao topo" placement="left">
        <Fab
          color="primary"
          size="medium"
          aria-label="Voltar ao topo"
          onClick={subir}
          sx={{ position: 'fixed', right: { xs: 16, md: 28 }, bottom: { xs: 16, md: 28 }, zIndex: (t) => t.zIndex.speedDial, boxShadow: '0 8px 24px rgba(27, 27, 43, 0.18)' }}
        >
          <KeyboardArrowUpIcon />
        </Fab>
      </Tooltip>
    </Zoom>
  );
}

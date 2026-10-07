import CheckIcon from '@mui/icons-material/Check';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import MailIcon from '@mui/icons-material/MailOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { Box, ButtonBase, IconButton, Popover, Tooltip, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthContext';
import { configSuporte, mailtoLogado } from '../../lib/suporte';
import { horus } from '../../theme';

/**
 * Painel do item "Suporte" do menu: abrir chamado no portal (sempre em ABA NOVA — nunca iframe,
 * nunca troca a tela atual) e e-mail já preenchido com quem é e em que tela estava.
 */
export function PainelSuporte({ ancora, tela, onFechar }: { ancora: HTMLElement | null; tela: string | null; onFechar: () => void }) {
  const { usuario } = useAuth();
  const location = useLocation();
  const { url, email } = configSuporte();
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem permissão de área de transferência — o endereço continua visível pra copiar à mão.
    }
  }

  return (
    <Popover
      open={Boolean(ancora)}
      anchorEl={ancora}
      onClose={onFechar}
      anchorOrigin={{ vertical: 'center', horizontal: 'right' }}
      transformOrigin={{ vertical: 'center', horizontal: 'left' }}
      slotProps={{ paper: { sx: { width: 300, p: 1, ml: 1 } } }}
    >
      <Typography sx={{ px: 1, pt: 0.5, pb: 1, fontSize: 13.5, fontWeight: 600 }}>Precisa de ajuda?</Typography>

      {url && (
        <Opcao
          icone={<OpenInNewIcon />}
          titulo="Abrir chamado"
          subtitulo="Acompanhe o atendimento pelo portal"
          href={url}
          // Aba nova e sem acesso desta janela a partir do portal.
          target="_blank"
          rel="noopener noreferrer"
          onClick={onFechar}
        />
      )}

      {email && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Opcao
            icone={<MailIcon />}
            titulo="Enviar e-mail"
            subtitulo={email}
            href={mailtoLogado(email, { usuario, tela, caminho: location.pathname })}
            onClick={onFechar}
          />
          <Tooltip title={copiado ? 'Copiado' : 'Copiar e-mail'}>
            <IconButton size="small" aria-label="Copiar e-mail do suporte" onClick={() => void copiar()} sx={{ flex: 'none', mr: 0.5 }}>
              {copiado ? <CheckIcon sx={{ fontSize: 16, color: horus.ok }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Popover>
  );
}

function Opcao({
  icone,
  titulo,
  subtitulo,
  href,
  target,
  rel,
  onClick,
}: {
  icone: ReactNode;
  titulo: string;
  subtitulo: string;
  href: string;
  target?: string;
  rel?: string;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      component="a"
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      sx={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 1.25,
        textAlign: 'left',
        p: 1,
        borderRadius: '6px',
        color: 'text.primary',
        '&:hover': { bgcolor: horus.hover },
        '&.Mui-focusVisible': { outline: `2px solid ${horus.indigo}`, outlineOffset: 1 },
      }}
    >
      <Box sx={{ width: 30, height: 30, borderRadius: '6px', bgcolor: horus.indigoClaro, color: horus.indigo, display: 'grid', placeItems: 'center', flex: 'none', '& svg': { fontSize: 16 } }}>
        {icone}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: 13, fontWeight: 500 }}>{titulo}</Typography>
        <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
          {subtitulo}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

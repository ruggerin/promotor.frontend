import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Chip, Dialog, IconButton, Typography, useMediaQuery } from '@mui/material';
import { useEffect } from 'react';
import { ComentariosRegistro } from '../ComentariosRegistro';
import { MdiIcon } from '../MdiIcon';
import { UsuarioAvatar } from '../UsuarioAvatar';
import { AutenticatedImage } from './AutenticatedImage';
import type { FotoComRegistro } from './tipos';

// Galeria (lightbox) — abre a foto clicada em tamanho grande, com setas (e ← → do teclado) pra
// navegar entre as outras fotos do mesmo grupo, e a informação do registro (tipo, vínculo,
// observação, respostas, comentários). Compartilhado entre AtividadesPage e GaleriaFotosPage.
//
// Layout "Facebook": no desktop ocupa a tela inteira sem rolar a página — foto à esquerda (fundo
// preto, a maior parte da largura) e um painel de informação à direita (15% da largura, nunca
// menos que 320px pra o texto não ficar espremido), que rola sozinho se a conversa crescer. No
// celular, tela cheia: foto em cima, informação embaixo.
const LARGURA_PAINEL = 'max(15%, 320px)';

const setaSx = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  color: '#fff',
  zIndex: 1,
  bgcolor: 'rgba(0,0,0,0.35)',
  '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
} as const;

export function GaleriaDialog({
  fotos,
  indice,
  onNavegar,
  onClose,
}: {
  fotos: FotoComRegistro[];
  indice: number;
  onNavegar: (indice: number) => void;
  onClose: () => void;
}) {
  const ehMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const temAnterior = indice > 0;
  const temProxima = indice < fotos.length - 1;

  // ← → navegam entre as fotos (Esc já fecha pelo próprio Dialog). Ignora quando o foco está num
  // campo de texto (comentário), pra não trocar de foto enquanto digita.
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowLeft' && temAnterior) onNavegar(indice - 1);
      if (e.key === 'ArrowRight' && temProxima) onNavegar(indice + 1);
    }
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [indice, temAnterior, temProxima, onNavegar]);

  const foto = fotos[indice];
  if (!foto) return null;
  const registro = foto.registro;

  const vinculo =
    registro.produto_auditoria?.descricao ??
    registro.secao?.descricao ??
    registro.departamento?.descricao ??
    registro.marca?.descricao;
  // Respostas já com rótulo e valor legíveis (FormatadorValoresCampos no backend) — antes eram
  // chips com a chave crua ("dt_validade: 2027-01-17").
  const respostas = (registro.campos_respondidos ?? []).filter((c) => c.tipo_campo !== 'SORTIMENTO' && c.valor);

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={ehMobile}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: ehMobile
            ? { bgcolor: '#000' }
            : { width: 'calc(100vw - 48px)', height: 'calc(100vh - 48px)', maxHeight: 'none', m: 0, overflow: 'hidden', borderRadius: 1.5 },
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, height: '100%', minHeight: 0 }}>
        {/* Foto */}
        <Box
          sx={{
            position: 'relative',
            flex: { md: 1 },
            minWidth: 0,
            height: { xs: '60vh', md: '100%' },
            flexShrink: 0,
            bgcolor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {fotos.length > 1 && (
            <Typography sx={{ position: 'absolute', top: 12, left: 16, color: 'rgba(255,255,255,0.8)', fontSize: 13, zIndex: 1 }}>
              {indice + 1} de {fotos.length}
            </Typography>
          )}
          {ehMobile && (
            <IconButton onClick={onClose} aria-label="Fechar" sx={{ position: 'absolute', top: 4, right: 4, color: '#fff', zIndex: 1 }}>
              <CloseIcon />
            </IconButton>
          )}
          {temAnterior && (
            <IconButton onClick={() => onNavegar(indice - 1)} aria-label="Foto anterior" sx={{ ...setaSx, left: 8 }}>
              <ChevronLeftIcon fontSize="large" />
            </IconButton>
          )}
          <AutenticatedImage
            key={foto.imagem.id}
            url={foto.imagem.url}
            alt={registro.tipo_registro.descricao}
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
          />
          {temProxima && (
            <IconButton onClick={() => onNavegar(indice + 1)} aria-label="Próxima foto" sx={{ ...setaSx, right: 8 }}>
              <ChevronRightIcon fontSize="large" />
            </IconButton>
          )}
        </Box>

        {/* Informação do registro */}
        <Box
          sx={{
            width: { xs: '100%', md: LARGURA_PAINEL },
            flexShrink: 0,
            minHeight: 0,
            flex: { xs: 1, md: 'none' },
            overflowY: 'auto',
            bgcolor: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, pt: 1.5, pb: 1 }}>
            {foto.usuario ? (
              <>
                <UsuarioAvatar nome={foto.usuario.nome} fotoUrl={foto.usuario.foto_url} size={32} />
                <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1, minWidth: 0 }} noWrap>
                  {foto.usuario.nome}
                </Typography>
              </>
            ) : (
              <Box sx={{ flexGrow: 1 }} />
            )}
            {!ehMobile && (
              <IconButton onClick={onClose} aria-label="Fechar" size="small">
                <CloseIcon />
              </IconButton>
            )}
          </Box>

          <Box sx={{ px: 2, pb: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                icon={<MdiIcon icone={registro.tipo_registro.icone ?? 'image'} size={16} sx={{ color: 'inherit' }} />}
                label={registro.tipo_registro.descricao}
                size="small"
              />
              {registro.ruptura && <Chip label="Ruptura" color="error" size="small" />}
            </Box>
            {vinculo && (
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                {vinculo}
              </Typography>
            )}
            {registro.observacao && (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                {registro.observacao}
              </Typography>
            )}
            {respostas.length > 0 && (
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                {respostas.map((c, i) => (
                  <Box key={c.chave} sx={{ px: 1.25, py: 0.75, borderTop: i > 0 ? '1px solid' : 'none', borderColor: 'divider' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                      {c.rotulo}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.valor}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
            <Typography variant="caption" color="text.secondary">
              {new Date(registro.created_at).toLocaleString('pt-BR')}
            </Typography>
            {/* Feedback do registro (docs/28 §3). `key` por registro: navegar pra foto de outro
                registro recomeça o feed fechado. */}
            {registro.visita_id && (
              <ComentariosRegistro
                key={registro.id}
                visitaUuid={registro.visita_id}
                registroUuid={registro.id}
                totalInicial={registro.comentarios_count}
                novosIniciais={registro.comentarios_novos}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Dialog>
  );
}

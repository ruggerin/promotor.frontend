import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Chip, Dialog, IconButton, Typography } from '@mui/material';
import { MdiIcon } from '../MdiIcon';
import { UsuarioAvatar } from '../UsuarioAvatar';
import { AutenticatedImage } from './AutenticatedImage';
import type { FotoComRegistro } from './tipos';

// Galeria (lightbox) — abre a foto clicada em tamanho grande, com seta pra navegar entre as
// outras fotos do mesmo grupo (visita, no Atividades; resultado do filtro, na Galeria de Fotos)
// quando houver mais de uma, e a informação do registro embaixo (tipo, vínculo, observação,
// campos customizados, quando) — mesmo conjunto de campos que RegistroCard mostra em
// VisitaDetailPage.tsx, só reorganizado pro formato de lightbox. Compartilhado entre
// AtividadesPage e GaleriaFotosPage.
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
  const foto = fotos[indice];
  if (!foto) return null;
  const registro = foto.registro;

  const vinculo =
    registro.produto_auditoria?.descricao ??
    registro.secao?.descricao ??
    registro.departamento?.descricao ??
    registro.marca?.descricao;
  const camposPreenchidos = Object.entries(registro.valores_campos ?? {}).filter(([, valor]) => valor !== '' && valor != null);

  return (
    <Dialog open onClose={onClose} maxWidth="lg" fullWidth>
      <Box
        sx={{
          position: 'relative',
          bgcolor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: { xs: 320, sm: 480 },
        }}
      >
        <IconButton onClick={onClose} sx={{ position: 'absolute', top: 4, right: 4, color: '#fff', zIndex: 1 }}>
          <CloseIcon />
        </IconButton>
        {indice > 0 && (
          <IconButton
            onClick={() => onNavegar(indice - 1)}
            sx={{
              position: 'absolute',
              left: 8,
              color: '#fff',
              zIndex: 1,
              bgcolor: 'rgba(0,0,0,0.35)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <ChevronLeftIcon fontSize="large" />
          </IconButton>
        )}
        <AutenticatedImage
          key={foto.imagem.id}
          url={foto.imagem.url}
          alt={registro.tipo_registro.descricao}
          sx={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
        />
        {indice < fotos.length - 1 && (
          <IconButton
            onClick={() => onNavegar(indice + 1)}
            sx={{
              position: 'absolute',
              right: 8,
              color: '#fff',
              zIndex: 1,
              bgcolor: 'rgba(0,0,0,0.35)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.6)' },
            }}
          >
            <ChevronRightIcon fontSize="large" />
          </IconButton>
        )}
      </Box>

      <Box sx={{ p: 2 }}>
        {foto.usuario && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <UsuarioAvatar nome={foto.usuario.nome} fotoUrl={foto.usuario.foto_url} size={28} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {foto.usuario.nome}
            </Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            icon={<MdiIcon icone={registro.tipo_registro.icone ?? 'image'} size={16} sx={{ color: 'inherit' }} />}
            label={registro.tipo_registro.descricao}
            size="small"
          />
          {registro.ruptura && <Chip label="Ruptura" color="error" size="small" />}
        </Box>
        {vinculo && (
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
            {vinculo}
          </Typography>
        )}
        {registro.observacao && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {registro.observacao}
          </Typography>
        )}
        {camposPreenchidos.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
            {camposPreenchidos.map(([chave, valor]) => (
              <Chip key={chave} label={`${chave}: ${valor}`} size="small" variant="outlined" />
            ))}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
          {new Date(registro.created_at).toLocaleString('pt-BR')}
          {fotos.length > 1 && ` · ${indice + 1} de ${fotos.length}`}
        </Typography>
      </Box>
    </Dialog>
  );
}

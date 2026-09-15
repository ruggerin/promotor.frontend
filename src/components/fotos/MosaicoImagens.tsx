import { Box } from '@mui/material';
import { AutenticatedImage } from './AutenticatedImage';
import type { FotoComRegistro } from './tipos';

// Grade de fotos estilo post de rede social: 1 foto ocupa a largura toda, 2+ vira grade 2
// colunas, e a partir da 5ª um "+N" cobre a última miniatura visível em vez de esticar a grade.
// Compartilhado entre AtividadesPage e GaleriaFotosPage.
export function MosaicoImagens({
  fotos,
  onAbrir,
  maxWidth,
}: {
  fotos: FotoComRegistro[];
  onAbrir: (indice: number) => void;
  // GaleriaFotosPage usa isso dentro de um card de grade (ocupa a largura do card inteiro);
  // AtividadesPage usa o default (contido, tipo anexo de post). Ver cada chamada.
  maxWidth?: number | string;
}) {
  const MAX_VISIVEIS = 4;
  const visiveis = fotos.slice(0, MAX_VISIVEIS);
  const restante = fotos.length - visiveis.length;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: visiveis.length === 1 ? '1fr' : 'repeat(2, 1fr)',
        gap: 0.5,
        maxWidth: maxWidth ?? (visiveis.length === 1 ? 140 : 220),
      }}
    >
      {visiveis.map((foto, indice) => (
        <Box
          key={foto.imagem.id}
          sx={{ position: 'relative', cursor: 'pointer', borderRadius: 1, overflow: 'hidden' }}
          onClick={() => onAbrir(indice)}
        >
          <AutenticatedImage
            url={foto.imagem.url}
            alt={foto.registro.tipo_registro.descricao}
            sx={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block' }}
          />
          {indice === MAX_VISIVEIS - 1 && restante > 0 && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                bgcolor: 'rgba(0,0,0,0.55)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              +{restante}
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

import { Box, Skeleton, type SxProps, type Theme } from '@mui/material';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api/client';

/**
 * A rota de imagem exige Authorization: Bearer — uma <img src> comum não manda esse header,
 * então baixa via Axios (que já injeta o token pelo interceptor) e vira uma blob URL. Mesma
 * técnica de RegistroImagem (VisitaDetailPage.tsx) e UsuarioAvatar, generalizada aqui pra
 * qualquer mosaico/galeria de foto (AtividadesPage, GaleriaFotosPage).
 */
export function AutenticatedImage({
  url,
  alt,
  sx,
  onClick,
}: {
  url: string;
  alt: string;
  sx?: SxProps<Theme>;
  onClick?: () => void;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    setBlobUrl(null);
    let objectUrl: string | null = null;
    let cancelado = false;

    apiClient
      .get<Blob>(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        // Falha silenciosa — o card segue mostrando o resto normalmente.
      });

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!blobUrl) {
    return <Skeleton variant="rectangular" sx={sx} />;
  }

  return <Box component="img" src={blobUrl} alt={alt} onClick={onClick} sx={sx} />;
}

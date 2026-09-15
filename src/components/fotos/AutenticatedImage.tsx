import { Box, Skeleton, type SxProps, type Theme } from '@mui/material';
import { useEffect, useState } from 'react';
import { apiClient } from '../../lib/api/client';
import { buscarBlobComCache, obterDoCache } from './blobCache';

/**
 * A rota de imagem exige Authorization: Bearer — uma <img src> comum não manda esse header,
 * então baixa via Axios (que já injeta o token pelo interceptor) e vira uma blob URL. Mesma
 * técnica de RegistroImagem (VisitaDetailPage.tsx) e UsuarioAvatar, generalizada aqui pra
 * qualquer mosaico/galeria de foto (AtividadesPage, GaleriaFotosPage).
 *
 * A blob URL vem de um cache compartilhado (ver blobCache.ts), não é baixada/descartada a cada
 * montagem — sem isso, o `VirtuosoGrid` da Galeria de Fotos desmonta o card que sai da área
 * virtualizada e, ao rolar de volta, teria que rebaixar a mesma foto do zero (piscando o
 * esqueleto cinza de novo, mesmo numa foto já vista há 2 segundos). O cache tem teto (LRU) —
 * não é "guardar tudo pra sempre", só um limite bem maior que "zero" (comportamento anterior).
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
  const [blobUrl, setBlobUrl] = useState<string | null>(() => obterDoCache(url) ?? null);

  useEffect(() => {
    const cacheado = obterDoCache(url);
    if (cacheado) {
      setBlobUrl(cacheado);
      return;
    }

    setBlobUrl(null);
    let cancelado = false;

    // buscarBlobComCache deduplica: se outro componente (StrictMode remontando em dev, ou o
    // VirtuosoGrid montando o mesmo item em mais de uma passada de medição) já pediu esta
    // mesma URL e ainda não voltou, este aqui só espera a MESMA requisição em vez de disparar
    // uma segunda pro mesmo arquivo.
    buscarBlobComCache(url, () => apiClient.get<Blob>(url, { responseType: 'blob' }).then((r) => r.data))
      .then((objectUrl) => {
        if (!cancelado) setBlobUrl(objectUrl);
      })
      .catch(() => {
        // Falha silenciosa — o card segue mostrando o resto normalmente.
      });

    // Sem revokeObjectURL aqui de propósito — a blob URL agora pertence ao cache (ver
    // blobCache.ts), não a este componente; ele só descarta quando o cache estoura o teto (LRU).
    return () => {
      cancelado = true;
    };
  }, [url]);

  if (!blobUrl) {
    return <Skeleton variant="rectangular" sx={sx} />;
  }

  return <Box component="img" src={blobUrl} alt={alt} onClick={onClick} sx={sx} />;
}

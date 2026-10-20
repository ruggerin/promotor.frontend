import { Avatar, type SxProps, type Theme } from '@mui/material';
import { useEffect, useState } from 'react';
import { avatarEmCache, carregarAvatar } from '../lib/avatarCache';

/**
 * Foto de perfil do usuário (`Usuario.foto_url`) — self-service, hoje enviada só pelo app
 * mobile (ver docs/05-APP-MOBILE-UX.md), mas qualquer autenticado da mesma empresa pode ver a
 * de qualquer colega (`GET /api/usuarios/{uuid}/foto`). A rota exige `Authorization: Bearer`,
 * que um `<img src>` comum não manda — baixa via Axios (token já injetado pelo interceptor) e
 * vira uma blob URL, guardada em lib/avatarCache.ts (memória + Cache Storage). Sem foto (ou
 * enquanto carrega), cai pras iniciais do nome — nunca um ícone genérico, ajuda a identificar
 * o usuário na lista mesmo sem foto cadastrada.
 */
export function UsuarioAvatar({
  nome,
  fotoUrl,
  size = 32,
  cor,
}: {
  nome: string;
  fotoUrl?: string | null;
  size?: number;
  /** Cor fixa da pessoa (Painel de Atividades, docs/43) — com ela, as iniciais viram 2 letras. */
  cor?: { bg: string; fg: string };
}) {
  // Começa com a foto do cache (sem pisca ao remontar); só busca se ainda não tiver.
  const [blobUrl, setBlobUrl] = useState<string | null>(() => avatarEmCache(fotoUrl) ?? null);

  useEffect(() => {
    if (!fotoUrl) {
      setBlobUrl(null);
      return;
    }
    const pronta = avatarEmCache(fotoUrl);
    if (pronta) {
      setBlobUrl(pronta);
      return;
    }
    let cancelado = false;
    // A blob URL é do cache (lib/avatarCache.ts), compartilhada — não revoga ao desmontar.
    void carregarAvatar(fotoUrl).then((url) => {
      if (!cancelado) setBlobUrl(url);
    });
    return () => {
      cancelado = true;
    };
  }, [fotoUrl]);

  const sx: SxProps<Theme> = cor
    ? { width: size, height: size, fontSize: size * 0.36, fontWeight: 700, bgcolor: cor.bg, color: cor.fg }
    : { width: size, height: size, fontSize: size * 0.42 };

  const partes = nome.trim().split(/\s+/).filter(Boolean);
  const iniciais = cor && partes.length > 1
    ? `${partes[0].charAt(0)}${partes[partes.length - 1].charAt(0)}`
    : cor
      ? nome.trim().slice(0, 2)
      : nome.trim().charAt(0);

  return (
    <Avatar src={blobUrl ?? undefined} sx={sx}>
      {iniciais.toUpperCase() || '?'}
    </Avatar>
  );
}

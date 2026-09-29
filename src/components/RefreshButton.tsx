import RefreshIcon from '@mui/icons-material/Refresh';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

// Botão "Atualizar" das telas de listagem — docs/46-BOTAO-ATUALIZAR-LISTAS.md. Recarrega TODAS
// as consultas ativas da tela (lista, contadores, combos de filtro) sem F5, mantendo filtro,
// página e scroll. Genérico de propósito: nenhuma tela precisa ligar a própria query nele, e em
// telas com abas (Catálogo) só a aba aberta tem consulta ativa, então só ela recarrega.
//
// Gira só durante a recarga que o usuário pediu — não com o polling de fundo (badge do menu etc.),
// que useIsFetching() contaria.
export function RefreshButton() {
  const queryClient = useQueryClient();
  const [atualizando, setAtualizando] = useState(false);

  async function atualizar() {
    setAtualizando(true);
    try {
      await queryClient.refetchQueries({ type: 'active' });
    } finally {
      setAtualizando(false);
    }
  }

  return (
    <Tooltip title="Atualizar">
      <span>
        <IconButton size="small" onClick={() => void atualizar()} disabled={atualizando} aria-label="Atualizar">
          <RefreshIcon
            fontSize="small"
            sx={
              atualizando
                ? { animation: 'girar-atualizar 0.9s linear infinite', '@keyframes girar-atualizar': { to: { transform: 'rotate(360deg)' } } }
                : undefined
            }
          />
        </IconButton>
      </span>
    </Tooltip>
  );
}

// Título da página + botão Atualizar — o conteúdo padrão do header das telas de listagem.
export function TituloComAtualizar({ titulo }: { titulo: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        {titulo}
      </Typography>
      <RefreshButton />
    </Box>
  );
}

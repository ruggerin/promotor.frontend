import CheckBoxOutlinedIcon from '@mui/icons-material/CheckBoxOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Button, Paper, Slide, Tooltip, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export interface AcaoEmMassa {
  rotulo: string;
  icone: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

interface BarraAcoesEmMassaProps {
  quantidade: number;
  acoes: AcaoEmMassa[];
  onLimpar: () => void;
}

/**
 * Barra flutuante que aparece no rodapé quando há linhas marcadas no checkbox de uma listagem —
 * concentra as ações em massa (atribuir, alterar campo etc.) num lugar só, em vez de um botão solto
 * no meio dos filtros. Some sozinha quando a seleção zera.
 */
export function BarraAcoesEmMassa({ quantidade, acoes, onLimpar }: BarraAcoesEmMassaProps) {
  return (
    <Slide direction="up" in={quantidade > 0} mountOnEnter unmountOnExit>
      <Box
        sx={{
          position: 'fixed',
          bottom: 24,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.snackbar,
          display: 'flex',
          justifyContent: 'center',
          px: 2,
          pointerEvents: 'none',
        }}
      >
      <Paper
        elevation={8}
        sx={{
          pointerEvents: 'auto',
          bgcolor: 'grey.900',
          color: 'common.white',
          borderRadius: 2,
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
          <CheckBoxOutlinedIcon fontSize="small" />
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            {quantidade} selecionado(s)
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {acoes.map((acao) => (
            <Button
              key={acao.rotulo}
              size="small"
              variant="outlined"
              startIcon={acao.icone}
              disabled={acao.disabled}
              onClick={acao.onClick}
              sx={{
                color: 'common.white',
                borderColor: 'grey.600',
                textTransform: 'none',
                '&:hover': { borderColor: 'common.white', bgcolor: 'rgba(255,255,255,0.08)' },
              }}
            >
              {acao.rotulo}
            </Button>
          ))}
          <Tooltip title="Limpar seleção">
            <Button
              size="small"
              variant="outlined"
              onClick={onLimpar}
              sx={{ minWidth: 0, px: 1, color: 'grey.400', borderColor: 'grey.700', '&:hover': { borderColor: 'grey.400' } }}
            >
              <CloseIcon fontSize="small" />
            </Button>
          </Tooltip>
        </Box>
      </Paper>
      </Box>
    </Slide>
  );
}

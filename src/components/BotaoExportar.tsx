import DownloadIcon from '@mui/icons-material/Download';
import { Alert, Button, CircularProgress, ListItemText, Menu, MenuItem, Snackbar } from '@mui/material';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { exportar, type FormatoExportacao, type PedidoExportacao } from '../lib/api/exportacoes';
import { baixarBlob } from '../lib/csv';

interface Props {
  /** Chave da rotina no servidor (`registros`, `visitas`, `lojas`, `ordens-servico`, `tempo-na-loja`). */
  rotina: string;
  filtros?: PedidoExportacao['filtros'];
  descricaoFiltros?: string;
  disabled?: boolean;
}

const FORMATOS: { valor: FormatoExportacao; rotulo: string; ajuda: string }[] = [
  { valor: 'xlsx', rotulo: 'Excel (.xlsx)', ajuda: 'Com tipos, filtros aplicados e quem gerou' },
  { valor: 'csv', rotulo: 'CSV (.csv)', ajuda: 'Só os dados, pra importar em outro sistema' },
];

/**
 * Botão único de exportação (docs/68): o mesmo em todas as telas. O arquivo vem do servidor, da
 * mesma consulta e dos mesmos filtros da tela — nunca só da página que está visível.
 */
export function BotaoExportar({ rotina, filtros, descricaoFiltros, disabled }: Props) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const mutacao = useMutation({
    mutationFn: (formato: FormatoExportacao) => exportar({ rotina, formato, filtros, descricaoFiltros }),
    onSuccess: (arquivo) => {
      baixarBlob(arquivo.nome, arquivo.blob);
      setAviso({ tipo: 'success', texto: `${arquivo.linhas.toLocaleString('pt-BR')} linhas exportadas.` });
    },
    onError: (erro: Error) => setAviso({ tipo: 'error', texto: erro.message }),
  });

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        startIcon={mutacao.isPending ? <CircularProgress size={16} /> : <DownloadIcon />}
        disabled={disabled || mutacao.isPending}
        onClick={(e) => setAncora(e.currentTarget)}
        aria-haspopup="menu"
        sx={{ textTransform: 'none' }}
      >
        {mutacao.isPending ? 'Gerando…' : 'Exportar'}
      </Button>
      <Menu anchorEl={ancora} open={Boolean(ancora)} onClose={() => setAncora(null)}>
        {FORMATOS.map((f) => (
          <MenuItem
            key={f.valor}
            onClick={() => {
              setAncora(null);
              mutacao.mutate(f.valor);
            }}
          >
            <ListItemText primary={f.rotulo} secondary={f.ajuda} />
          </MenuItem>
        ))}
      </Menu>
      <Snackbar open={aviso !== null} autoHideDuration={aviso?.tipo === 'error' ? 8000 : 3500} onClose={() => setAviso(null)}>
        {aviso ? (
          <Alert severity={aviso.tipo} onClose={() => setAviso(null)} sx={{ maxWidth: 480 }}>
            {aviso.texto}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
}

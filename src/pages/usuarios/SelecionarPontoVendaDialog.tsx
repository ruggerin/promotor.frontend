import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import type { PontoVenda } from '../../types/api';

interface FiltrosBusca {
  razao_social: string;
  fantasia: string;
  cnpj: string;
  busca: string;
}

const FILTROS_VAZIOS: FiltrosBusca = { razao_social: '', fantasia: '', cnpj: '', busca: '' };

interface SelecionarPontoVendaDialogProps {
  open: boolean;
  lojasJaVinculadasIds: Set<string>;
  onClose: () => void;
  onSelecionar: (pdv: PontoVenda) => void;
}

// Busca avançada por campo separado (razão social/fantasia/CNPJ/cidade-bairro), pra achar a
// loja certa quando a busca única por texto (Autocomplete simples) não é precisa o bastante —
// ex.: duas filiais com nome parecido em cidades diferentes, ou já sabe o CNPJ de cabeça.
// Ver docs/03-ADMIN-WEB.md#6-usuários.
export function SelecionarPontoVendaDialog({
  open,
  lojasJaVinculadasIds,
  onClose,
  onSelecionar,
}: SelecionarPontoVendaDialogProps) {
  const [campos, setCampos] = useState<FiltrosBusca>(FILTROS_VAZIOS);
  const [filtrosAplicados, setFiltrosAplicados] = useState<FiltrosBusca | null>(null);

  const resultadoQuery = useQuery({
    queryKey: ['pontos-venda', 'busca-avancada', filtrosAplicados],
    queryFn: () =>
      listarPontosVenda({
        ativo: true,
        razao_social: filtrosAplicados?.razao_social || undefined,
        fantasia: filtrosAplicados?.fantasia || undefined,
        cnpj: filtrosAplicados?.cnpj || undefined,
        busca: filtrosAplicados?.busca || undefined,
      }),
    enabled: filtrosAplicados !== null,
  });

  function buscar() {
    setFiltrosAplicados(campos);
  }

  function fechar() {
    setCampos(FILTROS_VAZIOS);
    setFiltrosAplicados(null);
    onClose();
  }

  const resultados = (resultadoQuery.data?.pontos_venda ?? []).filter((pdv) => !lojasJaVinculadasIds.has(pdv.id));
  const nenhumFiltroPreenchido = !campos.razao_social && !campos.fantasia && !campos.cnpj && !campos.busca;

  return (
    <Dialog open={open} onClose={fechar} maxWidth="md" fullWidth>
      <DialogTitle>Busca avançada de ponto de venda</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1, mb: 2 }}>
          <TextField
            label="Razão social"
            size="small"
            sx={{ minWidth: 200, flexGrow: 1 }}
            value={campos.razao_social}
            onChange={(e) => setCampos({ ...campos, razao_social: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <TextField
            label="Fantasia"
            size="small"
            sx={{ minWidth: 200, flexGrow: 1 }}
            value={campos.fantasia}
            onChange={(e) => setCampos({ ...campos, fantasia: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <TextField
            label="CNPJ"
            size="small"
            sx={{ minWidth: 180, flexGrow: 1 }}
            value={campos.cnpj}
            onChange={(e) => setCampos({ ...campos, cnpj: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <TextField
            label="Cidade ou bairro"
            size="small"
            sx={{ minWidth: 180, flexGrow: 1 }}
            value={campos.busca}
            onChange={(e) => setCampos({ ...campos, busca: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && buscar()}
          />
          <Button variant="contained" startIcon={<SearchIcon />} onClick={buscar} disabled={nenhumFiltroPreenchido}>
            Buscar
          </Button>
        </Box>

        {filtrosAplicados === null ? (
          <Typography variant="body2" color="text.secondary">
            Preencha ao menos um filtro e clique em "Buscar".
          </Typography>
        ) : resultadoQuery.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : resultados.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma loja encontrada com esses filtros (lojas já vinculadas a este promotor não
            aparecem aqui).
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fantasia</TableCell>
                  <TableCell>Razão social</TableCell>
                  <TableCell>CNPJ</TableCell>
                  <TableCell>Cidade</TableCell>
                  <TableCell>Bairro</TableCell>
                  <TableCell align="right">Ação</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resultados.map((pdv) => (
                  <TableRow key={pdv.id} hover>
                    <TableCell>{pdv.fantasia}</TableCell>
                    <TableCell>{pdv.razao_social}</TableCell>
                    <TableCell>{pdv.cnpj ?? '—'}</TableCell>
                    <TableCell>{pdv.cidade}</TableCell>
                    <TableCell>{pdv.bairro ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Chip
                        label="Selecionar"
                        size="small"
                        color="primary"
                        onClick={() => {
                          onSelecionar(pdv);
                          fechar();
                        }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={fechar}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

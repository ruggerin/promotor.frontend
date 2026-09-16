import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { listarDirecionamentos } from '../../lib/api/direcionamentos';
import type { Direcionamento } from '../../types/api';
import { DirecionamentoFormDialog } from './DirecionamentoFormDialog';

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

// Molde que gera Ordem de Serviço em massa — ver docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md.
export function DirecionamentosListPage() {
  const navigate = useNavigate();
  const [dialogAberto, setDialogAberto] = useState(false);

  const query = useQuery({
    queryKey: ['direcionamentos'],
    queryFn: () => listarDirecionamentos(),
  });
  const direcionamentos = query.data?.direcionamentos ?? [];

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Direcionamentos
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogAberto(true)}>
          Novo direcionamento
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Gera Ordem de Serviço em massa — uma por PDV elegível — pra um formulário que promotores
        de lojas/redes específicas (ou todos) precisam responder dentro de um período. Ver
        "Ordens de Serviço" pra acompanhar cada uma individualmente.
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell>Vigência</TableCell>
              <TableCell>Formulários</TableCell>
              <TableCell>Ordens geradas</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {direcionamentos.length === 0 && !query.isLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  Nenhum direcionamento cadastrado.
                </TableCell>
              </TableRow>
            )}
            {direcionamentos.map((d: Direcionamento) => (
              <TableRow key={d.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/direcionamentos/${d.id}`)}>
                <TableCell>{d.descricao}</TableCell>
                <TableCell>
                  {formatarData(d.vigencia_inicio)} – {formatarData(d.vigencia_fim)}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {(d.formularios ?? []).map((f) => (
                      <Chip key={f.tipo_registro.id} label={f.tipo_registro.descricao} size="small" />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>{d.ordens_servico_count ?? '—'}</TableCell>
                <TableCell>
                  <Chip label={d.ativo ? 'Ativo' : 'Cancelado'} color={d.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <DirecionamentoFormDialog open={dialogAberto} direcionamento={null} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

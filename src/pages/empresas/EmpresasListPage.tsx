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
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import type { PlanoEmpresa } from '../../types/api';
import { EmpresaFormDialog } from './EmpresaFormDialog';

const PLANO_LABELS: Record<PlanoEmpresa, string> = {
  GRATUITO: 'Gratuito',
  START: 'Start',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

const PLANO_COLORS: Record<PlanoEmpresa, 'default' | 'primary' | 'secondary' | 'success'> = {
  GRATUITO: 'default',
  START: 'primary',
  PRO: 'secondary',
  BUSINESS: 'success',
};

// Ações (editar dados, bloquear/reativar) ficam todas na página de detalhe
// (EmpresaDetailPage) — a lista é só uma tabela pra escanear e clicar, ver
// docs/03-ADMIN-WEB.md#8-empresas-empresas-só-superadmin.
export function EmpresasListPage() {
  const navigate = useNavigate();
  const [dialogAberto, setDialogAberto] = useState(false);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Empresas
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogAberto(true)}>
          Nova empresa
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Nome fantasia</TableCell>
              <TableCell>Razão social</TableCell>
              <TableCell>CNPJ</TableCell>
              <TableCell>Plano</TableCell>
              <TableCell align="right">Limite usuários</TableCell>
              <TableCell align="right">Limite PDVs</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {empresasQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {empresasQuery.isError && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {empresasQuery.data?.empresas.length === 0 && !empresasQuery.isError && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Nenhuma empresa encontrada.
                </TableCell>
              </TableRow>
            )}
            {empresasQuery.data?.empresas.map((empresa) => (
              <TableRow
                key={empresa.id}
                hover
                tabIndex={0}
                role="button"
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/empresas/${empresa.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/empresas/${empresa.id}`);
                  }
                }}
              >
                <TableCell>{empresa.nome_fantasia}</TableCell>
                <TableCell>{empresa.razao_social}</TableCell>
                <TableCell>{empresa.cnpj}</TableCell>
                <TableCell>
                  <Chip label={PLANO_LABELS[empresa.plano]} color={PLANO_COLORS[empresa.plano]} size="small" />
                </TableCell>
                <TableCell align="right">{empresa.limite_usuarios ?? 'Sem limite'}</TableCell>
                <TableCell align="right">{empresa.limite_pontos_venda ?? 'Sem limite'}</TableCell>
                <TableCell>
                  <Chip
                    label={empresa.ativo ? 'Ativa' : 'Bloqueada'}
                    color={empresa.ativo ? 'success' : 'error'}
                    size="small"
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <EmpresaFormDialog open={dialogAberto} empresa={null} onClose={() => setDialogAberto(false)} />
    </Box>
  );
}

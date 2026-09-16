import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { atualizarPlanograma, desativarPlanograma, listarPlanogramas } from '../../lib/api/planogramas';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Planograma } from '../../types/api';
import { PlanogramaFormDialog } from './PlanogramaFormDialog';

// Referência visual de layout de prateleira/expositor — ver docs/22-PLANOGRAMA.md. Lista igual
// ao resto do catálogo (ParametrosListPage/TiposRegistroListPage): SUPERADMIN só lê, com filtro
// de empresa pra suporte.
export function PlanogramasListPage() {
  const { usuario } = useAuth();
  const isSuperadmin = usuario?.user_type === 'SUPERADMIN';
  const [empresaUuid, setEmpresaUuid] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Planograma | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: isSuperadmin,
  });

  const query = useQuery({
    queryKey: ['planogramas', { empresaUuid }],
    queryFn: () => listarPlanogramas({ empresa_uuid: empresaUuid ?? undefined }),
  });

  const totalColunas = isSuperadmin ? 4 : 3;

  const reativarMutation = useMutation({
    mutationFn: (p: Planograma) => atualizarPlanograma(p.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['planogramas'] });
    },
    onError: () => setErro('Não foi possível reativar o planograma.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (p: Planograma) => desativarPlanograma(p.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['planogramas'] });
    },
    onError: () => setErro('Não foi possível desativar o planograma.'),
  });

  function alternarStatus(p: Planograma) {
    if (p.ativo) {
      if (window.confirm(`Desativar "${p.descricao}"? Ele deixa de aparecer como referência disponível.`)) {
        desativarMutation.mutate(p);
      }
      return;
    }
    reativarMutation.mutate(p);
  }

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Planogramas
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        {!isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Novo planograma
          </Button>
        )}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Referência visual de como um espaço (gôndola, expositor...) deveria ficar organizado,
        andar por andar — material de apoio pro promotor em campo. Ver docs/22-PLANOGRAMA.md.
      </Typography>

      {isSuperadmin && (
        <Autocomplete
          size="small"
          sx={{ width: 280, mb: 2 }}
          options={empresasQuery.data?.empresas ?? []}
          getOptionLabel={(option) => option.nome_fantasia}
          loading={empresasQuery.isLoading}
          onChange={(_, value) => setEmpresaUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Empresa" placeholder="Todas as empresas" />}
        />
      )}

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {isSuperadmin && <TableCell>Empresa</TableCell>}
              <TableCell>Descrição</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.data?.planogramas.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum planograma cadastrado.
                </TableCell>
              </TableRow>
            )}
            {query.data?.planogramas.map((p) => (
              <TableRow key={p.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/planogramas/${p.id}`)}>
                {isSuperadmin && <TableCell>{p.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{p.descricao}</TableCell>
                <TableCell>
                  <Chip label={p.ativo ? 'Ativo' : 'Inativo'} color={p.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  {isSuperadmin ? (
                    '—'
                  ) : (
                    <>
                      <Tooltip title="Editar descrição">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEmEdicao(p);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={p.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(p)}>
                          {p.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {!isSuperadmin && (
        <PlanogramaFormDialog open={dialogAberto} planograma={emEdicao} onClose={() => setDialogAberto(false)} />
      )}
    </Box>
  );
}

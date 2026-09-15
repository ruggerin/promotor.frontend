import AddIcon from '@mui/icons-material/Add';
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
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { atualizarRamoAtividade, desativarRamoAtividade, listarRamosAtividade } from '../../lib/api/ramosAtividade';
import { useAuth } from '../../lib/auth/AuthContext';
import type { RamoAtividade } from '../../types/api';
import { RamoAtividadeFormDialog } from './RamoAtividadeFormDialog';

/**
 * Classificação de PontoVenda (selects no cadastro da loja) — item próprio no menu lateral, não
 * uma aba dentro de Catálogo (que é reservado pro catálogo de auditoria: departamento/seção/
 * marca/produto/nível de exibição). Pedido explícito do usuário.
 */
export function RamosAtividadeListPage() {
  const { usuario } = useAuth();
  const isSuperadmin = usuario?.user_type === 'SUPERADMIN';
  const [empresaUuid, setEmpresaUuid] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<RamoAtividade | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: isSuperadmin,
  });

  const query = useQuery({
    queryKey: ['ramos-atividade', { empresaUuid }],
    queryFn: () => listarRamosAtividade({ empresa_uuid: empresaUuid ?? undefined }),
  });

  const totalColunas = isSuperadmin ? 4 : 3;

  const reativarMutation = useMutation({
    mutationFn: (r: RamoAtividade) => atualizarRamoAtividade(r.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['ramos-atividade'] });
    },
    onError: () => setErro('Não foi possível reativar o ramo de atividade.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (r: RamoAtividade) => desativarRamoAtividade(r.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['ramos-atividade'] });
    },
    onError: () => setErro('Não foi possível desativar o ramo de atividade.'),
  });

  function alternarStatus(r: RamoAtividade) {
    if (r.ativo) {
      if (window.confirm(`Desativar ${r.descricao}?`)) {
        desativarMutation.mutate(r);
      }
      return;
    }
    reativarMutation.mutate(r);
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Ramos de Atividade
        </Typography>
        {!isSuperadmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEmEdicao(null);
              setDialogAberto(true);
            }}
          >
            Novo ramo de atividade
          </Button>
        )}
      </Box>

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
            {query.data?.ramos_atividade.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum ramo de atividade cadastrado.
                </TableCell>
              </TableRow>
            )}
            {query.data?.ramos_atividade.map((r) => (
              <TableRow key={r.id} hover>
                {isSuperadmin && <TableCell>{r.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{r.descricao}</TableCell>
                <TableCell>
                  <Chip label={r.ativo ? 'Ativo' : 'Inativo'} color={r.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  {isSuperadmin ? (
                    '—'
                  ) : (
                    <>
                      <Tooltip title="Editar">
                        <IconButton
                          size="small"
                          onClick={() => {
                            setEmEdicao(r);
                            setDialogAberto(true);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={r.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(r)}>
                          {r.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
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
        <RamoAtividadeFormDialog open={dialogAberto} ramoAtividade={emEdicao} onClose={() => setDialogAberto(false)} />
      )}
    </Box>
  );
}

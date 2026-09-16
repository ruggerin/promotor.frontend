import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { atualizarContrato, desativarContrato, listarContratos } from '../../lib/api/contratos';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Contrato, TipoContrato } from '../../types/api';

const TIPO_LABELS: Record<TipoContrato, string> = {
  COMODATO: 'Comodato',
  PONTO_EXTRA: 'Ponto extra',
};

// "Vencido" não é um status gravado — é ativo=true + vigencia_fim no passado, calculado aqui
// na exibição, mesmo espírito de Fatura ("Atrasada"), ver docs/03-ADMIN-WEB.md.
function statusExibicao(contrato: Contrato): { label: string; color: 'success' | 'error' | 'default' } {
  if (!contrato.ativo) return { label: 'Inativo', color: 'default' };
  const hoje = new Date().toISOString().slice(0, 10);
  if (contrato.vigencia_fim.slice(0, 10) < hoje) return { label: 'Vencido', color: 'error' };
  return { label: 'Vigente', color: 'success' };
}

function formatarData(iso: string): string {
  return iso.slice(0, 10).split('-').reverse().join('/');
}

/**
 * Só a listagem — cadastro, edição, anexo, metas e histórico vivem todos juntos em
 * ContratoDetailPage (clique na linha ou "Novo contrato"), ver docs/03-ADMIN-WEB.md#6-contratos.
 * Aqui fica só o que realmente é "de lista": busca/filtro e a ação rápida de ativar/desativar.
 */
export function ContratosListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario: usuarioLogado } = useAuth();
  const isSuperadmin = usuarioLogado?.user_type === 'SUPERADMIN';

  const [page, setPage] = useState(0);
  const [filtroTipo, setFiltroTipo] = useState<TipoContrato | 'todos'>('todos');
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [filtroEmpresaUuid, setFiltroEmpresaUuid] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: isSuperadmin,
  });

  const contratosQuery = useQuery({
    queryKey: ['contratos', { page, filtroTipo, filtroAtivo, filtroEmpresaUuid }],
    queryFn: () =>
      listarContratos({
        page: page + 1,
        tipo: filtroTipo === 'todos' ? undefined : filtroTipo,
        ativo: filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos',
        empresa_uuid: filtroEmpresaUuid ?? undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const reativarMutation = useMutation({
    mutationFn: (contrato: Contrato) => atualizarContrato(contrato.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: () => setErro('Não foi possível reativar o contrato.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (contrato: Contrato) => desativarContrato(contrato.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: () => setErro('Não foi possível desativar o contrato.'),
  });

  function alternarStatus(contrato: Contrato) {
    if (contrato.ativo) {
      if (window.confirm(`Desativar o contrato de ${TIPO_LABELS[contrato.tipo].toLowerCase()} de ${contrato.ponto_venda?.fantasia}?`)) {
        desativarMutation.mutate(contrato);
      }
      return;
    }

    reativarMutation.mutate(contrato);
  }

  const contratos = contratosQuery.data?.contratos ?? [];
  const perPage = contratosQuery.data?.meta.per_page ?? 15;
  const totalColunas = isSuperadmin ? 7 : 6;

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Contratos
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/contratos/novo')}>
          Novo contrato
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        {isSuperadmin && (
          <Autocomplete
            size="small"
            sx={{ width: 240 }}
            options={empresasQuery.data?.empresas ?? []}
            getOptionLabel={(option) => option.nome_fantasia}
            loading={empresasQuery.isLoading}
            onChange={(_, value) => {
              setPage(0);
              setFiltroEmpresaUuid(value?.id ?? null);
            }}
            renderInput={(params) => <TextField {...params} label="Empresa" />}
          />
        )}
        <TextField
          select
          label="Tipo"
          size="small"
          sx={{ width: 200 }}
          value={filtroTipo}
          onChange={(e) => {
            setPage(0);
            setFiltroTipo(e.target.value as TipoContrato | 'todos');
          }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="COMODATO">Comodato</MenuItem>
          <MenuItem value="PONTO_EXTRA">Ponto extra</MenuItem>
        </TextField>
        <TextField
          select
          label="Status"
          size="small"
          sx={{ width: 160 }}
          value={filtroAtivo}
          onChange={(e) => {
            setPage(0);
            setFiltroAtivo(e.target.value as 'todos' | 'ativos' | 'inativos');
          }}
        >
          <MenuItem value="ativos">Ativos</MenuItem>
          <MenuItem value="inativos">Inativos</MenuItem>
          <MenuItem value="todos">Todos</MenuItem>
        </TextField>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {isSuperadmin && <TableCell>Empresa</TableCell>}
              <TableCell>Ponto de venda</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Vigência</TableCell>
              <TableCell>Arquivo</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {contratosQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {contratosQuery.isError && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {contratos.length === 0 && !contratosQuery.isLoading && !contratosQuery.isError && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum contrato encontrado.
                </TableCell>
              </TableRow>
            )}
            {contratos.map((contrato) => {
              const status = statusExibicao(contrato);
              return (
                <TableRow key={contrato.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/contratos/${contrato.id}`)}>
                  {isSuperadmin && <TableCell>{contrato.empresa?.nome_fantasia ?? '—'}</TableCell>}
                  <TableCell>{contrato.ponto_venda?.fantasia ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={TIPO_LABELS[contrato.tipo]} size="small" />
                  </TableCell>
                  <TableCell>
                    {formatarData(contrato.vigencia_inicio)} – {formatarData(contrato.vigencia_fim)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {contrato.arquivo_url ? (
                      <Tooltip title="Ver arquivo">
                        <IconButton size="small" component="a" href={contrato.arquivo_url} target="_blank" rel="noopener noreferrer">
                          <DescriptionIcon fontSize="small" color="primary" />
                        </IconButton>
                      </Tooltip>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Sem arquivo
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip label={status.label} color={status.color} size="small" />
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    {/* DELETE (desativar direto pela lista) continua fora do alcance do
                        SUPERADMIN — ver App\Http\Middleware\EnsurePermissao. Pra desativar um
                        contrato de outra empresa, ele entra no contrato e desmarca "Ativo". */}
                    {!isSuperadmin && (
                      <Tooltip title={contrato.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(contrato)}>
                          {contrato.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={contratosQuery.data?.meta.total ?? 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={perPage}
          rowsPerPageOptions={[perPage]}
          onRowsPerPageChange={() => {
            // A API não aceita per_page customizado ainda — mesmo padrão do resto do admin.
          }}
        />
      </TableContainer>
    </Box>
  );
}

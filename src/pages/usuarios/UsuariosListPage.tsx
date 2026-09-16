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
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { atualizarUsuario, desativarUsuario, listarUsuarios } from '../../lib/api/usuarios';
import { useAuth } from '../../lib/auth/AuthContext';
import type { UserType, Usuario } from '../../types/api';
import { UsuarioFormDialog } from './UsuarioFormDialog';

const USER_TYPE_LABELS: Record<UserType, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  GESTOR: 'Gestor',
  PROMOTOR: 'Promotor',
};

const USER_TYPE_COLORS: Record<UserType, 'default' | 'primary' | 'secondary' | 'info'> = {
  SUPERADMIN: 'secondary',
  ADMIN: 'primary',
  GESTOR: 'info',
  PROMOTOR: 'default',
};

function DispositivoCelula({ usuario }: { usuario: Usuario }) {
  if (usuario.user_type !== 'PROMOTOR') {
    return <Typography variant="body2" color="text.secondary">—</Typography>;
  }

  if (!usuario.dispositivo) {
    return <Typography variant="body2" color="text.secondary">Nunca logou</Typography>;
  }

  return (
    <Box>
      <Typography variant="body2">{usuario.dispositivo.nome ?? usuario.dispositivo.identificador}</Typography>
      <Typography variant="caption" color="text.secondary">
        último acesso {new Date(usuario.dispositivo.ultimo_acesso_em).toLocaleString('pt-BR')}
      </Typography>
    </Box>
  );
}

export function UsuariosListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario: usuarioLogado } = useAuth();
  // SUPERADMIN não pertence a empresa nenhuma — a API deixa ele ver, criar e editar usuários de
  // qualquer empresa (ferramenta de suporte), mas nunca desativar direto pela lista (DELETE
  // continua bloqueado pra ele) — só o ícone de editar aparece, com o filtro + coluna de
  // empresa pra não virar uma lista de nomes sem contexto nenhum (ver docs/02-API-BACKEND.md e
  // App\Http\Middleware\EnsurePermissao).
  const isSuperadmin = usuarioLogado?.user_type === 'SUPERADMIN';

  // MUI TablePagination é 0-indexed, a API é 1-indexed — mesma conversão da tela de Visitas.
  const [page, setPage] = useState(0);
  const [filtroAtivo, setFiltroAtivo] = useState<'todos' | 'ativos' | 'inativos'>('ativos');
  const [filtroUserType, setFiltroUserType] = useState<UserType | 'todos'>('todos');
  const [filtroEmpresaUuid, setFiltroEmpresaUuid] = useState<string | null>(null);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [usuarioEmEdicao, setUsuarioEmEdicao] = useState<Usuario | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: isSuperadmin,
  });

  const usuariosQuery = useQuery({
    queryKey: ['usuarios', { page, filtroAtivo, filtroUserType, filtroEmpresaUuid }],
    queryFn: () =>
      listarUsuarios({
        page: page + 1,
        ativo: filtroAtivo === 'todos' ? undefined : filtroAtivo === 'ativos',
        user_type: filtroUserType === 'todos' ? undefined : filtroUserType,
        empresa_uuid: filtroEmpresaUuid ?? undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const alternarAtivoMutation = useMutation({
    mutationFn: (usuario: Usuario) => atualizarUsuario(usuario.id, { ativo: !usuario.ativo }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível alterar o status do usuário.';
      setErro(mensagem);
    },
  });

  const desativarMutation = useMutation({
    mutationFn: (usuario: Usuario) => desativarUsuario(usuario.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível desativar o usuário.';
      setErro(mensagem);
    },
  });

  function alternarStatus(usuario: Usuario) {
    if (usuario.ativo) {
      if (window.confirm(`Desativar ${usuario.nome}? O acesso dele é revogado imediatamente.`)) {
        desativarMutation.mutate(usuario);
      }
      return;
    }

    alternarAtivoMutation.mutate(usuario);
  }

  const perPage = usuariosQuery.data?.meta.per_page ?? 15;
  // SUPERADMIN ganha a coluna Empresa a mais (Ações ele também tem, só com menos ícones).
  const totalColunas = isSuperadmin ? 9 : 8;

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Usuários
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mb: 2 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setUsuarioEmEdicao(null);
            setDialogAberto(true);
          }}
        >
          Novo usuário
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
          value={filtroUserType}
          onChange={(e) => {
            setPage(0);
            setFiltroUserType(e.target.value as UserType | 'todos');
          }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          <MenuItem value="ADMIN">Admin</MenuItem>
          <MenuItem value="GESTOR">Gestor</MenuItem>
          <MenuItem value="PROMOTOR">Promotor</MenuItem>
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
              <TableCell padding="checkbox" />
              {isSuperadmin && <TableCell>Empresa</TableCell>}
              <TableCell>Nome</TableCell>
              <TableCell>E-mail</TableCell>
              <TableCell>Tipo</TableCell>
              <TableCell>Perfil</TableCell>
              <TableCell>Dispositivo</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {usuariosQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {usuariosQuery.isError && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {usuariosQuery.data?.usuarios.length === 0 && !usuariosQuery.isError && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
            {usuariosQuery.data?.usuarios.map((usuario) => (
              <TableRow
                key={usuario.id}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/usuarios/${usuario.id}`)}
              >
                <TableCell padding="checkbox">
                  <UsuarioAvatar nome={usuario.nome} fotoUrl={usuario.foto_url} />
                </TableCell>
                {isSuperadmin && <TableCell>{usuario.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{usuario.nome}</TableCell>
                <TableCell>{usuario.email}</TableCell>
                <TableCell>
                  <Chip
                    label={USER_TYPE_LABELS[usuario.user_type]}
                    color={USER_TYPE_COLORS[usuario.user_type]}
                    size="small"
                  />
                </TableCell>
                <TableCell>{usuario.perfil?.nome ?? '—'}</TableCell>
                <TableCell>
                  <DispositivoCelula usuario={usuario} />
                </TableCell>
                <TableCell>
                  <Chip
                    label={usuario.ativo ? 'Ativo' : 'Inativo'}
                    color={usuario.ativo ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                  <Tooltip title="Editar">
                    <span>
                      <IconButton
                        size="small"
                        disabled={usuario.user_type === 'SUPERADMIN'}
                        onClick={() => {
                          setUsuarioEmEdicao(usuario);
                          setDialogAberto(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                  {/* DELETE (bloquear/reativar direto pela lista) continua fora do alcance do
                      SUPERADMIN — ver App\Http\Middleware\EnsurePermissao. Pra desativar um
                      usuário de outra empresa, ele edita e desmarca o switch "Ativo". */}
                  {!isSuperadmin && (
                    <Tooltip title={usuario.ativo ? 'Desativar' : 'Reativar'}>
                      <span>
                        <IconButton
                          size="small"
                          disabled={usuario.user_type === 'SUPERADMIN'}
                          onClick={() => alternarStatus(usuario)}
                        >
                          {usuario.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                        </IconButton>
                      </span>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={usuariosQuery.data?.meta.total ?? 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={perPage}
          rowsPerPageOptions={[perPage]}
          onRowsPerPageChange={() => {
            // A API não aceita per_page customizado ainda — só existe pra satisfazer o
            // componente controlado do MUI.
          }}
        />
      </TableContainer>

      {/* SUPERADMIN só abre em modo criação — o botão de editar (que preenche
          usuarioEmEdicao) fica escondido pra ele, ver coluna Ações abaixo. */}
      <UsuarioFormDialog
        open={dialogAberto}
        usuario={usuarioEmEdicao}
        onClose={() => setDialogAberto(false)}
      />
    </Box>
  );
}

import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { DataTable } from '../../components/DataTable';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import {
  atualizarSupervisor,
  atualizarVendedor,
  listarSupervisores,
  listarVendedores,
  type ContatoEquipe,
} from '../../lib/api/equipeComercial';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { PessoaVinculada, Supervisor, Vendedor } from '../../types/api';

type Aba = 'vendedores' | 'supervisores';
type Status = '' | 'ativos' | 'inativos';

// Vendedores e supervisores espelhados do ERP (docs/73 Fase 1). Tela de CONFERÊNCIA: o cadastro
// chega pela Importação de dados ou pelo integrador; aqui só se ajusta contato e o vínculo com o
// usuário do Horus. Código, nome e hierarquia são do ERP, por isso não editam.
export function EquipeComercialPage() {
  const [aba, setAba] = useState<Aba>('vendedores');
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Vendedores e supervisores" />);

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Tabs value={aba} onChange={(_, v: Aba) => setAba(v)}>
          <Tab value="vendedores" label="Vendedores" />
          <Tab value="supervisores" label="Supervisores" />
        </Tabs>
        <Button component={RouterLink} to="/importacao-dados" variant="outlined" startIcon={<UploadFileIcon />}>
          Importar planilha
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
        Cadastro vindo do ERP. Vendedores e supervisores não precisam ter login no Horus; quando têm, vincule o usuário para
        os relatórios ligarem as duas coisas.
      </Typography>
      {aba === 'vendedores' ? <ListaVendedores /> : <ListaSupervisores />}
    </Box>
  );
}

function useBuscaComAtraso(valor: string): string {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setAtrasado(valor), 300);
    return () => clearTimeout(id);
  }, [valor]);
  return atrasado;
}

const ativoDoStatus = (s: Status) => (s === '' ? undefined : s === 'ativos');

function FiltroStatus({ valor, onChange }: { valor: Status; onChange: (s: Status) => void }) {
  return (
    <TextField select size="small" label="Situação" sx={{ width: 160 }} value={valor} onChange={(e) => onChange(e.target.value as Status)}>
      <MenuItem value="">Todos</MenuItem>
      <MenuItem value="ativos">Ativos</MenuItem>
      <MenuItem value="inativos">Inativos</MenuItem>
    </TextField>
  );
}

const colunaContato = <T extends { telefone: string | null; email: string | null }>(): ColumnDef<T, unknown> => ({
  id: 'contato',
  header: 'Contato',
  cell: ({ row }) =>
    row.original.telefone || row.original.email ? (
      <Box>
        {row.original.telefone && <Typography variant="body2">{row.original.telefone}</Typography>}
        {row.original.email && (
          <Typography variant="caption" color="text.secondary">
            {row.original.email}
          </Typography>
        )}
      </Box>
    ) : (
      <Typography variant="body2" color="text.disabled">
        Sem contato
      </Typography>
    ),
});

const colunaUsuario = <T extends { usuario: PessoaVinculada | null }>(): ColumnDef<T, unknown> => ({
  id: 'usuario',
  header: 'Usuário no Horus',
  cell: ({ row }) => row.original.usuario?.nome ?? <Typography variant="body2" color="text.disabled">—</Typography>,
});

const colunaSituacao = <T extends { ativo: boolean }>(): ColumnDef<T, unknown> => ({
  id: 'ativo',
  header: 'Situação',
  cell: ({ row }) => <Chip size="small" label={row.original.ativo ? 'Ativo' : 'Inativo'} color={row.original.ativo ? 'success' : 'default'} variant="outlined" />,
});

function ListaVendedores() {
  const [page, setPage] = useState(0);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<Status>('ativos');
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [semSupervisor, setSemSupervisor] = useState(false);
  const [emEdicao, setEmEdicao] = useState<Vendedor | null>(null);
  const buscaAtrasada = useBuscaComAtraso(busca);

  const supervisoresQuery = useQuery({
    queryKey: ['supervisores', 'opcoes'],
    queryFn: () => listarSupervisores({ ativo: true }),
  });

  const query = useQuery({
    queryKey: ['vendedores', { page, buscaAtrasada, status, supervisor: supervisor?.id, semSupervisor }],
    queryFn: () =>
      listarVendedores({
        page: page + 1,
        busca: buscaAtrasada.trim(),
        ativo: ativoDoStatus(status),
        supervisor_uuid: supervisor?.id,
        sem_supervisor: semSupervisor,
      }),
    placeholderData: keepPreviousData,
  });

  const colunas: ColumnDef<Vendedor, unknown>[] = [
    { id: 'codigo', header: 'Código', accessorKey: 'codigo_externo' },
    { id: 'nome', header: 'Nome', accessorKey: 'nome' },
    {
      id: 'supervisor',
      header: 'Supervisor',
      cell: ({ row }) =>
        row.original.supervisor ? (
          `${row.original.supervisor.nome} (${row.original.supervisor.codigo_externo})`
        ) : row.original.codigo_supervisor ? (
          <Chip size="small" color="warning" variant="outlined" label={`Código ${row.original.codigo_supervisor} não cadastrado`} />
        ) : (
          <Typography variant="body2" color="text.disabled">
            Sem supervisor
          </Typography>
        ),
    },
    { id: 'lojas', header: 'Lojas', accessorKey: 'lojas_count', meta: { align: 'right' } },
    colunaContato<Vendedor>(),
    colunaUsuario<Vendedor>(),
    colunaSituacao<Vendedor>(),
  ];

  const mudar = <V,>(set: (v: V) => void) => (v: V) => {
    setPage(0);
    set(v);
  };

  return (
    <>
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small"
          label="Buscar por código ou nome"
          sx={{ width: 260 }}
          value={busca}
          onChange={(e) => mudar(setBusca)(e.target.value)}
        />
        <Autocomplete
          size="small"
          sx={{ width: 260 }}
          options={supervisoresQuery.data?.supervisores ?? []}
          getOptionLabel={(s) => `${s.nome} (${s.codigo_externo})`}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          loading={supervisoresQuery.isLoading}
          value={supervisor}
          disabled={semSupervisor}
          onChange={(_, v) => mudar(setSupervisor)(v)}
          renderInput={(params) => <TextField {...params} label="Supervisor" />}
        />
        <FiltroStatus valor={status} onChange={mudar(setStatus)} />
        <FormControlLabel
          control={
            <Switch
              checked={semSupervisor}
              onChange={(e) => {
                setSupervisor(null);
                mudar(setSemSupervisor)(e.target.checked);
              }}
            />
          }
          label="Só sem supervisor"
        />
      </Paper>

      <DataTable
        columns={colunas}
        data={query.data?.vendedores ?? []}
        getRowId={(v) => v.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        isPlaceholderData={query.isPlaceholderData}
        isError={query.isError}
        errorMessage="Não foi possível carregar os vendedores."
        emptyMessage={
          busca || supervisor || semSupervisor || status !== 'ativos'
            ? 'Nenhum vendedor com esses filtros.'
            : 'Nenhum vendedor cadastrado ainda. Importe a planilha do ERP ou configure o integrador.'
        }
        onRowClick={setEmEdicao}
        page={page}
        onPageChange={setPage}
        rowsPerPage={query.data?.meta.per_page ?? 50}
        totalRows={query.data?.meta.total ?? 0}
      />

      {emEdicao && (
        <EditarContatoDialog
          titulo={`Vendedor ${emEdicao.codigo_externo} · ${emEdicao.nome}`}
          pessoa={emEdicao}
          salvar={(dados) => atualizarVendedor(emEdicao.id, dados)}
          invalidar="vendedores"
          onFechar={() => setEmEdicao(null)}
        />
      )}
    </>
  );
}

function ListaSupervisores() {
  const [page, setPage] = useState(0);
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<Status>('ativos');
  const [emEdicao, setEmEdicao] = useState<Supervisor | null>(null);
  const buscaAtrasada = useBuscaComAtraso(busca);

  const query = useQuery({
    queryKey: ['supervisores', { page, buscaAtrasada, status }],
    queryFn: () => listarSupervisores({ page: page + 1, busca: buscaAtrasada.trim(), ativo: ativoDoStatus(status) }),
    placeholderData: keepPreviousData,
  });

  const colunas: ColumnDef<Supervisor, unknown>[] = [
    { id: 'codigo', header: 'Código', accessorKey: 'codigo_externo' },
    { id: 'nome', header: 'Nome', accessorKey: 'nome' },
    { id: 'vendedores', header: 'Vendedores ativos', accessorKey: 'vendedores_count', meta: { align: 'right' } },
    colunaContato<Supervisor>(),
    colunaUsuario<Supervisor>(),
    colunaSituacao<Supervisor>(),
  ];

  return (
    <>
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Buscar por código ou nome"
          sx={{ width: 260 }}
          value={busca}
          onChange={(e) => {
            setPage(0);
            setBusca(e.target.value);
          }}
        />
        <FiltroStatus
          valor={status}
          onChange={(s) => {
            setPage(0);
            setStatus(s);
          }}
        />
      </Paper>

      <DataTable
        columns={colunas}
        data={query.data?.supervisores ?? []}
        getRowId={(s) => s.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        isPlaceholderData={query.isPlaceholderData}
        isError={query.isError}
        errorMessage="Não foi possível carregar os supervisores."
        emptyMessage={
          busca || status !== 'ativos'
            ? 'Nenhum supervisor com esses filtros.'
            : 'Nenhum supervisor cadastrado ainda. Importe a planilha do ERP ou configure o integrador.'
        }
        onRowClick={setEmEdicao}
        page={page}
        onPageChange={setPage}
        rowsPerPage={query.data?.meta.per_page ?? 50}
        totalRows={query.data?.meta.total ?? 0}
      />

      {emEdicao && (
        <EditarContatoDialog
          titulo={`Supervisor ${emEdicao.codigo_externo} · ${emEdicao.nome}`}
          pessoa={emEdicao}
          salvar={(dados) => atualizarSupervisor(emEdicao.id, dados)}
          invalidar="supervisores"
          onFechar={() => setEmEdicao(null)}
        />
      )}
    </>
  );
}

function EditarContatoDialog({
  titulo,
  pessoa,
  salvar,
  invalidar,
  onFechar,
}: {
  titulo: string;
  pessoa: { telefone: string | null; email: string | null; usuario: PessoaVinculada | null };
  salvar: (dados: ContatoEquipe) => Promise<unknown>;
  invalidar: 'vendedores' | 'supervisores';
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [telefone, setTelefone] = useState(pessoa.telefone ?? '');
  const [email, setEmail] = useState(pessoa.email ?? '');
  const [usuario, setUsuario] = useState<PessoaVinculada | null>(pessoa.usuario);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const buscaUsuarioAtrasada = useBuscaComAtraso(buscaUsuario);

  const usuariosQuery = useQuery({
    queryKey: ['usuarios', 'vinculo-equipe', buscaUsuarioAtrasada],
    queryFn: () => listarUsuarios({ busca: buscaUsuarioAtrasada, ativo: true, por_pagina: 20 }),
  });
  const opcoes: PessoaVinculada[] = (usuariosQuery.data?.usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome }));

  const mutation = useMutation({
    mutationFn: () => salvar({ telefone: telefone.trim() || null, email: email.trim() || null, usuario_uuid: usuario?.id ?? null }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [invalidar] });
      onFechar();
    },
  });
  const erro = mutation.error
    ? axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(mutation.error)
      ? (Object.values(mutation.error.response?.data.errors ?? {})[0]?.[0] ?? mutation.error.response?.data.message ?? 'Não foi possível salvar.')
      : 'Não foi possível salvar.'
    : null;

  return (
    <Dialog open onClose={onFechar} fullWidth maxWidth="sm">
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Código, nome e supervisor vêm do ERP e são atualizados pela importação. Aqui você ajusta o contato e o vínculo com
          o login.
        </Typography>
        {erro && <Alert severity="error">{erro}</Alert>}
        <TextField id="equipe-telefone" label="Telefone" size="small" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        <TextField id="equipe-email" label="E-mail" size="small" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Autocomplete
          id="equipe-usuario"
          size="small"
          options={usuario && !opcoes.some((o) => o.id === usuario.id) ? [usuario, ...opcoes] : opcoes}
          getOptionLabel={(o) => o.nome}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={(x) => x}
          loading={usuariosQuery.isFetching}
          value={usuario}
          onChange={(_, v) => setUsuario(v)}
          onInputChange={(_, v, motivo) => motivo === 'input' && setBuscaUsuario(v)}
          renderInput={(params) => (
            <TextField {...params} label="Usuário no Horus (opcional)" helperText="Só quando a pessoa também tem login no Horus." />
          )}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="contained" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

import AddIcon from '@mui/icons-material/Add';
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
  criarSupervisor,
  criarVendedor,
  excluirSupervisor,
  excluirVendedor,
  listarSupervisores,
  listarVendedores,
  type DadosVendedor,
} from '../../lib/api/equipeComercial';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { PessoaVinculada, Supervisor, Vendedor } from '../../types/api';

type Aba = 'vendedores' | 'supervisores';
type Status = '' | 'ativos' | 'inativos';

// Vendedores e supervisores espelhados do ERP (docs/73). O cadastro chega pela Importação de dados
// ou pelo integrador, e também pode ser feito aqui na mão (§11.2) — a próxima carga do ERP
// sobrescreve o que vier preenchido nela.
export function EquipeComercialPage() {
  const [aba, setAba] = useState<Aba>('vendedores');
  const [criando, setCriando] = useState(false);
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Vendedores e supervisores" />);
  const fecharCriacao = () => setCriando(false);

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 2 }}>
        <Tabs value={aba} onChange={(_, v: Aba) => setAba(v)}>
          <Tab value="vendedores" label="Vendedores" />
          <Tab value="supervisores" label="Supervisores" />
        </Tabs>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button component={RouterLink} to="/importacao-dados" variant="outlined" startIcon={<UploadFileIcon />}>
            Importar planilha
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCriando(true)}>
            {aba === 'vendedores' ? 'Novo vendedor' : 'Novo supervisor'}
          </Button>
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
        Cadastro vindo do ERP. Vendedores e supervisores não precisam ter login no Horus; quando têm, vincule o usuário para
        os relatórios ligarem as duas coisas.
      </Typography>
      {aba === 'vendedores' ? (
        <ListaVendedores criando={criando} onFecharCriacao={fecharCriacao} />
      ) : (
        <ListaSupervisores criando={criando} onFecharCriacao={fecharCriacao} />
      )}
    </Box>
  );
}

interface PropsLista {
  criando: boolean;
  onFecharCriacao: () => void;
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

function ListaVendedores({ criando, onFecharCriacao }: PropsLista) {
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
            : 'Nenhum vendedor cadastrado ainda. Cadastre aqui, importe a planilha do ERP ou configure o integrador.'
        }
        onRowClick={setEmEdicao}
        page={page}
        onPageChange={setPage}
        rowsPerPage={query.data?.meta.per_page ?? 50}
        totalRows={query.data?.meta.total ?? 0}
      />

      {(emEdicao || criando) && (
        <PessoaFormDialog
          tipo="vendedor"
          pessoa={emEdicao}
          supervisores={supervisoresQuery.data?.supervisores ?? []}
          onFechar={() => {
            setEmEdicao(null);
            onFecharCriacao();
          }}
        />
      )}
    </>
  );
}

function ListaSupervisores({ criando, onFecharCriacao }: PropsLista) {
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
            : 'Nenhum supervisor cadastrado ainda. Cadastre aqui, importe a planilha do ERP ou configure o integrador.'
        }
        onRowClick={setEmEdicao}
        page={page}
        onPageChange={setPage}
        rowsPerPage={query.data?.meta.per_page ?? 50}
        totalRows={query.data?.meta.total ?? 0}
      />

      {(emEdicao || criando) && (
        <PessoaFormDialog
          tipo="supervisor"
          pessoa={emEdicao}
          onFechar={() => {
            setEmEdicao(null);
            onFecharCriacao();
          }}
        />
      )}
    </>
  );
}

type Pessoa = Vendedor | Supervisor;

const ehVendedor = (p: Pessoa): p is Vendedor => 'codigo_supervisor' in p;

const mensagemDeErro = (erro: unknown, padrao: string) =>
  axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(erro)
    ? (Object.values(erro.response?.data.errors ?? {})[0]?.[0] ?? erro.response?.data.message ?? padrao)
    : padrao;

// Criar (pessoa null) e editar no mesmo formulário; excluir fica dentro da edição.
function PessoaFormDialog({
  tipo,
  pessoa,
  supervisores = [],
  onFechar,
}: {
  tipo: 'vendedor' | 'supervisor';
  pessoa: Pessoa | null;
  /** Só pro vendedor: opções do campo Supervisor (os ativos). */
  supervisores?: Supervisor[];
  onFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const vendedor = pessoa && ehVendedor(pessoa) ? pessoa : null;
  const [codigo, setCodigo] = useState(pessoa?.codigo_externo ?? '');
  const [nome, setNome] = useState(pessoa?.nome ?? '');
  const [telefone, setTelefone] = useState(pessoa?.telefone ?? '');
  const [email, setEmail] = useState(pessoa?.email ?? '');
  const [ativo, setAtivo] = useState(pessoa?.ativo ?? true);
  const [usuario, setUsuario] = useState<PessoaVinculada | null>(pessoa?.usuario ?? null);
  const [supervisor, setSupervisor] = useState<PessoaVinculada | null>(vendedor?.supervisor ?? null);
  // Só manda o supervisor se mudou: um vendedor com código de supervisor que ainda não casou não
  // pode perder esse código só porque o telefone foi editado.
  const [supervisorAlterado, setSupervisorAlterado] = useState(false);
  const [tentouSalvar, setTentouSalvar] = useState(false);
  const [buscaUsuario, setBuscaUsuario] = useState('');
  const buscaUsuarioAtrasada = useBuscaComAtraso(buscaUsuario);

  const usuariosQuery = useQuery({
    queryKey: ['usuarios', 'vinculo-equipe', buscaUsuarioAtrasada],
    queryFn: () => listarUsuarios({ busca: buscaUsuarioAtrasada, ativo: true, por_pagina: 20 }),
  });
  const opcoesUsuario: PessoaVinculada[] = (usuariosQuery.data?.usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome }));
  const opcoesSupervisor: PessoaVinculada[] = supervisores.map((s) => ({ id: s.id, nome: `${s.nome} (${s.codigo_externo})` }));

  const invalidar = () => {
    void queryClient.invalidateQueries({ queryKey: ['vendedores'] });
    void queryClient.invalidateQueries({ queryKey: ['supervisores'] });
  };

  const salvar = useMutation({
    mutationFn: (): Promise<Pessoa> => {
      const dados: DadosVendedor = {
        codigo_externo: codigo.trim(),
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        email: email.trim() || null,
        ativo,
        usuario_uuid: usuario?.id ?? null,
      };
      if (tipo === 'supervisor') {
        return pessoa ? atualizarSupervisor(pessoa.id, dados) : criarSupervisor(dados);
      }
      if (!pessoa || supervisorAlterado) {
        dados.supervisor_uuid = supervisor?.id ?? null;
      }
      return pessoa ? atualizarVendedor(pessoa.id, dados) : criarVendedor(dados);
    },
    onSuccess: () => {
      invalidar();
      onFechar();
    },
  });

  const excluir = useMutation({
    mutationFn: (id: string) => (tipo === 'vendedor' ? excluirVendedor(id) : excluirSupervisor(id)),
    onSuccess: () => {
      invalidar();
      onFechar();
    },
  });

  const confirmarExclusao = () => {
    if (!pessoa) return;
    const consequencia = vendedor
      ? vendedor.lojas_count
        ? ` Ele sai da carteira de ${vendedor.lojas_count} loja(s).`
        : ''
      : ' Os vendedores dele ficam sem supervisor.';
    const texto =
      `Excluir ${pessoa.nome} (${pessoa.codigo_externo})?${consequencia}\n\n` +
      'Se a pessoa só saiu da empresa, prefira desmarcar "Ativo". Se ela ainda estiver no ERP, a próxima importação cria o cadastro de novo.';
    if (window.confirm(texto)) excluir.mutate(pessoa.id);
  };

  const faltaCodigo = tentouSalvar && !codigo.trim();
  const faltaNome = tentouSalvar && !nome.trim();
  const erro = salvar.error
    ? mensagemDeErro(salvar.error, 'Não foi possível salvar.')
    : excluir.error
      ? mensagemDeErro(excluir.error, 'Não foi possível excluir.')
      : null;
  const ocupado = salvar.isPending || excluir.isPending;

  return (
    <Dialog open onClose={onFechar} fullWidth maxWidth="sm">
      <DialogTitle>{pessoa ? `Editar ${tipo} · ${pessoa.nome}` : `Novo ${tipo}`}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <Typography variant="body2" color="text.secondary">
          Use o mesmo código do ERP. Se o cadastro também vier da importação ou do integrador, a próxima carga sobrescreve o que
          vier preenchido nela.
        </Typography>
        {erro && <Alert severity="error">{erro}</Alert>}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            id="equipe-codigo"
            label="Código no ERP"
            size="small"
            required
            sx={{ width: 180, flexShrink: 0 }}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            error={faltaCodigo}
            helperText={faltaCodigo ? 'Obrigatório' : undefined}
          />
          <TextField
            id="equipe-nome"
            label="Nome"
            size="small"
            required
            fullWidth
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            error={faltaNome}
            helperText={faltaNome ? 'Obrigatório' : undefined}
          />
        </Box>
        {tipo === 'vendedor' && (
          <Autocomplete
            id="equipe-supervisor"
            size="small"
            options={supervisor && !opcoesSupervisor.some((o) => o.id === supervisor.id) ? [supervisor, ...opcoesSupervisor] : opcoesSupervisor}
            getOptionLabel={(o) => opcoesSupervisor.find((s) => s.id === o.id)?.nome ?? o.nome}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={supervisor}
            onChange={(_, v) => {
              setSupervisor(v);
              setSupervisorAlterado(true);
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Supervisor (opcional)"
                helperText={
                  !supervisorAlterado && !vendedor?.supervisor && vendedor?.codigo_supervisor
                    ? `O ERP aponta o supervisor ${vendedor.codigo_supervisor}, que ainda não está cadastrado.`
                    : undefined
                }
              />
            )}
          />
        )}
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField id="equipe-telefone" label="Telefone" size="small" fullWidth value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <TextField id="equipe-email" label="E-mail" size="small" type="email" fullWidth value={email} onChange={(e) => setEmail(e.target.value)} />
        </Box>
        <Autocomplete
          id="equipe-usuario"
          size="small"
          options={usuario && !opcoesUsuario.some((o) => o.id === usuario.id) ? [usuario, ...opcoesUsuario] : opcoesUsuario}
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
        <FormControlLabel control={<Switch checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />} label="Ativo" />
      </DialogContent>
      <DialogActions>
        {pessoa && (
          <Button color="error" onClick={confirmarExclusao} disabled={ocupado} sx={{ mr: 'auto' }}>
            Excluir
          </Button>
        )}
        <Button onClick={onFechar}>Cancelar</Button>
        <Button
          variant="contained"
          onClick={() => {
            setTentouSalvar(true);
            if (codigo.trim() && nome.trim()) salvar.mutate();
          }}
          disabled={ocupado}
        >
          {pessoa ? 'Salvar' : 'Cadastrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

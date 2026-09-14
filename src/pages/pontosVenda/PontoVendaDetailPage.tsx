import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClearIcon from '@mui/icons-material/Clear';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
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
import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listarAgendasVisita } from '../../lib/api/agendasVisita';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { listarMarcas } from '../../lib/api/marcas';
import {
  adicionarPromotorPontoVenda,
  atualizarPontoVenda,
  buscarPontoVenda,
  desativarPontoVenda,
  removerPromotorPontoVenda,
} from '../../lib/api/pontosVenda';
import { listarProdutos } from '../../lib/api/produtos';
import { listarSecoes } from '../../lib/api/secoes';
import { listarVisitas } from '../../lib/api/visitas';
import {
  adicionarSortimentoItem,
  aprovarSortimentoItem,
  rejeitarSortimentoItem,
  removerSortimentoItem,
} from '../../lib/api/sortimentoPontoVenda';
import { entidadeDoItem, TIPO_ITEM_LABELS } from '../../lib/tipoItemCampanha';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { AgendaVisita, PontoVenda, StatusVisita, TipoItemCampanha } from '../../types/api';
import { AgendaVisitaFormDialog } from '../agendasVisita/AgendaVisitaFormDialog';
import { PontoVendaFormDialog } from './PontoVendaFormDialog';

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const STATUS_VISITA_LABELS: Record<StatusVisita, string> = {
  ABERTA: 'Aberta',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const STATUS_VISITA_COLORS: Record<StatusVisita, 'warning' | 'success' | 'default'> = {
  ABERTA: 'warning',
  FINALIZADA: 'success',
  CANCELADA: 'default',
};

function quandoExibicao(agenda: AgendaVisita): string {
  if (agenda.recorrencia === 'SEMANAL') {
    return `Toda ${DIAS_SEMANA[agenda.dia_semana ?? 0]}`;
  }
  return agenda.data ? new Date(`${agenda.data}T00:00:00`).toLocaleDateString('pt-BR') : '—';
}

// Página de detalhe — substitui o antigo fluxo "editar em modal" só pra este PDV (criação
// continua em modal, mesmo padrão adotado em Empresas, ver EmpresaDetailPage.tsx). Reúne dados
// cadastrais + gestão dos promotores vinculados (antes só dava pra fazer isso em lote, na
// listagem — aqui dá pra ver e ajustar a carteira de uma loja específica).
export function PontoVendaDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogAberto, setDialogAberto] = useState(false);
  const [promotorParaAdicionar, setPromotorParaAdicionar] = useState<{ id: string; nome: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [dialogAgendaAberto, setDialogAgendaAberto] = useState(false);
  const [agendaEmEdicao, setAgendaEmEdicao] = useState<AgendaVisita | null>(null);
  const [tipoItemSortimento, setTipoItemSortimento] = useState<TipoItemCampanha>('PRODUTO');
  const [entidadeSortimentoUuid, setEntidadeSortimentoUuid] = useState<string | null>(null);
  const [erroSortimento, setErroSortimento] = useState<string | null>(null);
  const [paginaVisitas, setPaginaVisitas] = useState(0);

  const pdvQuery = useQuery({
    queryKey: ['pontos-venda', publicId],
    queryFn: () => buscarPontoVenda(publicId as string),
    enabled: Boolean(publicId),
  });

  // Visão só de leitura rápida — quem quer editar/desativar em massa vai pra tela dedicada
  // (/agendas-visita). Ver docs/10-AGENDA-VISITA.md.
  const agendasVisitaQuery = useQuery({
    queryKey: ['agendas-visita', { ponto_venda_uuid: publicId }],
    queryFn: () => listarAgendasVisita({ ponto_venda_uuid: publicId, ativo: true }),
    enabled: Boolean(publicId),
  });
  const agendasVisita = agendasVisitaQuery.data?.agendas_visita ?? [];

  const promotoresQuery = useQuery({
    queryKey: ['usuarios', { user_type: 'PROMOTOR', ativo: true }],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', ativo: true }),
  });
  const todosPromotores = promotoresQuery.data?.usuarios ?? [];

  // Todas as visitas já feitas nesta loja, de qualquer promotor — o backend não filtra por dono
  // pra GESTOR/ADMIN (ver VisitaController::index). Mesmo padrão da aba "Visitas neste PDV" da
  // tela de Contrato.
  const visitasQuery = useQuery({
    queryKey: ['visitas', { ponto_venda_uuid: publicId, page: paginaVisitas }],
    queryFn: () => listarVisitas({ ponto_venda_uuid: publicId, page: paginaVisitas + 1 }),
    enabled: Boolean(publicId),
  });

  const produtosQuery = useQuery({ queryKey: ['produtos'], queryFn: () => listarProdutos(), enabled: tipoItemSortimento === 'PRODUTO' });
  const secoesQuery = useQuery({ queryKey: ['secoes'], queryFn: () => listarSecoes(), enabled: tipoItemSortimento === 'SECAO' });
  const departamentosQuery = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => listarDepartamentos(),
    enabled: tipoItemSortimento === 'DEPARTAMENTO',
  });
  const marcasQuery = useQuery({ queryKey: ['marcas'], queryFn: () => listarMarcas(), enabled: tipoItemSortimento === 'MARCA' });

  const adicionarSortimentoMutation = useMutation({
    mutationFn: () => {
      const campo =
        tipoItemSortimento === 'PRODUTO'
          ? 'produto_uuid'
          : tipoItemSortimento === 'SECAO'
            ? 'secao_uuid'
            : tipoItemSortimento === 'DEPARTAMENTO'
              ? 'departamento_uuid'
              : 'marca_uuid';

      return adicionarSortimentoItem(publicId!, { tipo_item: tipoItemSortimento, [campo]: entidadeSortimentoUuid! });
    },
    onSuccess: () => {
      setErroSortimento(null);
      setEntidadeSortimentoUuid(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível adicionar o item.';
      setErroSortimento(mensagem);
    },
  });

  const removerSortimentoMutation = useMutation({
    mutationFn: (itemUuid: string) => removerSortimentoItem(publicId!, itemUuid),
    onSuccess: () => {
      setErroSortimento(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
    },
    onError: () => setErroSortimento('Não foi possível remover o item.'),
  });

  const aprovarSortimentoMutation = useMutation({
    mutationFn: (itemUuid: string) => aprovarSortimentoItem(publicId!, itemUuid),
    onSuccess: () => {
      setErroSortimento(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
    },
    onError: () => setErroSortimento('Não foi possível aprovar o item.'),
  });

  const rejeitarSortimentoMutation = useMutation({
    mutationFn: (itemUuid: string) => rejeitarSortimentoItem(publicId!, itemUuid),
    onSuccess: () => {
      setErroSortimento(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
    },
    onError: () => setErroSortimento('Não foi possível rejeitar o item.'),
  });

  const alternarAtivoMutation = useMutation({
    mutationFn: (pdv: PontoVenda) => atualizarPontoVenda(pdv.id, { ativo: !pdv.ativo }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda'] });
    },
    onError: () => setErro('Não foi possível alterar o status do ponto de venda.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (pdv: PontoVenda) => desativarPontoVenda(pdv.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda'] });
    },
    onError: () => setErro('Não foi possível desativar o ponto de venda.'),
  });

  // Add/remove unitário (não sincroniza a lista inteira) — evita a race de dois cliques rápidos
  // um perdendo a atribuição do outro. Ver lib/api/pontosVenda.ts.
  const adicionarPromotorMutation = useMutation({
    mutationFn: ({ pdv, promotorUuid }: { pdv: PontoVenda; promotorUuid: string }) =>
      adicionarPromotorPontoVenda(pdv.id, promotorUuid),
    onSuccess: () => {
      setErro(null);
      setPromotorParaAdicionar(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
    },
    onError: () => setErro('Não foi possível adicionar o promotor.'),
  });

  const removerPromotorMutation = useMutation({
    mutationFn: ({ pdv, promotorUuid }: { pdv: PontoVenda; promotorUuid: string }) =>
      removerPromotorPontoVenda(pdv.id, promotorUuid),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', publicId] });
    },
    onError: () => setErro('Não foi possível remover o promotor.'),
  });

  function alternarStatus(pdv: PontoVenda) {
    if (pdv.ativo) {
      if (window.confirm(`Desativar ${pdv.fantasia}?`)) {
        desativarMutation.mutate(pdv);
      }
      return;
    }

    alternarAtivoMutation.mutate(pdv);
  }

  if (pdvQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (pdvQuery.isError || !pdvQuery.data) {
    return <Typography color="error">Ponto de venda não encontrado.</Typography>;
  }

  const { ponto_venda: pdv } = pdvQuery.data;
  const promotoresDisponiveis = todosPromotores.filter(
    (usuario) => !pdv.promotores.some((p) => p.id === usuario.id),
  );

  const opcoesSortimento =
    tipoItemSortimento === 'PRODUTO'
      ? (produtosQuery.data?.produtos ?? [])
      : tipoItemSortimento === 'SECAO'
        ? (secoesQuery.data?.secoes ?? [])
        : tipoItemSortimento === 'DEPARTAMENTO'
          ? (departamentosQuery.data?.departamentos ?? [])
          : (marcasQuery.data?.marcas ?? []);
  const carregandoOpcoesSortimento =
    produtosQuery.isLoading || secoesQuery.isLoading || departamentosQuery.isLoading || marcasQuery.isLoading;
  const sortimento = pdv.sortimento ?? [];

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/pontos-venda')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1">
          {pdv.fantasia}
        </Typography>
        <Chip label={pdv.ativo ? 'Ativo' : 'Inativo'} color={pdv.ativo ? 'success' : 'default'} size="small" />
        <Box sx={{ flexGrow: 1 }} />
        <Button variant="outlined" onClick={() => setDialogAberto(true)}>
          Editar dados
        </Button>
        <Button variant="outlined" color={pdv.ativo ? 'error' : 'success'} onClick={() => alternarStatus(pdv)}>
          {pdv.ativo ? 'Desativar' : 'Reativar'}
        </Button>
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dados
        </Typography>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Razão social
            </Typography>
            <Typography>{pdv.razao_social}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Código externo
            </Typography>
            <Typography>{pdv.codigo_externo ?? '—'}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              CNPJ
            </Typography>
            <Typography>{pdv.cnpj ?? '—'}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Endereço
            </Typography>
            <Typography>
              {pdv.endereco}
              {pdv.numero ? `, ${pdv.numero}` : ''}
              {pdv.bairro ? ` — ${pdv.bairro}` : ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Cidade / CEP
            </Typography>
            <Typography>
              {pdv.cidade}
              {pdv.cep ? ` — ${pdv.cep}` : ''}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Telefone
            </Typography>
            <Typography>{pdv.telefone ?? '—'}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              E-mail
            </Typography>
            <Typography>{pdv.email ?? '—'}</Typography>
          </Grid>
        </Grid>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Promotores
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sem nenhum promotor atribuído, esta loja fica visível a todos os promotores da empresa
          no app.
        </Typography>

        {pdv.promotores.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Nenhum promotor atribuído ainda.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {pdv.promotores.map((p) => (
              <Chip
                key={p.id}
                label={p.nome}
                onDelete={() => removerPromotorMutation.mutate({ pdv, promotorUuid: p.id })}
              />
            ))}
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Autocomplete
            size="small"
            sx={{ width: 280 }}
            options={promotoresDisponiveis}
            getOptionLabel={(option) => option.nome}
            loading={promotoresQuery.isLoading}
            value={promotorParaAdicionar}
            onChange={(_, value) => setPromotorParaAdicionar(value)}
            renderInput={(params) => <TextField {...params} label="Adicionar promotor" />}
          />
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            disabled={!promotorParaAdicionar || adicionarPromotorMutation.isPending}
            onClick={() => {
              if (promotorParaAdicionar) {
                adicionarPromotorMutation.mutate({ pdv, promotorUuid: promotorParaAdicionar.id });
              }
            }}
          >
            Adicionar
          </Button>
        </Box>
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6">Agenda de visitas</Typography>
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setAgendaEmEdicao(null);
              setDialogAgendaAberto(true);
            }}
          >
            Nova agenda
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Rotina fixa de visita cadastrada pra este PDV — toda semana no mesmo dia, ou numa data
          específica. Gera uma ordem de serviço automaticamente quando chega o dia. Ver também a
          tela "Agenda de Visita" no menu, pra gerenciar em lote.
        </Typography>

        {agendasVisitaQuery.isLoading ? (
          <CircularProgress size={20} />
        ) : agendasVisita.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma agenda ativa pra este PDV ainda.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Promotor</TableCell>
                <TableCell>Quando</TableCell>
                <TableCell>Horário</TableCell>
                <TableCell>Tipo</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {agendasVisita.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.usuario.nome}</TableCell>
                  <TableCell>{quandoExibicao(a)}</TableCell>
                  <TableCell>{a.horario_previsto ?? '—'}</TableCell>
                  <TableCell>
                    {a.tipo_visita ? (
                      <Chip label={a.tipo_visita.descricao} size="small" sx={{ bgcolor: a.tipo_visita.cor, color: '#fff' }} />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Editar">
                      <IconButton
                        size="small"
                        onClick={() => {
                          setAgendaEmEdicao(a);
                          setDialogAgendaAberto(true);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Histórico de visitas
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Todas as visitas registradas nesta loja, de qualquer promotor. Clique numa linha pra ver
          os registros (fotos, rupturas) daquela visita.
        </Typography>

        {visitasQuery.isLoading ? (
          <CircularProgress size={20} />
        ) : (visitasQuery.data?.visitas.length ?? 0) === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhuma visita registrada nesta loja ainda.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Promotor</TableCell>
                  <TableCell>Início</TableCell>
                  <TableCell>Fim</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Distância no check-in</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {visitasQuery.data?.visitas.map((visita) => (
                  <TableRow
                    key={visita.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/visitas/${visita.id}`)}
                  >
                    <TableCell>{visita.usuario?.nome ?? '—'}</TableCell>
                    <TableCell>{new Date(visita.inicio_data).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>
                      {visita.fim_data ? new Date(visita.fim_data).toLocaleString('pt-BR') : '—'}
                      {visita.checkout_tipo === 'ADMIN' && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          forçado pelo admin
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_VISITA_LABELS[visita.status]}
                        color={STATUS_VISITA_COLORS[visita.status]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">{Math.round(visita.inicio_distancia_metros)} m</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {(visitasQuery.data?.meta.last_page ?? 1) > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Pagination
              size="small"
              count={visitasQuery.data?.meta.last_page ?? 1}
              page={paginaVisitas + 1}
              onChange={(_, pagina) => setPaginaVisitas(pagina - 1)}
            />
          </Box>
        )}
      </Paper>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" gutterBottom>
          Sortimento
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Produtos (ou seções/departamentos/marcas inteiras) que esta loja compra — usado como
          checklist na visita do promotor. Itens marcados "Pendente" foram adicionados pelo
          próprio promotor pela visita e aguardam aprovação. Ver docs/14-SORTIMENTO-PONTO-VENDA.md.
        </Typography>

        {erroSortimento && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErroSortimento(null)}>
            {erroSortimento}
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <TextField
            select
            label="Tipo"
            size="small"
            sx={{ width: 220 }}
            value={tipoItemSortimento}
            onChange={(e) => {
              setTipoItemSortimento(e.target.value as TipoItemCampanha);
              setEntidadeSortimentoUuid(null);
            }}
          >
            {(Object.keys(TIPO_ITEM_LABELS) as TipoItemCampanha[]).map((tipo) => (
              <MenuItem key={tipo} value={tipo}>
                {TIPO_ITEM_LABELS[tipo]}
              </MenuItem>
            ))}
          </TextField>
          <Autocomplete
            size="small"
            sx={{ width: 280 }}
            options={opcoesSortimento}
            getOptionLabel={(option) => option.descricao}
            loading={carregandoOpcoesSortimento}
            value={opcoesSortimento.find((o) => o.id === entidadeSortimentoUuid) ?? null}
            onChange={(_, value) => setEntidadeSortimentoUuid(value?.id ?? null)}
            renderInput={(params) => <TextField {...params} label={TIPO_ITEM_LABELS[tipoItemSortimento]} />}
          />
          <Button
            variant="contained"
            disabled={!entidadeSortimentoUuid || adicionarSortimentoMutation.isPending}
            onClick={() => adicionarSortimentoMutation.mutate()}
          >
            Adicionar
          </Button>
        </Box>

        {sortimento.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Nenhum item de sortimento cadastrado ainda.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tipo</TableCell>
                <TableCell>Cobre</TableCell>
                <TableCell>Origem</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortimento.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Chip label={TIPO_ITEM_LABELS[item.tipo_item]} size="small" />
                  </TableCell>
                  <TableCell>{entidadeDoItem(item)}</TableCell>
                  <TableCell>
                    {item.status_aprovacao === 'PENDENTE' ? (
                      <Chip label={`Pendente${item.usuario ? ` (${item.usuario.nome})` : ''}`} color="warning" size="small" />
                    ) : item.usuario ? (
                      item.usuario.nome
                    ) : (
                      'Admin'
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {item.status_aprovacao === 'PENDENTE' ? (
                      <>
                        <Tooltip title="Aprovar">
                          <IconButton size="small" onClick={() => aprovarSortimentoMutation.mutate(item.id)}>
                            <CheckCircleIcon fontSize="small" color="success" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rejeitar">
                          <IconButton size="small" onClick={() => rejeitarSortimentoMutation.mutate(item.id)}>
                            <ClearIcon fontSize="small" color="error" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip title="Remover">
                        <IconButton size="small" onClick={() => removerSortimentoMutation.mutate(item.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <PontoVendaFormDialog open={dialogAberto} pontoVenda={pdv} onClose={() => setDialogAberto(false)} />

      <AgendaVisitaFormDialog
        open={dialogAgendaAberto}
        agendaVisita={agendaEmEdicao}
        pontoVendaFixo={{ id: pdv.id, fantasia: pdv.fantasia }}
        onClose={() => {
          setDialogAgendaAberto(false);
          void queryClient.invalidateQueries({ queryKey: ['agendas-visita', { ponto_venda_uuid: publicId }] });
        }}
      />
    </Box>
  );
}

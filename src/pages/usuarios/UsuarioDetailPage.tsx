import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LoginIcon from '@mui/icons-material/Login';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PhonelinkEraseIcon from '@mui/icons-material/PhonelinkErase';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Pagination,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { adicionarPromotorPontoVenda, listarPontosVenda, removerPromotorPontoVenda } from '../../lib/api/pontosVenda';
import {
  atualizarUsuario,
  buscarHistoricoUsuario,
  buscarUsuario,
  desativarUsuario,
  revogarDispositivoUsuario,
} from '../../lib/api/usuarios';
import { useAuth } from '../../lib/auth/AuthContext';
import type { EventoHistorico, PontoVenda, TipoEventoHistorico, UserType, Usuario } from '../../types/api';
import { SelecionarPontoVendaDialog } from './SelecionarPontoVendaDialog';
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

function IconeEvento({ tipo, ruptura }: { tipo: TipoEventoHistorico; ruptura: boolean | null }) {
  switch (tipo) {
    case 'LOGIN':
      return <LoginIcon fontSize="small" color="action" />;
    case 'VISITA_INICIO':
      return <MeetingRoomIcon fontSize="small" color="action" />;
    case 'VISITA_FIM':
      return <ExitToAppIcon fontSize="small" color="action" />;
    case 'REGISTRO':
      return ruptura ? (
        <ReportProblemIcon fontSize="small" color="error" />
      ) : (
        <PhotoCameraIcon fontSize="small" color="action" />
      );
  }
}

function numero(valor: number | string | null): number | null {
  if (valor === null) return null;
  return typeof valor === 'number' ? valor : Number(valor);
}

function descricaoEvento(evento: EventoHistorico): string {
  switch (evento.tipo) {
    case 'LOGIN':
      return evento.dispositivo ? `Login · ${evento.dispositivo}` : 'Login';
    case 'VISITA_INICIO':
      return `Entrou em ${evento.ponto_venda?.fantasia ?? 'um ponto de venda'}`;
    case 'VISITA_FIM':
      return `Saiu de ${evento.ponto_venda?.fantasia ?? 'um ponto de venda'}`;
    case 'REGISTRO': {
      // tipo_registro agora é o nome do tipo customizado pela empresa (ver
      // docs/01-MODELO-DE-DADOS.md#tipos-de-registro), não mais um enum fixo — usa o texto
      // direto, sem tabela de tradução.
      const base = evento.tipo_registro ?? 'Registro';
      const produto = evento.produto ? ` de ${evento.produto.descricao}` : '';
      const local = evento.ponto_venda ? ` em ${evento.ponto_venda.fantasia}` : '';
      const marcaRuptura = evento.ruptura ? ' (ruptura)' : '';
      return `${base}${produto}${local}${marcaRuptura}`;
    }
  }
}

// Formato aceito pelos <TextField type="date"> abaixo (yyyy-mm-dd) e pelo filtro
// ?data_inicio=/?data_fim= do backend — sempre a data local do navegador, nunca UTC.
function dataIsoLocal(data: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

function diasAtras(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() - dias);
  return dataIsoLocal(data);
}

// Página de detalhe — mesmo padrão de Empresas/Pontos de Venda: reúne o que a lista não tinha
// espaço pra mostrar (lojas do promotor, gestão do dispositivo vinculado), ver
// docs/03-ADMIN-WEB.md#6-usuários.
export function UsuarioDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario: usuarioLogado } = useAuth();
  const isSuperadmin = usuarioLogado?.user_type === 'SUPERADMIN';
  const [dialogAberto, setDialogAberto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscaLoja, setBuscaLoja] = useState('');
  const [buscaLojaDebounced, setBuscaLojaDebounced] = useState('');
  const [lojaParaAdicionar, setLojaParaAdicionar] = useState<PontoVenda | null>(null);
  const [dialogBuscaAvancadaAberto, setDialogBuscaAvancadaAberto] = useState(false);
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [abaHistorico, setAbaHistorico] = useState<'atividade' | 'localizacao'>('atividade');
  // Default: últimos 7 dias — sem isso a lista de atividade carregava tudo desde sempre, o que
  // costuma ser a maioria dos casos raramente úteis (alguém quase sempre quer "o que aconteceu
  // recentemente"). "Limpar período" abaixo continua dando acesso ao histórico completo.
  const [dataInicioHistorico, setDataInicioHistorico] = useState(() => diasAtras(7));
  const [dataFimHistorico, setDataFimHistorico] = useState(() => dataIsoLocal(new Date()));

  const usuarioQuery = useQuery({
    queryKey: ['usuarios', publicId],
    queryFn: () => buscarUsuario(publicId as string),
    enabled: Boolean(publicId),
  });

  const usuario = usuarioQuery.data?.usuario;
  const ehPromotor = usuario?.user_type === 'PROMOTOR';

  const pontosVendaQuery = useQuery({
    queryKey: ['pontos-venda', { promotor_uuid: publicId }],
    queryFn: () => listarPontosVenda({ promotor_uuid: publicId as string }),
    enabled: Boolean(publicId) && ehPromotor,
  });

  // Espera parar de digitar antes de buscar — evita 1 request por tecla, já que a lista de PDVs
  // pode passar da 1ª página (a API não pagina esse endpoint de forma customizável).
  useEffect(() => {
    const timer = setTimeout(() => setBuscaLojaDebounced(buscaLoja), 300);
    return () => clearTimeout(timer);
  }, [buscaLoja]);

  const opcoesLojaQuery = useQuery({
    queryKey: ['pontos-venda', 'busca-autocomplete', buscaLojaDebounced],
    queryFn: () => listarPontosVenda({ busca: buscaLojaDebounced || undefined, ativo: true }),
    enabled: ehPromotor,
  });

  // Aba "Localização" só pede os eventos de entrada/saída de PDV — paginação e filtro de
  // período são compartilhados entre as duas abas, mas o conjunto de tipos muda.
  const tiposHistorico: TipoEventoHistorico[] | undefined =
    abaHistorico === 'localizacao' ? ['VISITA_INICIO', 'VISITA_FIM'] : undefined;

  const historicoQuery = useQuery({
    queryKey: ['usuarios', publicId, 'historico', paginaHistorico, abaHistorico, dataInicioHistorico, dataFimHistorico],
    queryFn: () =>
      buscarHistoricoUsuario(publicId as string, {
        page: paginaHistorico,
        tipos: tiposHistorico,
        dataInicio: dataInicioHistorico || undefined,
        dataFim: dataFimHistorico || undefined,
      }),
    enabled: Boolean(publicId) && ehPromotor,
    placeholderData: keepPreviousData,
  });

  function mudarAbaHistorico(aba: 'atividade' | 'localizacao') {
    setAbaHistorico(aba);
    setPaginaHistorico(1);
  }

  function filtrarPeriodoHistorico(inicio: string, fim: string) {
    setDataInicioHistorico(inicio);
    setDataFimHistorico(fim);
    setPaginaHistorico(1);
  }

  const alternarAtivoMutation = useMutation({
    mutationFn: (alvo: Usuario) => atualizarUsuario(alvo.id, { ativo: !alvo.ativo }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['usuarios', publicId] });
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: () => setErro('Não foi possível alterar o status do usuário.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (alvo: Usuario) => desativarUsuario(alvo.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['usuarios', publicId] });
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

  const revogarDispositivoMutation = useMutation({
    mutationFn: (alvo: Usuario) => revogarDispositivoUsuario(alvo.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['usuarios', publicId] });
    },
    onError: () => setErro('Não foi possível revogar o dispositivo.'),
  });

  // Soma este promotor à atribuição da loja escolhida (não mexe em quem mais já atende ela) —
  // add/remove unitário (não sync da lista inteira), mesmo endpoint usado na tela de Pontos de
  // Venda, só que operado a partir do usuário em vez da loja.
  const adicionarLojaMutation = useMutation({
    mutationFn: ({ pdv, usuarioId }: { pdv: PontoVenda; usuarioId: string }) =>
      adicionarPromotorPontoVenda(pdv.id, usuarioId),
    onSuccess: () => {
      setErro(null);
      setLojaParaAdicionar(null);
      setBuscaLoja('');
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', { promotor_uuid: publicId }] });
    },
    onError: () => setErro('Não foi possível vincular a loja.'),
  });

  const removerLojaMutation = useMutation({
    mutationFn: ({ pdv, usuarioId }: { pdv: PontoVenda; usuarioId: string }) =>
      removerPromotorPontoVenda(pdv.id, usuarioId),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['pontos-venda', { promotor_uuid: publicId }] });
    },
    onError: () => setErro('Não foi possível desvincular a loja.'),
  });

  function alternarStatus(alvo: Usuario) {
    if (alvo.ativo) {
      if (window.confirm(`Desativar ${alvo.nome}? O acesso dele é revogado imediatamente.`)) {
        desativarMutation.mutate(alvo);
      }
      return;
    }

    alternarAtivoMutation.mutate(alvo);
  }

  function revogarDispositivo(alvo: Usuario) {
    if (
      window.confirm(
        `Revogar o dispositivo de ${alvo.nome}? A sessão atual dele é derrubada na hora — no próximo login, um novo aparelho é vinculado normalmente.`,
      )
    ) {
      revogarDispositivoMutation.mutate(alvo);
    }
  }

  if (usuarioQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (usuarioQuery.isError || !usuario) {
    return <Typography color="error">Usuário não encontrado.</Typography>;
  }

  const pontosVenda = pontosVendaQuery.data?.pontos_venda ?? [];
  const lojasJaVinculadasIds = new Set(pontosVenda.map((pdv) => pdv.id));
  const opcoesLoja = (opcoesLojaQuery.data?.pontos_venda ?? []).filter((pdv) => !lojasJaVinculadasIds.has(pdv.id));

  return (
    <Box>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/usuarios')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <UsuarioAvatar nome={usuario.nome} fotoUrl={usuario.foto_url} size={56} />
        <Typography variant="h4" component="h1">
          {usuario.nome}
        </Typography>
        <Chip label={USER_TYPE_LABELS[usuario.user_type]} color={USER_TYPE_COLORS[usuario.user_type]} size="small" />
        <Chip label={usuario.ativo ? 'Ativo' : 'Inativo'} color={usuario.ativo ? 'success' : 'default'} size="small" />
        <Box sx={{ flexGrow: 1 }} />
        {usuario.user_type !== 'SUPERADMIN' && (
          <Button variant="outlined" onClick={() => setDialogAberto(true)}>
            Editar dados
          </Button>
        )}
        {!isSuperadmin && usuario.user_type !== 'SUPERADMIN' && (
          <Button variant="outlined" color={usuario.ativo ? 'error' : 'success'} onClick={() => alternarStatus(usuario)}>
            {usuario.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        )}
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
              E-mail
            </Typography>
            <Typography>{usuario.email}</Typography>
          </Grid>
          {isSuperadmin && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Empresa
              </Typography>
              <Typography>{usuario.empresa?.nome_fantasia ?? '—'}</Typography>
            </Grid>
          )}
          {usuario.perfil && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Perfil
              </Typography>
              <Typography>{usuario.perfil.nome}</Typography>
            </Grid>
          )}
          {usuario.centro_custo && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <Typography variant="caption" color="text.secondary">
                Centro de custo
              </Typography>
              <Typography>{usuario.centro_custo.descricao}</Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {ehPromotor && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Pontos de venda vinculados
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Também dá pra atribuir várias lojas de uma vez pela tela de Pontos de Venda
            (selecionar loja(s) → "Atribuir promotor") — aqui é o mesmo vínculo, só que atribuído
            um a um a partir do usuário.
          </Typography>

          {pontosVendaQuery.isLoading ? (
            <CircularProgress size={20} />
          ) : pontosVenda.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Nenhuma loja atribuída ainda — no app, este promotor enxerga todas as lojas sem
              promotor definido.
            </Typography>
          ) : (
            <TableContainer sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fantasia</TableCell>
                    <TableCell>Cidade</TableCell>
                    <TableCell>Bairro</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Ações</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pontosVenda.map((pdv) => (
                    <TableRow key={pdv.id} hover>
                      <TableCell
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/pontos-venda/${pdv.id}`)}
                      >
                        {pdv.fantasia}
                      </TableCell>
                      <TableCell>{pdv.cidade}</TableCell>
                      <TableCell>{pdv.bairro ?? '—'}</TableCell>
                      <TableCell>
                        <Chip label={pdv.ativo ? 'Ativo' : 'Inativo'} color={pdv.ativo ? 'success' : 'default'} size="small" />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Desvincular loja">
                          <IconButton
                            size="small"
                            disabled={removerLojaMutation.isPending}
                            onClick={() => removerLojaMutation.mutate({ pdv, usuarioId: usuario.id })}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <Autocomplete
              size="small"
              sx={{ width: 320 }}
              options={opcoesLoja}
              getOptionLabel={(option) => option.fantasia}
              loading={opcoesLojaQuery.isLoading}
              filterOptions={(options) => options}
              value={lojaParaAdicionar}
              inputValue={buscaLoja}
              onInputChange={(_, value) => setBuscaLoja(value)}
              onChange={(_, value) => setLojaParaAdicionar(value)}
              renderInput={(params) => <TextField {...params} label="Vincular loja" placeholder="Buscar por nome, fantasia ou bairro" />}
            />
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              disabled={!lojaParaAdicionar || adicionarLojaMutation.isPending}
              onClick={() => {
                if (lojaParaAdicionar) {
                  adicionarLojaMutation.mutate({ pdv: lojaParaAdicionar, usuarioId: usuario.id });
                }
              }}
            >
              Vincular
            </Button>
            <Button
              variant="text"
              startIcon={<SearchIcon />}
              onClick={() => setDialogBuscaAvancadaAberto(true)}
            >
              Busca avançada
            </Button>
          </Box>
        </Paper>
      )}

      {ehPromotor && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Dispositivo
          </Typography>

          {!usuario.dispositivo ? (
            <Typography variant="body2" color="text.secondary">
              Nunca logou pelo app mobile.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Aparelho
                </Typography>
                <Typography>{usuario.dispositivo.nome ?? usuario.dispositivo.identificador}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Último acesso
                </Typography>
                <Typography>{new Date(usuario.dispositivo.ultimo_acesso_em).toLocaleString('pt-BR')}</Typography>
              </Box>
              <Box sx={{ flexGrow: 1 }} />
              <Button
                variant="outlined"
                color="error"
                startIcon={<PhonelinkEraseIcon />}
                disabled={revogarDispositivoMutation.isPending}
                onClick={() => revogarDispositivo(usuario)}
              >
                Revogar dispositivo
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {ehPromotor && (
        <Paper sx={{ p: 3, mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Histórico
          </Typography>

          <Tabs value={abaHistorico} onChange={(_, valor) => mudarAbaHistorico(valor)} sx={{ mb: 2 }}>
            <Tab label="Atividade" value="atividade" />
            <Tab label="Localização" value="localizacao" />
          </Tabs>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <TextField
              type="date"
              label="De"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataInicioHistorico}
              onChange={(e) => filtrarPeriodoHistorico(e.target.value, dataFimHistorico)}
            />
            <TextField
              type="date"
              label="Até"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataFimHistorico}
              onChange={(e) => filtrarPeriodoHistorico(dataInicioHistorico, e.target.value)}
            />
            {(dataInicioHistorico || dataFimHistorico) && (
              <Button size="small" onClick={() => filtrarPeriodoHistorico('', '')}>
                Limpar período
              </Button>
            )}
          </Box>

          {historicoQuery.isLoading ? (
            <CircularProgress size={20} />
          ) : (historicoQuery.data?.eventos.length ?? 0) === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {abaHistorico === 'localizacao'
                ? 'Nenhuma entrada/saída de PDV registrada nesse período.'
                : 'Nenhuma atividade registrada nesse período.'}
            </Typography>
          ) : abaHistorico === 'localizacao' ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Data/hora</TableCell>
                    <TableCell>Evento</TableCell>
                    <TableCell>Ponto de venda</TableCell>
                    <TableCell>Latitude</TableCell>
                    <TableCell>Longitude</TableCell>
                    <TableCell align="right">Distância do PDV</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historicoQuery.data?.eventos.map((evento, indice) => (
                    <TableRow key={`${evento.tipo}-${evento.ocorrido_em}-${indice}`} hover>
                      <TableCell>{new Date(evento.ocorrido_em).toLocaleString('pt-BR')}</TableCell>
                      <TableCell>
                        <Chip
                          label={evento.tipo === 'VISITA_INICIO' ? 'Entrada' : 'Saída'}
                          size="small"
                          color={evento.tipo === 'VISITA_INICIO' ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {evento.ponto_venda ? (
                          <Box
                            component="span"
                            sx={{ cursor: 'pointer', color: 'primary.main' }}
                            onClick={() => navigate(`/pontos-venda/${evento.ponto_venda!.id}`)}
                          >
                            {evento.ponto_venda.fantasia}
                          </Box>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{numero(evento.latitude)?.toFixed(6) ?? '—'}</TableCell>
                      <TableCell>{numero(evento.longitude)?.toFixed(6) ?? '—'}</TableCell>
                      <TableCell align="right">
                        {numero(evento.distancia_metros) !== null ? `${numero(evento.distancia_metros)!.toFixed(0)} m` : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box>
              {historicoQuery.data?.eventos.map((evento, indice) => (
                <Box
                  key={`${evento.tipo}-${evento.ocorrido_em}-${indice}`}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    alignItems: 'flex-start',
                    py: 1.25,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Box sx={{ mt: 0.25 }}>
                    <IconeEvento tipo={evento.tipo} ruptura={evento.ruptura} />
                  </Box>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="body2">{descricaoEvento(evento)}</Typography>
                    {evento.observacao && (
                      <Typography variant="caption" color="text.secondary">
                        "{evento.observacao}"
                      </Typography>
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                    {new Date(evento.ocorrido_em).toLocaleString('pt-BR')}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {(historicoQuery.data?.meta.last_page ?? 1) > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Pagination
                size="small"
                count={historicoQuery.data?.meta.last_page ?? 1}
                page={paginaHistorico}
                onChange={(_, pagina) => setPaginaHistorico(pagina)}
              />
            </Box>
          )}
        </Paper>
      )}

      <UsuarioFormDialog open={dialogAberto} usuario={usuario} onClose={() => setDialogAberto(false)} />
      <SelecionarPontoVendaDialog
        open={dialogBuscaAvancadaAberto}
        lojasJaVinculadasIds={lojasJaVinculadasIds}
        onClose={() => setDialogBuscaAvancadaAberto(false)}
        onSelecionar={(pdv) => {
          setLojaParaAdicionar(pdv);
          setBuscaLoja(pdv.fantasia);
        }}
      />
    </Box>
  );
}

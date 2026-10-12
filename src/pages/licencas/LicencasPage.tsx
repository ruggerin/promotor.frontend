import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlineOutlined';
import HowToRegIcon from '@mui/icons-material/HowToRegOutlined';
import PhoneAndroidIcon from '@mui/icons-material/PhoneAndroidOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import {
  aprovarSolicitacaoAparelho,
  buscarLicencas,
  definirLicencaMobile,
  recusarSolicitacaoAparelho,
} from '../../lib/api/licencas';
import { revogarDispositivoUsuario } from '../../lib/api/usuarios';
import { nomePlataforma, tagIntegridade, textoUltimoUso, TIPO_USUARIO } from '../../lib/licencas';
import { configSuporte } from '../../lib/suporte';
import type { Licenciado, LicencasResponse } from '../../types/api';

// Licenças e plano (docs/67 §3, protótipo aprovado em 12/10/2026) — só ADMIN. Uso × limite das
// licenças do app mobile, pedidos de liberação de aparelho e quem tem licença.

type Filtro = 'todos' | 'sem_aparelho' | 'trocas' | 'integridade';

function mensagemDoErro(err: unknown, padrao: string): string {
  return axios.isAxiosError<{ message?: string }>(err) && err.response?.data?.message ? err.response.data.message : padrao;
}

function Kpi({ rotulo, valor, complemento, atencao, children }: { rotulo: string; valor: ReactNode; complemento: string; atencao?: boolean; children?: ReactNode }) {
  return (
    <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Typography variant="body2" color="text.secondary">
        {rotulo}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
        <Typography sx={{ fontSize: 24, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: atencao ? 'warning.dark' : undefined }}>
          {valor}
        </Typography>
        <Typography variant="body2" sx={{ color: atencao ? 'warning.dark' : 'text.secondary' }}>
          {complemento}
        </Typography>
      </Box>
      {children}
    </Paper>
  );
}

function CabecalhoPainel({ icone, titulo, subtitulo, atencao, acoes }: { icone: ReactNode; titulo: string; subtitulo: string; atencao?: boolean; acoes?: ReactNode }) {
  return (
    <Box
      sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            flexShrink: 0,
            bgcolor: atencao ? 'warning.light' : 'primary.light',
            color: atencao ? 'warning.dark' : 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icone}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontSize: 15 }}>
            {titulo}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitulo}
          </Typography>
        </Box>
      </Box>
      {acoes}
    </Box>
  );
}

function filtrar(linhas: Licenciado[], filtro: Filtro, busca: string): Licenciado[] {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  return linhas.filter((l) => {
    if (termo && !l.usuario_nome.toLocaleLowerCase('pt-BR').includes(termo)) return false;
    if (filtro === 'sem_aparelho') return !l.tem_aparelho;
    if (filtro === 'trocas') return l.alerta_trocas;
    if (filtro === 'integridade') return l.integridade_status === 'SUSPEITO' || l.integridade_status === 'FALHOU';
    return true;
  });
}

export function LicencasPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [atribuirAberto, setAtribuirAberto] = useState(false);
  const [escolhido, setEscolhido] = useState<LicencasResponse['sem_licenca'][number] | null>(null);

  const query = useQuery({ queryKey: ['licencas'], queryFn: buscarLicencas });
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Licenças e plano" />);
  const suporte = configSuporte();
  const linkSuporte = suporte.url ?? (suporte.email ? `mailto:${suporte.email}?subject=${encodeURIComponent('Contratar mais licenças do app')}` : null);

  const acao = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onError: (err) => setAviso({ tipo: 'error', texto: mensagemDoErro(err, 'Não foi possível concluir a ação.') }),
  });

  function executar(fn: () => Promise<void>, sucesso: string, confirmacao?: string, depois?: () => void) {
    if (confirmacao && !window.confirm(confirmacao)) return;
    setAviso(null);
    acao.mutate(fn, {
      onSuccess: () => {
        setAviso({ tipo: 'success', texto: sucesso });
        depois?.();
        void queryClient.invalidateQueries({ queryKey: ['licencas'] });
        void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      },
    });
  }

  const dados = query.data;
  const linhas = useMemo(() => filtrar(dados?.licenciados ?? [], filtro, busca), [dados, filtro, busca]);

  if (query.isLoading) {
    return (
      <Box>
        {cabecalho}
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  if (!dados) {
    return (
      <Box>
        {cabecalho}
        <Alert severity="error">Não foi possível carregar as licenças.</Alert>
      </Box>
    );
  }

  const { uso } = dados;
  const ilimitado = uso.licencas_limite == null;
  const percentual = ilimitado || !uso.licencas_limite ? 0 : Math.min(100, (uso.licencas_usadas / uso.licencas_limite) * 100);
  const corBarra = percentual >= 100 ? 'error' : percentual >= 90 ? 'warning' : 'primary';
  const semVaga = !ilimitado && (uso.licencas_disponiveis ?? 0) <= 0;
  const ocupado = acao.isPending;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {cabecalho}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Typography color="text.secondary">Plano {dados.plano} · licenças do app mobile e aparelhos vinculados</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          {linkSuporte && (
            <Button variant="outlined" href={linkSuporte} target="_blank" rel="noopener noreferrer">
              Contratar mais licenças
            </Button>
          )}
          <Button variant="contained" startIcon={<HowToRegIcon />} onClick={() => setAtribuirAberto(true)} disabled={semVaga}>
            Atribuir licença
          </Button>
        </Box>
      </Box>

      {aviso && (
        <Alert severity={aviso.tipo} onClose={() => setAviso(null)}>
          {aviso.texto}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1.5 }}>
        <Kpi
          rotulo="Licenças mobile em uso"
          valor={uso.licencas_usadas}
          complemento={ilimitado ? 'sem limite contratado' : `de ${uso.licencas_limite} contratadas`}
        >
          {!ilimitado && <LinearProgress variant="determinate" value={percentual} color={corBarra} sx={{ height: 6, borderRadius: 3 }} />}
        </Kpi>
        <Kpi
          rotulo="Disponíveis"
          valor={ilimitado ? '—' : (uso.licencas_disponiveis ?? 0)}
          complemento={ilimitado ? 'ilimitado' : 'para atribuir'}
          atencao={semVaga}
        >
          <Typography variant="caption" color="text.secondary">
            {semVaga ? 'Limite atingido' : 'Aviso a partir de 90% do limite'}
          </Typography>
        </Kpi>
        <Kpi rotulo="Usando o app agora" valor={dados.usando_agora} complemento="nos últimos 5 min">
          <Typography variant="caption" color="text.secondary">
            {dados.com_aparelho} com aparelho vinculado
          </Typography>
        </Kpi>
        <Kpi
          rotulo="Pedidos de liberação"
          valor={dados.solicitacoes.length}
          complemento={dados.solicitacoes.length ? 'aguardando você' : 'nenhum pendente'}
          atencao={dados.solicitacoes.length > 0}
        >
          <Typography variant="caption" color="text.secondary">
            Troca própria: 1 a cada {dados.troca_aparelho.dias_entre_trocas} dias
          </Typography>
        </Kpi>
      </Box>

      {dados.solicitacoes.length > 0 && (
        <Paper>
          <CabecalhoPainel
            icone={<ErrorOutlineIcon fontSize="small" />}
            atencao
            titulo="Pedidos de liberação de aparelho"
            subtitulo="Quem tentou entrar num celular novo depois de já ter usado a troca da semana"
          />
          {dados.solicitacoes.map((s) => (
            <Box
              key={s.uuid}
              sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider' }}
            >
              <Box sx={{ minWidth: 260 }}>
                <Typography sx={{ fontWeight: 500 }}>
                  {s.usuario_nome}{' '}
                  <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                    · {s.user_type ? TIPO_USUARIO[s.user_type] : ''}
                  </Box>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Quer entrar no <strong>{s.aparelho ?? 'aparelho novo'}</strong>
                  {s.aparelho_atual ? ` · hoje usa o ${s.aparelho_atual}` : ''}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                  {textoUltimoUso(s.pedido_em)}
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  disabled={ocupado}
                  onClick={() => executar(() => recusarSolicitacaoAparelho(s.uuid), `Pedido de ${s.usuario_nome} recusado.`)}
                >
                  Recusar
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  disabled={ocupado}
                  onClick={() =>
                    executar(
                      () => aprovarSolicitacaoAparelho(s.uuid),
                      `${s.aparelho ?? 'Aparelho'} liberado para ${s.usuario_nome}. O aparelho anterior foi desconectado.`,
                    )
                  }
                >
                  Liberar aparelho
                </Button>
              </Box>
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2.5, py: 1.25 }}>
            Liberar desconecta o aparelho atual na hora; só o aparelho liberado consegue entrar depois.
          </Typography>
        </Paper>
      )}

      <Paper>
        <CabecalhoPainel
          icone={<PhoneAndroidIcon fontSize="small" />}
          titulo="Usuários com licença mobile"
          subtitulo={`${dados.licenciados.length} ${dados.licenciados.length === 1 ? 'licença atribuída' : 'licenças atribuídas'} · qualquer tipo de usuário pode receber`}
          acoes={
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              <TextField
                size="small"
                placeholder="Buscar usuário"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { 'aria-label': 'Buscar usuário' },
                }}
              />
              <TextField select size="small" value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} slotProps={{ htmlInput: { 'aria-label': 'Filtrar por situação' } }}>
                <MenuItem value="todos">Todas as situações</MenuItem>
                <MenuItem value="sem_aparelho">Sem aparelho</MenuItem>
                <MenuItem value="trocas">Trocas demais</MenuItem>
                <MenuItem value="integridade">Integridade suspeita</MenuItem>
              </TextField>
            </Box>
          }
        />
        <TableContainer>
          <Table sx={{ minWidth: 900 }}>
            <TableHead>
              <TableRow>
                <TableCell>Usuário</TableCell>
                <TableCell>Aparelho</TableCell>
                <TableCell>Integridade</TableCell>
                <TableCell>Último uso</TableCell>
                <TableCell align="right">Trocas em 30 dias</TableCell>
                <TableCell align="right">Ações</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ color: 'text.secondary', textAlign: 'center', py: 3 }}>
                    {dados.licenciados.length === 0 ? 'Nenhuma licença atribuída ainda.' : 'Ninguém nesta situação.'}
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((l) => {
                const integridade = tagIntegridade(l.integridade_status);
                return (
                  <TableRow key={l.usuario_uuid} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/usuarios/${l.usuario_uuid}`)}>
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>{l.usuario_nome}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {TIPO_USUARIO[l.user_type]}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {l.tem_aparelho ? (
                        <>
                          <Typography variant="body2">{l.aparelho ?? 'Aparelho sem nome'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {[nomePlataforma(l.plataforma, l.versao_so), l.versao_app && `app ${l.versao_app}`].filter(Boolean).join(' · ')}
                          </Typography>
                        </>
                      ) : (
                        <Chip label="Ainda não entrou no app" size="small" />
                      )}
                    </TableCell>
                    <TableCell>{l.tem_aparelho ? <Chip label={integridade.rotulo} color={integridade.cor} size="small" /> : '—'}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: l.online ? 'success.main' : 'text.disabled' }} />
                        {textoUltimoUso(l.ultimo_uso_em)}
                      </Box>
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {l.alerta_trocas ? <Chip label={`${l.trocas_aparelho_30d} trocas`} color="warning" size="small" /> : l.trocas_aparelho_30d}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                      {l.tem_aparelho && (
                        <Button
                          variant="outlined"
                          size="small"
                          disabled={ocupado}
                          onClick={() =>
                            executar(
                              () => revogarDispositivoUsuario(l.usuario_uuid),
                              `Aparelho de ${l.usuario_nome} desvinculado.`,
                              `Desvincular o aparelho de ${l.usuario_nome}? O app é desconectado na hora.`,
                            )
                          }
                        >
                          Desvincular aparelho
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        sx={{ ml: 1 }}
                        disabled={ocupado}
                        onClick={() =>
                          executar(
                            () => definirLicencaMobile(l.usuario_uuid, false),
                            `Licença de ${l.usuario_nome} removida.`,
                            `Remover a licença de ${l.usuario_nome}? O aparelho é desvinculado e o app é desconectado na hora.`,
                          )
                        }
                      >
                        Remover licença
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={atribuirAberto} onClose={() => setAtribuirAberto(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Atribuir licença do app</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {ilimitado
              ? 'A empresa não tem limite de licenças.'
              : `${uso.licencas_disponiveis ?? 0} de ${uso.licencas_limite} licenças disponíveis.`}{' '}
            Quem recebe passa a poder entrar no app; o primeiro celular em que entrar fica vinculado.
          </Typography>
          <Autocomplete
            options={dados.sem_licenca}
            value={escolhido}
            onChange={(_, valor) => setEscolhido(valor)}
            getOptionLabel={(o) => `${o.usuario_nome} · ${TIPO_USUARIO[o.user_type]}`}
            isOptionEqualToValue={(a, b) => a.usuario_uuid === b.usuario_uuid}
            noOptionsText="Todos os usuários ativos já têm licença"
            renderInput={(params) => <TextField {...params} label="Usuário" autoFocus />}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAtribuirAberto(false)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!escolhido || ocupado}
            onClick={() =>
              escolhido &&
              executar(() => definirLicencaMobile(escolhido.usuario_uuid, true), `${escolhido.usuario_nome} já pode entrar no app.`, undefined, () => {
                setAtribuirAberto(false);
                setEscolhido(null);
              })
            }
          >
            Atribuir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

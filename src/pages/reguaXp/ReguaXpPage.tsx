import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOffOutlined';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  LinearProgress,
  MenuItem,
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
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { temAcao } from '../../lib/acesso/telas';
import { listarSupervisores } from '../../lib/api/equipeComercial';
import { buscarEvolucao, buscarPlanejamento, buscarRankingEquipe, buscarRegua, buscarValorGerado, type FiltrosRegua, type PeriodoRanking } from '../../lib/api/xp';
import { useAuth } from '../../lib/auth/AuthContext';
import type { ReguaXp } from '../../types/api';
import { ComparativoMensal } from './ComparativoMensal';
import { OcorrenciasDaPerda } from './OcorrenciasDaPerda';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const hojeLocal = () => new Date().toLocaleDateString('sv-SE');
const dataBr = (dia: string) => dia.split('-').reverse().join('/');
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const mesTexto = (dia: string) => `${MESES[Number(dia.slice(5, 7)) - 1]} de ${dia.slice(0, 4)}`;

/**
 * Régua da operação (docs/88 §11): quanto dava pra fazer, quanto foi feito e onde ficou a perda.
 * Os mesmos números que o promotor vê no app, com a linguagem de gestor.
 */
export function ReguaXpPage() {
  const [aba, setAba] = useState<'regua' | 'comparativo' | 'ranking' | 'valor'>('regua');
  const [dia, setDia] = useState(hojeLocal());
  const [periodo, setPeriodo] = useState<'dia' | 'semana' | 'mes'>('dia');
  const [supervisor, setSupervisor] = useState('');
  const filtros: FiltrosRegua = { dia, periodo, supervisor_uuid: supervisor || undefined };
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Régua de produtividade" />);
  const supervisoresQuery = useQuery({ queryKey: ['supervisores', 'opcoes'], queryFn: () => listarSupervisores({ ativo: true }) });

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <Tabs value={aba} onChange={(_, v) => setAba(v)} sx={{ mr: 'auto' }}>
          <Tab value="regua" label="Régua" />
          <Tab value="comparativo" label="Comparativo" />
          <Tab value="ranking" label="Ranking da equipe" />
          <Tab value="valor" label="Valor gerado" />
        </Tabs>
        {aba === 'regua' && (
          <>
            <TextField type="date" size="small" label="Dia" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
            <ToggleButtonGroup exclusive size="small" value={periodo} onChange={(_, v) => v && setPeriodo(v)}>
              <ToggleButton value="dia">Dia</ToggleButton>
              <ToggleButton value="semana">Semana</ToggleButton>
              <ToggleButton value="mes">Mês</ToggleButton>
            </ToggleButtonGroup>
          </>
        )}
        {aba !== 'valor' && (
          <TextField select size="small" label="Equipe" value={supervisor} onChange={(e) => setSupervisor(e.target.value)} sx={{ minWidth: 200 }}>
            <MenuItem value="">Empresa inteira</MenuItem>
            {(supervisoresQuery.data?.supervisores ?? []).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                Equipe de {s.nome}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Box>
      {aba === 'regua' && <Regua filtros={filtros} />}
      {aba === 'comparativo' && <ComparativoMensal supervisor={supervisor || undefined} />}
      {aba === 'ranking' && <Ranking supervisor={supervisor || undefined} />}
      {aba === 'valor' && <ValorGerado />}
    </Box>
  );
}

function Regua({ filtros }: { filtros: FiltrosRegua }) {
  const { usuario } = useAuth();
  const podeClassificar = temAcao(usuario, 'xp.gerenciar');
  const [aberta, setAberta] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['xp', 'regua', filtros], queryFn: () => buscarRegua(filtros) });
  const evolucao = useQuery({ queryKey: ['xp', 'evolucao', filtros.supervisor_uuid], queryFn: () => buscarEvolucao(filtros) });
  const planejamento = useQuery({ queryKey: ['xp', 'planejamento', filtros.dia, filtros.supervisor_uuid], queryFn: () => buscarPlanejamento(filtros) });

  if (query.isLoading) return <CircularProgress />;
  if (query.isError || !query.data) return <Alert severity="error">Não foi possível carregar a régua.</Alert>;
  const r = query.data;
  const totalPerdas = r.perdas.reduce((s, p) => s + p.xp, 0);
  const periodoTexto =
    r.periodo.tipo === 'dia'
      ? dataBr(r.periodo.inicio)
      : r.periodo.tipo === 'mes'
        ? mesTexto(r.periodo.inicio)
        : `semana de ${dataBr(r.periodo.inicio)} a ${dataBr(r.periodo.fim)}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {r.modo_previa && (
        <Alert severity="info" icon={<VisibilityOffIcon />}>
          Modo prévia: os promotores ainda não veem o XP. Use o piloto para calibrar classes, tempos e tolerâncias e depois ligue
          "Promotor vê a pontuação" nas Configurações.
        </Alert>
      )}
      <Typography variant="body2" color="text.secondary">
        {periodoTexto} · {r.promotores_no_escopo} promotores, {r.promotores_com_os} com OS · {fmt(r.visitas_previstas)} OS planejadas
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
        <Kpi titulo="XP possível" valor={fmt(r.kpis.possivel)} sub={`congelado às ${r.congelado_em}`} />
        <Kpi titulo="Realizado do plano" valor={fmt(r.kpis.realizado)} sub={r.kpis.aproveitamento !== null ? `${r.kpis.aproveitamento}% de aproveitamento` : 'sem OS no período'} destaque />
        <Kpi titulo="Iniciativa" valor={`+${fmt(r.kpis.iniciativa)}`} sub="fora do plano, já contando" />
        <Kpi titulo="Aguardando avaliação" valor={fmt(r.kpis.pendente)} sub={`${r.kpis.aguardando_avaliacao} registro(s) na fila`} />
      </Box>

      <Trilho regua={r} />

      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          Onde ficaram os {fmt(totalPerdas)} XP
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Clique numa linha para ver as ocorrências{podeClassificar ? ' e classificar' : ''}.
        </Typography>
        {r.perdas.length === 0 ? (
          <Typography variant="body2" sx={{ py: 2 }}>
            Nenhuma perda no período.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Perda</TableCell>
                <TableCell align="right">Visitas</TableCell>
                <TableCell align="right">XP</TableCell>
                <TableCell align="right">% das perdas</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {r.perdas.map((p) => (
                <Fragment key={p.categoria}>
                  <TableRow hover sx={{ cursor: 'pointer' }} onClick={() => setAberta(aberta === p.categoria ? null : p.categoria)}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {aberta === p.categoria ? <KeyboardArrowDownIcon fontSize="small" sx={{ verticalAlign: 'middle' }} /> : <KeyboardArrowRightIcon fontSize="small" sx={{ verticalAlign: 'middle' }} />}{' '}
                      {p.rotulo}
                    </TableCell>
                    <TableCell align="right">{p.visitas}</TableCell>
                    <TableCell align="right">{fmt(p.xp)}</TableCell>
                    <TableCell align="right">{p.percentual}%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} sx={{ p: 0, borderBottom: aberta === p.categoria ? undefined : 'none' }}>
                      <Collapse in={aberta === p.categoria} unmountOnExit>
                        <OcorrenciasDaPerda filtros={filtros} categoria={p.categoria} podeClassificar={podeClassificar} />
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
          O número nunca é perdoado. Você classifica a ocorrência (justificada ou não, com a causa) e pode gerar um plano de ação para
          ela não se repetir.
        </Typography>
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Promotor</TableCell>
              <TableCell align="right">Possível</TableCell>
              <TableCell align="right">Realizado</TableCell>
              <TableCell sx={{ width: 180 }}>Aproveitamento</TableCell>
              <TableCell align="right">Iniciativa</TableCell>
              <TableCell align="right">Ofensiva</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {r.promotores.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhum promotor com OS no período.
                </TableCell>
              </TableRow>
            )}
            {r.promotores.map((p) => (
              <TableRow key={p.usuario.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <UsuarioAvatar nome={p.usuario.nome} fotoUrl={p.usuario.foto_url} size={32} />
                    <RouterLink to={`/usuarios/${p.usuario.id}`} style={{ color: 'inherit', fontWeight: 600 }}>
                      {p.usuario.nome}
                    </RouterLink>
                  </Box>
                </TableCell>
                <TableCell align="right">{fmt(p.possivel)}</TableCell>
                <TableCell align="right">{fmt(p.realizado)}</TableCell>
                <TableCell>
                  {p.aproveitamento !== null && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress variant="determinate" value={Math.min(100, p.aproveitamento)} sx={{ flex: 1, height: 6, borderRadius: 3 }} />
                      <Typography variant="caption" sx={{ minWidth: 34, textAlign: 'right' }}>
                        {p.aproveitamento}%
                      </Typography>
                    </Box>
                  )}
                </TableCell>
                <TableCell align="right">{p.iniciativa > 0 ? `+${fmt(p.iniciativa)}` : '—'}</TableCell>
                <TableCell align="right">
                  {p.ofensiva > 0 ? (
                    <Chip size="small" icon={<LocalFireDepartmentIcon />} label={`${p.ofensiva} dia${p.ofensiva === 1 ? '' : 's'}`} variant="outlined" color="warning" />
                  ) : (
                    '—'
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr' }, gap: 2 }}>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Evolução do aproveitamento
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Últimas 8 semanas
          </Typography>
          <Box sx={{ height: 180, mt: 1 }}>
            <ResponsiveContainer>
              <LineChart data={(evolucao.data ?? []).map((s) => ({ semana: dataBr(s.semana_inicio).slice(0, 5), aproveitamento: s.aproveitamento }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="semana" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} unit="%" width={38} />
                <RTooltip formatter={(v) => `${v}%`} />
                <Line type="monotone" dataKey="aproveitamento" stroke="#4f46e5" strokeWidth={2} connectNulls dot />
              </LineChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Qualidade do planejamento
          </Typography>
          {planejamento.data ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <LinhaMetrica rotulo="OS com dia e horário" valor={planejamento.data.os_com_dia_e_horario} />
              <LinhaMetrica rotulo="Duração revisada pelo gestor" valor={planejamento.data.duracao_revisada} ajuda="Depende do planejador com horário (doc 87)." />
              <LinhaMetrica rotulo="Perdas com responsável Empresa" valor={planejamento.data.perdas_responsavel_empresa} />
              {planejamento.data.carga_mais_desequilibrada && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2">Carga mais desequilibrada</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {planejamento.data.carga_mais_desequilibrada.promotor} {planejamento.data.carga_mais_desequilibrada.percentual > 0 ? '+' : ''}
                    {planejamento.data.carga_mais_desequilibrada.percentual}%
                  </Typography>
                </Box>
              )}
            </Box>
          ) : (
            <CircularProgress size={18} />
          )}
        </Paper>
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Aguardando avaliação
          </Typography>
          <Typography variant="caption" color="text.secondary">
            O XP só conta quando você aprovar
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
            {r.fila_avaliacao.length === 0 && <Typography variant="body2">Fila vazia.</Typography>}
            {r.fila_avaliacao.map((f) => (
              <Box key={f.id}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {f.formulario} · {f.loja}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {f.promotor} · +{f.xp} XP
                </Typography>
              </Box>
            ))}
            {r.kpis.aguardando_avaliacao > 0 && (
              <Button component={RouterLink} to="/avaliacoes-formulario" size="small" sx={{ alignSelf: 'flex-start' }}>
                Ver fila ({r.kpis.aguardando_avaliacao})
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

function Kpi({ titulo, valor, sub, destaque }: { titulo: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <Card variant="outlined" sx={destaque ? { borderColor: 'primary.main' } : undefined}>
      <CardContent>
        <Typography variant="caption" color="text.secondary">
          {titulo}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          {valor}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}

const CORES_PERDA = ['#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#84cc16', '#64748b', '#f97316', '#14b8a6'];

/** Barra única: realizado + cada perda + pendente, somando o possível. */
function Trilho({ regua }: { regua: ReguaXp }) {
  const total = Math.max(1, regua.kpis.possivel);
  const pedacos = [
    { rotulo: 'Realizado', xp: regua.kpis.realizado, cor: '#4f46e5' },
    ...regua.perdas.map((p, i) => ({ rotulo: p.rotulo, xp: p.xp, cor: CORES_PERDA[i % CORES_PERDA.length] })),
    { rotulo: 'Aguardando avaliação', xp: regua.kpis.pendente, cor: '#cbd5e1' },
  ].filter((p) => p.xp > 0);
  if (regua.kpis.possivel === 0) return null;
  return (
    <Box>
      <Box sx={{ display: 'flex', height: 18, borderRadius: 1, overflow: 'hidden', bgcolor: 'action.hover' }}>
        {pedacos.map((p) => (
          <Tooltip key={p.rotulo} title={`${p.rotulo}: ${fmt(p.xp)} XP`}>
            <Box sx={{ width: `${(p.xp / total) * 100}%`, bgcolor: p.cor }} />
          </Tooltip>
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 1 }}>
        {pedacos.map((p) => (
          <Box key={p.rotulo} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: p.cor }} />
            <Typography variant="caption">
              {p.rotulo} {fmt(p.xp)}
            </Typography>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function LinhaMetrica({ rotulo, valor, ajuda }: { rotulo: string; valor: number | null; ajuda?: string }) {
  return (
    <Tooltip title={ajuda ?? ''}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="body2">{rotulo}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {valor === null ? '—' : `${valor}%`}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function Ranking({ supervisor }: { supervisor?: string }) {
  const [semana, setSemana] = useState<PeriodoRanking>('atual');
  const query = useQuery({ queryKey: ['xp', 'ranking', semana, supervisor], queryFn: () => buscarRankingEquipe(semana, supervisor) });
  const r = query.data;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ToggleButtonGroup exclusive size="small" value={semana} onChange={(_, v) => v && setSemana(v)}>
        <ToggleButton value="atual">Esta semana</ToggleButton>
        <ToggleButton value="passada">Semana passada</ToggleButton>
        <ToggleButton value="mes">Este mês</ToggleButton>
        <ToggleButton value="mes_passado">Mês passado</ToggleButton>
      </ToggleButtonGroup>
      {query.isLoading && <CircularProgress />}
      {query.isError && <Alert severity="warning">A liga semanal está desligada nas Configurações ou não pôde ser carregada.</Alert>}
      {r && (
        <>
          <Typography variant="body2" color="text.secondary">
            {r.grupo} · {r.periodo === 'mes' ? mesTexto(r.semana_inicio) : `semana de ${dataBr(r.semana_inicio)}`} · {r.fechada ? 'fechado' : 'em andamento'} ·
            mínimo de {r.minimo_visitas} visitas agendadas pra entrar. O promotor vê só o pódio, a própria posição e quem está logo acima.
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>#</TableCell>
                  <TableCell>Promotor</TableCell>
                  <TableCell align="right">XP</TableCell>
                  <TableCell align="right">Plano</TableCell>
                  <TableCell align="right">Iniciativa</TableCell>
                  <TableCell align="right">Aproveitamento</TableCell>
                  <TableCell align="right">Visitas completas</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {r.linhas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Ninguém atingiu o mínimo de visitas nesta semana.
                    </TableCell>
                  </TableRow>
                )}
                {r.linhas.map((l) => (
                  <TableRow key={`${l.posicao}-${l.nome}`}>
                    <TableCell>{l.posicao}º</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        <UsuarioAvatar nome={l.nome} fotoUrl={l.foto_url} size={30} />
                        {l.nome}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{fmt(l.xp)}</TableCell>
                    <TableCell align="right">{fmt(l.plano ?? 0)}</TableCell>
                    <TableCell align="right">{fmt(l.iniciativa ?? 0)}</TableCell>
                    <TableCell align="right">{l.possivel ? `${Math.round(((l.plano ?? 0) / l.possivel) * 100)}%` : '—'}</TableCell>
                    <TableCell align="right">{l.visitas_completas ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}

function ValorGerado() {
  const [mes, setMes] = useState(hojeLocal().slice(0, 7));
  const query = useQuery({ queryKey: ['xp', 'valor', mes], queryFn: () => buscarValorGerado(mes) });
  const v = query.data;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField type="month" size="small" label="Mês" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} sx={{ width: 200 }} slotProps={{ inputLabel: { shrink: true } }} />
      {query.isLoading && <CircularProgress />}
      {v && (
        <>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {fmt(v.total_registros)} iniciativas no mês · {fmt(v.total_viraram_acao)} viraram ação · {fmt(v.planos_de_ocorrencias)} plano(s) de ação a partir
            de ocorrências
          </Typography>
          <Typography variant="body2" color="text.secondary">
            O que o campo trouxe além do plano: pontos extras, alertas de validade, estoque baixo, rupturas. É o retorno da operação que hoje
            ficaria invisível.
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Formulário</TableCell>
                  <TableCell align="right">Registros</TableCell>
                  <TableCell align="right">Viraram ação</TableCell>
                  <TableCell align="right">XP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {v.formularios.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      Nenhuma iniciativa no mês. Configure XP de iniciativa nos formulários.
                    </TableCell>
                  </TableRow>
                )}
                {v.formularios.map((f) => (
                  <TableRow key={f.formulario?.id ?? 'sem'}>
                    <TableCell>{f.formulario?.descricao ?? '—'}</TableCell>
                    <TableCell align="right">{fmt(f.registros)}</TableCell>
                    <TableCell align="right">{fmt(f.viraram_acao)}</TableCell>
                    <TableCell align="right">{fmt(f.xp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
}

import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import AddIcon from '@mui/icons-material/Add';
import BarChartIcon from '@mui/icons-material/BarChartOutlined';
import CalendarIcon from '@mui/icons-material/CalendarMonthOutlined';
import CategoryIcon from '@mui/icons-material/LabelOutlined';
import FunctionsIcon from '@mui/icons-material/Functions';
import NumbersIcon from '@mui/icons-material/Numbers';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import PieChartIcon from '@mui/icons-material/PieChartOutlineOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TableIcon from '@mui/icons-material/TableChartOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  InputAdornment,
  Menu,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { COMPARATIVO_LABELS } from '../../components/relatorios/Comparativo';
import { Visualizacao } from '../../components/relatoriosPersonalizados/Visualizacao';
import type { TipoComparativo } from '../../lib/api/relatorios';
import {
  atualizarRelatorioPersonalizado,
  buscarCatalogoEntidade,
  buscarOpcoesFiltro,
  buscarRelatorioPersonalizado,
  criarRelatorioPersonalizado,
  executarDefinicao,
  listarEntidadesRelatorio,
  type CampoCatalogo,
  type CatalogoEntidade,
  type DefinicaoRelatorio,
  type EntidadeRelatorio,
  type Agregacao,
  type Granularidade,
  type MetricaCatalogo,
  type PresetPeriodo,
  type RelatorioPersonalizado,
  type Visual,
} from '../../lib/api/relatoriosPersonalizados';
import { useAuth } from '../../lib/auth/AuthContext';
import { horus } from '../../theme';
import { FiltroDialog } from './FiltroDialog';
import { regraCompleta, resumoRegra, type RegraFiltro } from './filtros';
import { AGREGACAO_LABELS, GRANULARIDADE_LABELS, PRESET_LABELS } from './formatacao';

const MAX_AGRUPAMENTOS = 3;

type Zona = 'linhas' | 'colunas' | 'valores' | 'filtros';

interface Dimensao {
  campo: string;
  granularidade?: Granularidade;
}

interface Estado {
  entidade: EntidadeRelatorio;
  formulario?: string;
  campoPeriodo?: string;
  preset: PresetPeriodo | 'datas';
  inicio: string;
  fim: string;
  comparar: TipoComparativo | '';
  visual: Visual;
  linhas: Dimensao[];
  colunas: Dimensao[];
  valores: string[];
  filtros: RegraFiltro[];
  combinador: 'E' | 'OU';
  ordenar?: DefinicaoRelatorio['ordenar'];
}

/** O que está sendo arrastado: um campo/métrica da lista, ou um que já está numa área. */
interface Arrastavel {
  tipo: 'campo' | 'metrica';
  chave: string;
  /** Nível da data (Ano, Mês, Data…) quando vem da hierarquia de um campo de data. */
  granularidade?: Granularidade;
  origem?: { zona: Zona; indice: number };
}

let proximoIdRegra = 1;

function estadoInicial(): Estado {
  return {
    entidade: 'visita',
    preset: 'ultimos_30_dias',
    inicio: '',
    fim: '',
    comparar: '',
    visual: 'tabela',
    linhas: [],
    colunas: [],
    valores: [],
    filtros: [],
    combinador: 'E',
  };
}

function deDefinicao(d: DefinicaoRelatorio): Estado {
  const dimensao = (g: DefinicaoRelatorio['agrupar'][number]): Dimensao => ({ campo: g.campo, granularidade: g.granularidade });
  return {
    entidade: d.entidade,
    formulario: d.formulario,
    campoPeriodo: d.periodo.campo,
    preset: d.periodo.inicio ? 'datas' : (d.periodo.preset ?? 'ultimos_7_dias'),
    inicio: d.periodo.inicio ?? '',
    fim: d.periodo.fim ?? '',
    comparar: d.comparar ?? '',
    visual: d.visual ?? 'tabela',
    linhas: d.agrupar.filter((g) => (g.eixo ?? 'linha') === 'linha').map(dimensao),
    colunas: d.agrupar.filter((g) => g.eixo === 'coluna').map(dimensao),
    valores: d.metricas.map((m) => m.chave),
    filtros: d.filtros.regras.map((r) => ({
      id: proximoIdRegra++,
      campo: r.campo,
      operador: r.operador,
      valor: r.valor as RegraFiltro['valor'],
    })),
    combinador: d.filtros.combinador,
    ordenar: d.ordenar,
  };
}

function paraDefinicao(e: Estado): DefinicaoRelatorio {
  const chaves = [...e.linhas, ...e.colunas].map((d) => d.campo).concat(e.valores);
  return {
    entidade: e.entidade,
    ...(e.entidade === 'registro' && e.formulario ? { formulario: e.formulario } : {}),
    periodo:
      e.preset === 'datas'
        ? { campo: e.campoPeriodo, inicio: e.inicio, fim: e.fim }
        : { campo: e.campoPeriodo, preset: e.preset },
    filtros: {
      combinador: e.combinador,
      regras: e.filtros.filter(regraCompleta).map((r) => ({ campo: r.campo, operador: r.operador, valor: r.valor })),
    },
    agrupar: [
      ...e.linhas.map((d) => ({ campo: d.campo, granularidade: d.granularidade, eixo: 'linha' as const })),
      ...e.colunas.map((d) => ({ campo: d.campo, granularidade: d.granularidade, eixo: 'coluna' as const })),
    ],
    metricas: e.valores.map((chave) => ({ chave })),
    comparar: e.comparar || null,
    visual: e.visual,
    // A ordem salva só sobrevive se o campo/métrica continua no relatório.
    ...(e.ordenar && chaves.includes(e.ordenar.chave) ? { ordenar: e.ordenar } : {}),
  };
}

function useDebounced<T>(valor: T, ms: number): T {
  const [atrasado, setAtrasado] = useState(valor);
  useEffect(() => {
    const t = setTimeout(() => setAtrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);
  return atrasado;
}

function mensagemDeErro(erro: unknown, padrao: string): string {
  if (!axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(erro)) return padrao;
  const dados = erro.response?.data;
  return (dados?.errors && Object.values(dados.errors)[0]?.[0]) || dados?.message || padrao;
}

/**
 * Editor do gerador de relatórios (docs/60 §7, Fase 5), no espírito de tabela dinâmica / Power BI:
 * arrasta campos pra Linhas e Colunas (matriz), métricas pra Valores e campos pra Filtros; a
 * prévia é o próprio backend executando a definição (POST /executar) — nada calculado aqui.
 */
export function RelatorioEditorPage() {
  const { id } = useParams<{ id: string }>();
  const relatorioQuery = useQuery({
    queryKey: ['relatorios-personalizados', id],
    queryFn: () => buscarRelatorioPersonalizado(id!),
    enabled: Boolean(id),
  });
  const relatorio = relatorioQuery.data;

  if (!id) return <Editor />;
  if (relatorioQuery.isLoading) return <CircularProgress size={24} />;
  if (relatorioQuery.isError || !relatorio || !relatorio.pode_editar) {
    return (
      <Alert severity="error">
        {relatorio?.padrao ? 'Relatório padrão não pode ser editado. Duplique para editar.' : mensagemDeErro(relatorioQuery.error, 'Você não pode editar este relatório.')}
      </Alert>
    );
  }
  return <Editor key={relatorio.id} relatorio={relatorio} />;
}

function Editor({ relatorio }: { relatorio?: RelatorioPersonalizado }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const podeSalvar =
    usuario?.user_type === 'ADMIN' || (usuario?.perfil?.permissoes ?? []).includes('relatorios.personalizados.gerenciar');

  const [estado, setEstado] = useState<Estado | null>(() => (relatorio ? deDefinicao(relatorio.definicao) : estadoInicial()));
  const [busca, setBusca] = useState('');
  const [arrastando, setArrastando] = useState<Arrastavel | null>(null);
  const [menuCampo, setMenuCampo] = useState<{ ancora: HTMLElement; campo: CampoCatalogo; granularidade?: Granularidade } | null>(null);
  const [regraEmEdicao, setRegraEmEdicao] = useState<RegraFiltro | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const entidadesQuery = useQuery({ queryKey: ['relatorios-personalizados', 'entidades'], queryFn: listarEntidadesRelatorio });
  const catalogoQuery = useQuery({
    queryKey: ['relatorios-personalizados', 'catalogo', estado?.entidade, estado?.formulario],
    queryFn: () => buscarCatalogoEntidade(estado!.entidade, estado!.formulario),
    enabled: Boolean(estado),
    placeholderData: keepPreviousData,
  });
  const formulariosQuery = useQuery({
    queryKey: ['relatorios-personalizados', 'opcoes', 'formularios'],
    queryFn: () => buscarOpcoesFiltro('formularios', {}),
    enabled: estado?.entidade === 'registro',
  });
  const catalogo = catalogoQuery.data;

  // Filtros de relação vindos de um relatório salvo só têm o uuid: busca o rótulo pra mostrar no chip.
  const rotulosCarregados = useRef(false);
  useEffect(() => {
    if (!estado || !catalogo || rotulosCarregados.current) return;
    rotulosCarregados.current = true;
    estado.filtros.forEach((r) => {
      const campo = catalogo.campos.find((c) => c.chave === r.campo);
      if (campo?.tipo === 'relacao' && campo.fonte && Array.isArray(r.valor) && r.valor.length) {
        void buscarOpcoesFiltro(campo.fonte, { valores: r.valor }).then((ops) =>
          setEstado((e) => e && { ...e, filtros: e.filtros.map((f) => (f.id === r.id ? { ...f, rotulos: Object.fromEntries(ops.map((o) => [o.valor, o.rotulo])) } : f)) }),
        );
      }
    });
  }, [estado, catalogo]);

  const definicao = useMemo(() => (estado ? paraDefinicao(estado) : null), [estado]);
  const valida = Boolean(definicao && definicao.metricas.length > 0 && (estado!.preset !== 'datas' || (estado!.inicio && estado!.fim)));
  const definicaoAtrasada = useDebounced(valida ? definicao : null, 500);

  const previa = useQuery({
    queryKey: ['relatorios-personalizados', 'previa', definicaoAtrasada],
    queryFn: () => executarDefinicao(definicaoAtrasada!),
    enabled: Boolean(definicaoAtrasada),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const sensores = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const cabecalho = usePageHeader(
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="h6" noWrap>
          {relatorio ? relatorio.nome : 'Novo relatório'}
        </Typography>
        <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>
          Relatórios › {relatorio ? 'Editar' : 'Novo'}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button variant="outlined" onClick={() => navigate(relatorio ? `/relatorios-personalizados/${relatorio.id}` : '/relatorios-personalizados')}>
          Cancelar
        </Button>
        <Tooltip title={podeSalvar ? (valida ? '' : 'Adicione ao menos uma métrica em Valores') : 'Seu perfil não tem permissão para salvar relatórios'}>
          <span>
            <Button variant="contained" disabled={!podeSalvar || !valida} onClick={() => setSalvando(true)}>
              Salvar relatório
            </Button>
          </span>
        </Tooltip>
      </Box>
    </Box>,
  );

  if (!estado) return <CircularProgress size={24} />;

  const campoDe = (chave: string) => catalogo?.campos.find((c) => c.chave === chave);
  const metricaDe = (chave: string) => catalogo?.metricas.find((m) => m.chave === chave);
  const totalAgrupado = estado.linhas.length + estado.colunas.length;
  const alterar = (parcial: Partial<Estado>) => setEstado((e) => e && { ...e, ...parcial });

  function adicionarDimensao(zona: 'linhas' | 'colunas', campo: CampoCatalogo, origem?: Arrastavel['origem'], granularidade?: Granularidade) {
    setEstado((e) => {
      if (!e) return e;
      const movendoEntreEixos = origem && (origem.zona === 'linhas' || origem.zona === 'colunas');
      if (!movendoEntreEixos && e.linhas.length + e.colunas.length >= MAX_AGRUPAMENTOS) {
        setAviso(`Até ${MAX_AGRUPAMENTOS} campos entre Linhas e Colunas.`);
        return e;
      }
      // Movendo de uma área pra outra, a data leva o nível que já tinha.
      const nivelDaOrigem = origem && (origem.zona === 'linhas' || origem.zona === 'colunas') ? e[origem.zona][origem.indice]?.granularidade : undefined;
      const nivel = campo.tipo === 'data' ? (granularidade ?? nivelDaOrigem ?? 'dia') : undefined;
      const semOrigem = removerDaOrigem(e, origem);
      // A mesma data pode entrar em níveis diferentes (mês nas linhas × ano nas colunas), nunca repetida.
      if ([...semOrigem.linhas, ...semOrigem.colunas].some((d) => d.campo === campo.chave && d.granularidade === nivel)) {
        setAviso(`${campo.rotulo}${nivel ? ` · ${GRANULARIDADE_LABELS[nivel]}` : ''} já está no relatório.`);
        return e;
      }
      return { ...semOrigem, [zona]: [...semOrigem[zona], { campo: campo.chave, granularidade: nivel }] };
    });
  }

  function adicionarFiltro(campo: CampoCatalogo) {
    const operador = campo.operadores.includes('em') ? 'em' : campo.operadores[0];
    const regra: RegraFiltro = { id: proximoIdRegra++, campo: campo.chave, operador, valor: operador === 'igual' ? true : [] };
    setEstado((e) => e && { ...e, filtros: [...e.filtros, regra] });
    setRegraEmEdicao(regra);
  }

  function adicionarMetrica(chave: string) {
    setEstado((e) => (e && !e.valores.includes(chave) ? { ...e, valores: [...e.valores, chave] } : e));
  }

  // Operações possíveis sobre um campo (o backend manda cada uma como métrica com `campo`/`agregacao`).
  const agregacoesDe = (campo: string) => (catalogo?.metricas ?? []).filter((m) => m.campo === campo);

  function adicionarValorDeCampo(campo: string) {
    const opcoes = agregacoesDe(campo);
    if (opcoes.length === 0) return setAviso('Esse campo não tem operação para Valores.');
    const padrao = opcoes.find((m) => m.agregacao === 'soma') ?? opcoes.find((m) => m.agregacao === 'contagem_distinta') ?? opcoes[0];
    adicionarMetrica(padrao.chave);
  }

  function trocarAgregacao(chaveAtual: string, nova: string) {
    setEstado((e) => (e && !e.valores.includes(nova) ? { ...e, valores: e.valores.map((v) => (v === chaveAtual ? nova : v)) } : e));
  }

  function aoSoltar(evento: DragEndEvent) {
    setArrastando(null);
    const item = evento.active.data.current as Arrastavel | undefined;
    const zona = evento.over?.id as Zona | undefined;
    if (!item || !zona || zona === item.origem?.zona) return;

    if (item.tipo === 'metrica') {
      if (zona === 'valores') adicionarMetrica(item.chave);
      return;
    }
    // Campo em Valores = operação sobre ele (contagem distinta, soma…).
    if (zona === 'valores') return adicionarValorDeCampo(item.chave);
    const campo = campoDe(item.chave);
    if (!campo) return setAviso('Esse campo só pode ir para Valores.');
    if (zona === 'filtros') {
      if (campo.operadores.length === 0) return setAviso(`${campo.rotulo} não pode ser usado como filtro — o período já filtra por ele.`);
      adicionarFiltro(campo);
    } else if (zona === 'linhas' || zona === 'colunas') {
      if (!campo.agrupavel) return;
      adicionarDimensao(zona, campo, item.origem, item.granularidade);
    }
  }

  const termo = busca.trim().toLowerCase();
  const camposVisiveis = (catalogo?.campos ?? []).filter(
    (c) =>
      (c.agrupavel || c.operadores.length > 0) &&
      (c.rotulo.toLowerCase().includes(termo) || (c.granularidades ?? []).some((g) => GRANULARIDADE_LABELS[g].toLowerCase().includes(termo))),
  );
  const metricasVisiveis = (catalogo?.metricas ?? []).filter((m) => !m.agregacao && m.rotulo.toLowerCase().includes(termo));
  // Campos que só servem pra Valores (perguntas de número/texto): não são de agrupar nem filtrar.
  const camposSoDeValor = [
    ...new Map(
      (catalogo?.metricas ?? [])
        .filter((m) => m.campo && m.agregacao && !catalogo?.campos.some((c) => c.chave === m.campo))
        .map((m) => [m.campo!, { chave: m.campo!, rotulo: m.campo_rotulo ?? m.campo!, grupo: m.grupo }]),
    ).values(),
  ].filter((c) => c.rotulo.toLowerCase().includes(termo));
  type CampoDeValor = { chave: string; rotulo: string; grupo?: string };
  const outrosGrupos = [
    ...new Set([...camposVisiveis.map((c) => c.grupo), ...metricasVisiveis.map((m) => m.grupo), ...camposSoDeValor.map((c) => c.grupo)].filter((g): g is string => Boolean(g))),
  ];
  const gruposDaLista: { titulo: string; campos: CampoCatalogo[]; deValor: CampoDeValor[]; metricas: MetricaCatalogo[] }[] = [
    { titulo: 'Métricas', campos: [], deValor: [], metricas: metricasVisiveis.filter((m) => !m.grupo) },
    { titulo: 'Campos', campos: camposVisiveis.filter((c) => !c.grupo), deValor: camposSoDeValor.filter((c) => !c.grupo), metricas: [] },
    ...outrosGrupos.map((grupo) => ({
      titulo: grupo,
      campos: camposVisiveis.filter((c) => c.grupo === grupo),
      deValor: camposSoDeValor.filter((c) => c.grupo === grupo),
      metricas: metricasVisiveis.filter((m) => m.grupo === grupo),
    })),
  ].filter((g) => g.campos.length + g.deValor.length + g.metricas.length > 0);

  // Trocar de formulário tira o que era pergunta do anterior (chaves "resposta:", "media:"…).
  function trocarFormulario(formulario: string) {
    const dePergunta = (chave: string) => chave.includes(':') || (formulario !== '' && chave === 'formulario');
    setEstado((e) =>
      e && {
        ...e,
        formulario: formulario || undefined,
        linhas: e.linhas.filter((d) => !dePergunta(d.campo)),
        colunas: e.colunas.filter((d) => !dePergunta(d.campo)),
        valores: e.valores.filter((v) => !dePergunta(v)),
        filtros: e.filtros.filter((f) => !dePergunta(f.campo)),
      },
    );
  }

  return (
    <DndContext sensors={sensores} onDragStart={(e: DragStartEvent) => setArrastando(e.active.data.current as Arrastavel)} onDragEnd={aoSoltar} onDragCancel={() => setArrastando(null)}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {cabecalho}
        {!podeSalvar && <Alert severity="info">Você pode montar e ver o relatório, mas seu perfil não tem permissão para salvá-lo.</Alert>}
        {aviso && (
          <Alert severity="warning" onClose={() => setAviso(null)}>
            {aviso}
          </Alert>
        )}

        {/* Configuração geral */}
        <Paper sx={{ p: { xs: 1.75, md: 2 }, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            select
            label="Analisar"
            value={estado.entidade}
            sx={{ width: 210 }}
            onChange={(e) => {
              const vazio = !estado.linhas.length && !estado.colunas.length && !estado.valores.length && !estado.filtros.length;
              if (vazio || window.confirm('Trocar o que analisar limpa os campos escolhidos. Continuar?')) {
                setEstado({ ...estadoInicial(), entidade: e.target.value as EntidadeRelatorio, preset: estado.preset, inicio: estado.inicio, fim: estado.fim, comparar: estado.comparar, visual: estado.visual });
              }
            }}
          >
            {(entidadesQuery.data ?? [{ chave: estado.entidade, rotulo: catalogo?.rotulo ?? '' }]).map((e) => (
              <MenuItem key={e.chave} value={e.chave}>
                {e.rotulo}
              </MenuItem>
            ))}
          </TextField>
          {estado.entidade === 'registro' && (
            <TextField select label="Formulário" value={estado.formulario ?? ''} sx={{ width: 230 }} onChange={(e) => trocarFormulario(e.target.value)}>
              <MenuItem value="">Todos os formulários</MenuItem>
              {(formulariosQuery.data ?? []).map((f) => (
                <MenuItem key={f.valor} value={f.valor}>
                  {f.rotulo}
                </MenuItem>
              ))}
            </TextField>
          )}
          <TextField select label="Período" value={estado.preset} sx={{ width: 180 }} onChange={(e) => alterar({ preset: e.target.value as Estado['preset'] })}>
            {(Object.keys(PRESET_LABELS) as PresetPeriodo[]).map((p) => (
              <MenuItem key={p} value={p}>
                {PRESET_LABELS[p]}
              </MenuItem>
            ))}
            <MenuItem value="datas">Datas fixas</MenuItem>
          </TextField>
          {estado.preset === 'datas' && (
            <>
              <TextField type="date" label="De" value={estado.inicio} onChange={(e) => alterar({ inicio: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
              <TextField type="date" label="Até" value={estado.fim} onChange={(e) => alterar({ fim: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
            </>
          )}
          <TextField select label="Comparar com" value={estado.comparar} sx={{ width: 250 }} onChange={(e) => alterar({ comparar: e.target.value as TipoComparativo | '' })}>
            <MenuItem value="">Não comparar</MenuItem>
            {(Object.keys(COMPARATIVO_LABELS) as TipoComparativo[]).map((t) => (
              <MenuItem key={t} value={t}>
                {COMPARATIVO_LABELS[t]}
              </MenuItem>
            ))}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup exclusive size="small" value={estado.visual} onChange={(_, v: Visual | null) => v && alterar({ visual: v })} aria-label="Visual">
            {(
              [
                ['tabela', 'Tabela', <TableIcon key="t" />],
                ['barra', 'Barras', <BarChartIcon key="b" />],
                ['linha', 'Linhas', <ShowChartIcon key="l" />],
                ['pizza', 'Pizza', <PieChartIcon key="p" />],
              ] as [Visual, string, ReactNode][]
            ).map(([valor, rotulo, icone]) => (
              <ToggleButton key={valor} value={valor} aria-label={rotulo} sx={{ gap: 0.75, px: 1.25, '& svg': { fontSize: 17 } }}>
                {icone}
                <Box component="span" sx={{ display: { xs: 'none', md: 'inline' } }}>
                  {rotulo}
                </Box>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Paper>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '250px minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
          {/* Campos disponíveis — no desktop fica preso na tela e rola por dentro (busca sempre visível),
              pra dar pra achar e arrastar o campo sem perder as áreas de soltar de vista. */}
          <Paper
            sx={{
              p: 1.75,
              position: { md: 'sticky' },
              top: { md: 80 },
              display: 'flex',
              flexDirection: 'column',
              maxHeight: { xs: 360, md: 'calc(100vh - 100px)' },
              minHeight: 0,
            }}
          >
            <TextField
              fullWidth
              placeholder="Buscar campo"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 17 }} /></InputAdornment> } }}
            />
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', mx: -1.75, px: 1.75, pb: 0.5 }}>
              {catalogoQuery.isLoading && <CircularProgress size={20} sx={{ mt: 2 }} />}
              {estado.entidade === 'registro' && !estado.formulario && (
                <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 1.5, px: 0.5 }}>
                  Escolha um formulário no topo para usar as perguntas dele.
                </Typography>
              )}
              {gruposDaLista.map((g) => (
                <Box key={g.titulo}>
                  <RotuloGrupo>{g.titulo}</RotuloGrupo>
                  <Stack spacing={0.5}>
                    {g.campos.map((c) =>
                      c.tipo === 'data' ? (
                        <Box key={c.chave}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: 30, px: 1, color: 'text.secondary', '& svg': { fontSize: 16 } }}>
                            <CalendarIcon />
                            <Typography noWrap sx={{ fontSize: 13, fontWeight: 500, color: 'text.primary' }}>
                              {c.rotulo}
                            </Typography>
                          </Box>
                          <Stack spacing={0.5} sx={{ pl: 2.25, borderLeft: `1px solid ${horus.borda}`, ml: 1.75 }}>
                            {(c.granularidades ?? []).map((nivel) => (
                              <ItemLista
                                key={nivel}
                                id={`campo:${c.chave}:${nivel}`}
                                dados={{ tipo: 'campo', chave: c.chave, granularidade: nivel }}
                                rotulo={GRANULARIDADE_LABELS[nivel]}
                                icone={<CalendarIcon />}
                                onClick={(ancora) => setMenuCampo({ ancora, campo: c, granularidade: nivel })}
                              />
                            ))}
                          </Stack>
                        </Box>
                      ) : (
                        <ItemLista
                          key={c.chave}
                          id={`campo:${c.chave}`}
                          dados={{ tipo: 'campo', chave: c.chave }}
                          rotulo={c.rotulo}
                          icone={<CategoryIcon />}
                          onClick={(ancora) => setMenuCampo({ ancora, campo: c })}
                        />
                      ),
                    )}
                    {g.deValor.map((c) => (
                      <ItemLista
                        key={c.chave}
                        id={`valor:${c.chave}`}
                        dados={{ tipo: 'campo', chave: c.chave }}
                        rotulo={c.rotulo}
                        dica="Arraste para Valores e escolha a operação"
                        icone={<NumbersIcon />}
                        usado={estado.valores.some((v) => agregacoesDe(c.chave).some((m) => m.chave === v))}
                        onClick={() => adicionarValorDeCampo(c.chave)}
                      />
                    ))}
                    {g.metricas.map((m) => (
                      <ItemLista
                        key={m.chave}
                        id={`metrica:${m.chave}`}
                        dados={{ tipo: 'metrica', chave: m.chave }}
                        rotulo={m.rotulo}
                        dica={m.descricao}
                        icone={<FunctionsIcon />}
                        usado={estado.valores.includes(m.chave)}
                        onClick={() => adicionarMetrica(m.chave)}
                      />
                    ))}
                  </Stack>
                </Box>
              ))}
            </Box>
          </Paper>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            {/* Áreas de soltar */}
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
              <AreaSoltar zona="linhas" titulo="Linhas" dica="Arraste campos para agrupar" ativo={arrastando?.tipo === 'campo'}>
                {estado.linhas.map((d, i) => (
                  <ChipDimensao key={`${d.campo}:${d.granularidade ?? ''}`} zona="linhas" indice={i} dim={d} campo={campoDe(d.campo)} setEstado={setEstado} />
                ))}
              </AreaSoltar>
              <AreaSoltar zona="colunas" titulo="Colunas" dica="Arraste um campo para virar matriz" ativo={arrastando?.tipo === 'campo'}>
                {estado.colunas.map((d, i) => (
                  <ChipDimensao key={`${d.campo}:${d.granularidade ?? ''}`} zona="colunas" indice={i} dim={d} campo={campoDe(d.campo)} setEstado={setEstado} />
                ))}
              </AreaSoltar>
              <AreaSoltar zona="valores" titulo="Valores" dica="Arraste métricas ou campos" ativo={Boolean(arrastando)}>
                {estado.valores.map((chave) => (
                  <ChipValor
                    key={chave}
                    metrica={metricaDe(chave)}
                    chave={chave}
                    opcoes={metricaDe(chave)?.campo ? agregacoesDe(metricaDe(chave)!.campo!) : []}
                    onTrocar={(nova) => trocarAgregacao(chave, nova)}
                    onRemover={() => alterar({ valores: estado.valores.filter((v) => v !== chave) })}
                  />
                ))}
              </AreaSoltar>
              <AreaSoltar
                zona="filtros"
                titulo="Filtros"
                dica="Arraste campos para filtrar"
                ativo={arrastando?.tipo === 'campo'}
                extra={
                  estado.filtros.length > 1 && (
                    <ToggleButtonGroup exclusive size="small" value={estado.combinador} onChange={(_, v: 'E' | 'OU' | null) => v && alterar({ combinador: v })} sx={{ '& .MuiToggleButton-root': { height: 24, px: 1, fontSize: 11.5 } }}>
                      <ToggleButton value="E">Todos (E)</ToggleButton>
                      <ToggleButton value="OU">Qualquer (OU)</ToggleButton>
                    </ToggleButtonGroup>
                  )
                }
              >
                {estado.filtros.map((r) => (
                  <Chip
                    key={r.id}
                    label={resumoRegra(r, campoDe(r.campo))}
                    color={regraCompleta(r) ? 'secondary' : 'default'}
                    onClick={() => setRegraEmEdicao(r)}
                    onDelete={() => alterar({ filtros: estado.filtros.filter((f) => f.id !== r.id) })}
                  />
                ))}
              </AreaSoltar>
            </Box>

            {/* Prévia */}
            <Paper sx={{ p: { xs: 1.75, md: 2.5 }, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
                  Prévia
                </Typography>
                {previa.data && (
                  <Typography sx={{ fontSize: 12.5, color: 'text.secondary' }}>
                    {previa.data.periodo.data_inicio.split('-').reverse().join('/')} a {previa.data.periodo.data_fim.split('-').reverse().join('/')}
                  </Typography>
                )}
                {previa.isFetching && <CircularProgress size={14} sx={{ alignSelf: 'center' }} />}
              </Box>
              {!valida && (
                <Typography sx={{ color: 'text.secondary' }}>
                  Arraste uma métrica para <b>Valores</b> e campos para <b>Linhas</b> para ver o resultado.
                </Typography>
              )}
              {valida && previa.isError && <Alert severity="error">{mensagemDeErro(previa.error, 'Não foi possível montar o relatório.')}</Alert>}
              {valida && previa.data && <Visualizacao resultado={previa.data} visual={estado.visual} />}
            </Paper>
          </Box>
        </Box>
      </Box>

      <DragOverlay dropAnimation={null}>
        {arrastando && (
          <Chip
            label={
              arrastando.tipo === 'metrica'
                ? metricaDe(arrastando.chave)?.rotulo
                : `${campoDe(arrastando.chave)?.rotulo ?? ''}${arrastando.granularidade ? ` · ${GRANULARIDADE_LABELS[arrastando.granularidade]}` : ''}`
            }
            color={arrastando.tipo === 'metrica' ? 'primary' : 'default'}
            sx={{ boxShadow: '0 8px 24px rgba(27,27,43,.15)', bgcolor: arrastando.tipo === 'metrica' ? undefined : horus.painel, border: `1px solid ${horus.bordaCampo}` }}
          />
        )}
      </DragOverlay>

      <Menu anchorEl={menuCampo?.ancora} open={Boolean(menuCampo)} onClose={() => setMenuCampo(null)}>
        {menuCampo?.campo.agrupavel && (
          <MenuItem disabled={totalAgrupado >= MAX_AGRUPAMENTOS} onClick={() => { adicionarDimensao('linhas', menuCampo.campo, undefined, menuCampo.granularidade); setMenuCampo(null); }}>
            Adicionar em Linhas
          </MenuItem>
        )}
        {menuCampo?.campo.agrupavel && (
          <MenuItem disabled={totalAgrupado >= MAX_AGRUPAMENTOS} onClick={() => { adicionarDimensao('colunas', menuCampo.campo, undefined, menuCampo.granularidade); setMenuCampo(null); }}>
            Adicionar em Colunas
          </MenuItem>
        )}
        {menuCampo && !menuCampo.granularidade && agregacoesDe(menuCampo.campo.chave).length > 0 && (
          <MenuItem onClick={() => { adicionarValorDeCampo(menuCampo.campo.chave); setMenuCampo(null); }}>Adicionar em Valores</MenuItem>
        )}
        {menuCampo && menuCampo.campo.operadores.length > 0 && (
          <MenuItem onClick={() => { adicionarFiltro(menuCampo.campo); setMenuCampo(null); }}>Filtrar por este campo</MenuItem>
        )}
      </Menu>

      <FiltroDialog
        key={regraEmEdicao?.id ?? 'nenhuma'}
        regra={regraEmEdicao}
        campo={regraEmEdicao ? campoDe(regraEmEdicao.campo) : undefined}
        onFechar={() => {
          // Filtro novo fechado sem valor some, pra não ficar regra pela metade.
          setEstado((e) => e && { ...e, filtros: e.filtros.filter((f) => f.id !== regraEmEdicao?.id || regraCompleta(f)) });
          setRegraEmEdicao(null);
        }}
        onSalvar={(r) => {
          setEstado((e) => e && { ...e, filtros: e.filtros.map((f) => (f.id === r.id ? r : f)) });
          setRegraEmEdicao(null);
        }}
      />

      {salvando && definicao && (
        <SalvarDialog
          inicial={relatorio}
          catalogo={catalogo}
          onFechar={() => setSalvando(false)}
          onSalvo={(r) => {
            void queryClient.invalidateQueries({ queryKey: ['relatorios-personalizados'] });
            navigate(`/relatorios-personalizados/${r.id}`);
          }}
          salvar={(dados) =>
            relatorio ? atualizarRelatorioPersonalizado(relatorio.id, { ...dados, definicao }) : criarRelatorioPersonalizado({ ...dados, definicao })
          }
        />
      )}
    </DndContext>
  );
}

/** Item de Valores: métrica própria, ou "Operação de Campo" com menu pra trocar a operação. */
function ChipValor({
  metrica,
  chave,
  opcoes,
  onTrocar,
  onRemover,
}: {
  metrica: MetricaCatalogo | undefined;
  chave: string;
  opcoes: MetricaCatalogo[];
  onTrocar: (chave: string) => void;
  onRemover: () => void;
}) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const agregacao = metrica?.agregacao as Agregacao | undefined;
  if (!metrica?.campo || !agregacao) {
    return <Chip icon={<FunctionsIcon />} label={metrica?.rotulo ?? chave} color="primary" onDelete={onRemover} />;
  }
  return (
    <>
      <Chip
        icon={<FunctionsIcon />}
        label={
          <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
            <b>{AGREGACAO_LABELS[agregacao]}</b>&nbsp;de {metrica.campo_rotulo}
            <ArrowDropDownIcon sx={{ fontSize: 18, ml: 0.25 }} />
          </Box>
        }
        color="primary"
        onClick={(e) => setAncora(e.currentTarget)}
        onDelete={onRemover}
        aria-label={`Operação de ${metrica.campo_rotulo}`}
      />
      <Menu anchorEl={ancora} open={Boolean(ancora)} onClose={() => setAncora(null)}>
        {[...opcoes]
          .sort((a, b) => Object.keys(AGREGACAO_LABELS).indexOf(a.agregacao!) - Object.keys(AGREGACAO_LABELS).indexOf(b.agregacao!))
          .map((m) => (
            <MenuItem key={m.chave} selected={m.chave === chave} onClick={() => { onTrocar(m.chave); setAncora(null); }}>
              {AGREGACAO_LABELS[m.agregacao!]}
            </MenuItem>
          ))}
      </Menu>
    </>
  );
}

function removerDaOrigem(e: Estado, origem?: Arrastavel['origem']): Estado {
  if (!origem || (origem.zona !== 'linhas' && origem.zona !== 'colunas')) return e;
  return { ...e, [origem.zona]: e[origem.zona].filter((_, i) => i !== origem.indice) };
}

function RotuloGrupo({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'text.disabled', mt: 2, mb: 0.75, px: 0.5 }}>
      {children}
    </Typography>
  );
}

/** Campo/métrica da lista da esquerda: arrastável, e clicável como alternativa ao arrastar. */
function ItemLista({
  id,
  dados,
  rotulo,
  icone,
  dica,
  usado,
  onClick,
}: {
  id: string;
  dados: Arrastavel;
  rotulo: string;
  icone: ReactNode;
  dica?: string;
  usado?: boolean;
  onClick: (ancora: HTMLElement) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id, data: dados });
  return (
    <Tooltip title={dica ?? ''} placement="right">
      <Box
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        onClick={(e) => onClick(e.currentTarget)}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          height: 32,
          px: 1,
          borderRadius: '6px',
          border: `1px solid ${horus.borda}`,
          bgcolor: usado ? horus.indigoClaro : horus.painel,
          color: usado ? horus.indigoEscuro : 'text.primary',
          cursor: 'grab',
          opacity: isDragging ? 0.4 : 1,
          touchAction: 'none',
          userSelect: 'none',
          '&:hover': { borderColor: horus.indigo, bgcolor: horus.indigoClaro },
          '& svg': { fontSize: 16, color: dados.tipo === 'metrica' ? horus.indigo : 'text.secondary' },
        }}
      >
        {icone}
        <Typography noWrap sx={{ flex: 1, fontSize: 13 }}>
          {rotulo}
        </Typography>
        <AddIcon sx={{ fontSize: '15px !important', color: 'text.disabled' }} />
      </Box>
    </Tooltip>
  );
}

function AreaSoltar({ zona, titulo, dica, ativo, extra, children }: { zona: Zona; titulo: string; dica: string; ativo: boolean; extra?: ReactNode; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: zona });
  const vazio = !(Array.isArray(children) ? children.length : children);
  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 1.5,
        minHeight: 96,
        borderStyle: ativo ? 'dashed' : 'solid',
        borderColor: isOver ? horus.indigo : ativo ? horus.bordaCampo : undefined,
        bgcolor: isOver ? horus.indigoClaro : undefined,
        transition: 'background-color .12s, border-color .12s',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 600 }}>{titulo}</Typography>
        {extra}
      </Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {vazio ? <Typography sx={{ fontSize: 12.5, color: 'text.disabled' }}>{dica}</Typography> : children}
      </Box>
    </Paper>
  );
}

/** Campo já em Linhas/Colunas: arrastável pra outra área, granularidade nas datas, remover. */
function ChipDimensao({
  zona,
  indice,
  dim,
  campo,
  setEstado,
}: {
  zona: 'linhas' | 'colunas';
  indice: number;
  dim: Dimensao;
  campo: CampoCatalogo | undefined;
  setEstado: (fn: (e: Estado | null) => Estado | null) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${zona}:${dim.campo}:${dim.granularidade ?? ''}`,
    data: { tipo: 'campo', chave: dim.campo, granularidade: dim.granularidade, origem: { zona, indice } } satisfies Arrastavel,
  });
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const trocarGranularidade = (g: Granularidade) =>
    setEstado((e) => e && { ...e, [zona]: e[zona].map((d, i) => (i === indice ? { ...d, granularidade: g } : d)) });

  return (
    <>
      <Chip
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        icon={campo?.tipo === 'data' ? <CalendarIcon /> : <CategoryIcon />}
        label={campo?.tipo === 'data' && dim.granularidade ? `${campo.rotulo} · ${GRANULARIDADE_LABELS[dim.granularidade]}` : (campo?.rotulo ?? dim.campo)}
        onClick={campo?.tipo === 'data' ? (e) => setAncora(e.currentTarget) : undefined}
        onDelete={() => setEstado((e) => e && { ...e, [zona]: e[zona].filter((_, i) => i !== indice) })}
        variant="outlined"
        sx={{ bgcolor: horus.painel, cursor: 'grab', opacity: isDragging ? 0.4 : 1, touchAction: 'none' }}
      />
      <Menu anchorEl={ancora} open={Boolean(ancora)} onClose={() => setAncora(null)}>
        {(campo?.granularidades ?? []).map((g) => (
          <MenuItem key={g} selected={g === dim.granularidade} onClick={() => { trocarGranularidade(g); setAncora(null); }}>
            {GRANULARIDADE_LABELS[g]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

function SalvarDialog({
  inicial,
  catalogo,
  onFechar,
  onSalvo,
  salvar,
}: {
  inicial: { nome: string; descricao: string | null; compartilhado: boolean } | undefined;
  catalogo: CatalogoEntidade | undefined;
  onFechar: () => void;
  onSalvo: (r: { id: string }) => void;
  salvar: (dados: { nome: string; descricao: string | null; compartilhado: boolean }) => Promise<{ id: string }>;
}) {
  const [nome, setNome] = useState(inicial?.nome ?? '');
  const [descricao, setDescricao] = useState(inicial?.descricao ?? '');
  const [compartilhado, setCompartilhado] = useState(inicial?.compartilhado ?? false);
  const mutation = useMutation({ mutationFn: () => salvar({ nome: nome.trim(), descricao: descricao.trim() || null, compartilhado }), onSuccess: onSalvo });

  return (
    <Dialog open onClose={() => !mutation.isPending && onFechar()} maxWidth="xs" fullWidth>
      <DialogTitle>{inicial ? 'Salvar alterações' : 'Salvar relatório'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Nome" value={nome} onChange={(e) => setNome(e.target.value)} autoFocus required slotProps={{ htmlInput: { maxLength: 120 } }} />
          <TextField
            label="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder={catalogo ? `Ex.: ${catalogo.rotulo.toLowerCase()} por promotor no mês` : ''}
            multiline
            minRows={2}
            slotProps={{ htmlInput: { maxLength: 500 } }}
          />
          <FormControlLabel control={<Switch checked={compartilhado} onChange={(e) => setCompartilhado(e.target.checked)} />} label="Visível para toda a empresa" />
          {mutation.isError && <Alert severity="error">{mensagemDeErro(mutation.error, 'Não foi possível salvar o relatório.')}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={mutation.isPending}>
          Cancelar
        </Button>
        <Button variant="contained" disabled={!nome.trim() || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Salvando…' : 'Salvar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


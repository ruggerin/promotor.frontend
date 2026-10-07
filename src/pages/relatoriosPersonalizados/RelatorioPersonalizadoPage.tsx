import BarChartIcon from '@mui/icons-material/BarChartOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import FilterListIcon from '@mui/icons-material/FilterList';
import PieChartIcon from '@mui/icons-material/PieChartOutlineOutlined';
import QueryStatsIcon from '@mui/icons-material/QueryStatsOutlined';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import TableIcon from '@mui/icons-material/TableChartOutlined';
import { Alert, Box, Button, Chip, CircularProgress, Menu, MenuItem, Paper, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { COMPARATIVO_LABELS } from '../../components/relatorios/Comparativo';
import { Visualizacao } from '../../components/relatoriosPersonalizados/Visualizacao';
import type { TipoComparativo } from '../../lib/api/relatorios';
import {
  buscarCatalogoEntidade,
  buscarRelatorioPersonalizado,
  duplicarRelatorioPersonalizado,
  excluirRelatorioPersonalizado,
  executarRelatorioPersonalizado,
  type CampoCatalogo,
  type ParametrosExecucao,
  type PresetPeriodo,
  type ResultadoRelatorio,
  type Visual,
} from '../../lib/api/relatoriosPersonalizados';
import { useAuth } from '../../lib/auth/AuthContext';
import { baixarCsv } from '../../lib/csv';
import { horus } from '../../theme';
import { FiltroDialog } from './FiltroDialog';
import { FixarNoMenuButton } from './FixarNoMenuButton';
import { regraCompleta, resumoRegra, type RegraFiltro } from './filtros';
import { ENTIDADE_LABELS, PRESET_LABELS, formatarData } from './formatacao';

let proximoIdFiltro = 1;

const VISUAIS: [Visual, string, ReactNode][] = [
  ['tabela', 'Tabela', <TableIcon key="t" />],
  ['barra', 'Barras', <BarChartIcon key="b" />],
  ['linha', 'Linhas', <ShowChartIcon key="l" />],
  ['pizza', 'Pizza', <PieChartIcon key="p" />],
];

function mensagemDeErro(erro: unknown, padrao: string): string {
  return axios.isAxiosError<{ message?: string }>(erro) ? (erro.response?.data.message ?? padrao) : padrao;
}

/**
 * Execução de um relatório salvo do gerador (docs/60 §7): período, comparativo e visual trocam só
 * nesta tela (o salvo não muda); KPIs, quebras, matriz e totais vêm prontos do backend.
 */
export function RelatorioPersonalizadoPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario } = useAuth();
  const podeGerenciar =
    usuario?.user_type === 'ADMIN' || (usuario?.perfil?.permissoes ?? []).includes('relatorios.personalizados.gerenciar');

  // '' = usa o período salvo no relatório; 'datas' = intervalo escolhido à mão.
  const [preset, setPreset] = useState<PresetPeriodo | 'datas' | ''>('');
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  // undefined = usa o comparativo/visual salvos.
  const [comparar, setComparar] = useState<TipoComparativo | '' | undefined>(undefined);
  const [visual, setVisual] = useState<Visual | undefined>(undefined);
  // Filtros rápidos: só nesta tela, somados aos filtros salvos do relatório.
  const [filtros, setFiltros] = useState<RegraFiltro[]>([]);
  const [regraEmEdicao, setRegraEmEdicao] = useState<RegraFiltro | null>(null);
  const [menuFiltro, setMenuFiltro] = useState<HTMLElement | null>(null);

  const relatorioQuery = useQuery({ queryKey: ['relatorios-personalizados', id], queryFn: () => buscarRelatorioPersonalizado(id) });
  const relatorio = relatorioQuery.data;
  const catalogoQuery = useQuery({
    queryKey: ['relatorios-personalizados', 'catalogo', relatorio?.entidade, relatorio?.definicao.formulario],
    queryFn: () => buscarCatalogoEntidade(relatorio!.entidade, relatorio!.definicao.formulario),
    enabled: Boolean(relatorio),
  });
  const campoDe = (chave: string) => catalogoQuery.data?.campos.find((c) => c.chave === chave);
  const filtraveis = (catalogoQuery.data?.campos ?? []).filter((c) => c.operadores.length > 0);

  const params: ParametrosExecucao = {};
  if (preset === 'datas' && inicio && fim) {
    params.data_inicio = inicio;
    params.data_fim = fim;
  } else if (preset && preset !== 'datas') {
    params.preset = preset;
  }
  if (comparar !== undefined) params.comparar = comparar || 'nenhum';
  const filtrosProntos = filtros.filter(regraCompleta);
  if (filtrosProntos.length) {
    params.filtros = JSON.stringify(filtrosProntos.map((r) => ({ campo: r.campo, operador: r.operador, valor: r.valor })));
  }

  function novoFiltro(campo: CampoCatalogo) {
    const operador = campo.operadores.includes('em') ? 'em' : campo.operadores[0];
    const regra: RegraFiltro = { id: proximoIdFiltro++, campo: campo.chave, operador, valor: operador === 'igual' ? true : [] };
    setFiltros((f) => [...f, regra]);
    setRegraEmEdicao(regra);
  }

  const execucao = useQuery({
    queryKey: ['relatorios-personalizados', id, 'executar', params],
    queryFn: () => executarRelatorioPersonalizado(id, params),
    enabled: Boolean(relatorio) && (preset !== 'datas' || Boolean(inicio && fim)),
    placeholderData: keepPreviousData,
  });
  const resultado = execucao.data;

  const duplicar = useMutation({
    mutationFn: () => duplicarRelatorioPersonalizado(id),
    onSuccess: (copia) => {
      void queryClient.invalidateQueries({ queryKey: ['relatorios-personalizados'] });
      navigate(`/relatorios-personalizados/${copia.id}/editar`);
    },
  });
  const excluir = useMutation({
    mutationFn: () => excluirRelatorioPersonalizado(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['relatorios-personalizados'] });
      navigate('/relatorios-personalizados');
    },
  });

  const visualAtual = visual ?? relatorio?.definicao.visual ?? 'tabela';
  const comparandoAgora = comparar === undefined ? (relatorio?.definicao.comparar ?? '') : comparar;

  const cabecalho = usePageHeader(
    relatorio ? (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" noWrap>
              {relatorio.nome}
            </Typography>
            {relatorio.padrao && <Chip label="Padrão" size="small" color="primary" />}
          </Box>
          <Typography noWrap sx={{ fontSize: 12.5, color: 'text.secondary' }}>
            Relatórios › {ENTIDADE_LABELS[relatorio.entidade] ?? relatorio.entidade}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <FixarNoMenuButton relatorio={relatorio} />
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            disabled={!resultado || resultado.linhas.length === 0}
            onClick={() => resultado && exportarCsv(relatorio.nome, resultado)}
          >
            Exportar CSV
          </Button>
          {podeGerenciar && relatorio.pode_editar && (
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              disabled={excluir.isPending}
              onClick={() => window.confirm(`Excluir o relatório "${relatorio.nome}"?`) && excluir.mutate()}
            >
              Excluir
            </Button>
          )}
          {podeGerenciar && !relatorio.pode_editar && (
            <Button variant="outlined" startIcon={<ContentCopyIcon />} disabled={duplicar.isPending} onClick={() => duplicar.mutate()}>
              Duplicar para editar
            </Button>
          )}
          {podeGerenciar && relatorio.pode_editar && (
            <Button variant="contained" startIcon={<EditIcon />} onClick={() => navigate(`/relatorios-personalizados/${relatorio.id}/editar`)}>
              Editar
            </Button>
          )}
        </Box>
      </Box>
    ) : null,
  );

  if (relatorioQuery.isLoading) return <CircularProgress size={24} />;
  if (relatorioQuery.isError || !relatorio) {
    return <Alert severity="error">{mensagemDeErro(relatorioQuery.error, 'Relatório não encontrado.')}</Alert>;
  }

  const presetSalvo = relatorio.definicao.periodo.preset;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {cabecalho}
      {(duplicar.isError || excluir.isError) && (
        <Alert severity="error">{mensagemDeErro(duplicar.error ?? excluir.error, 'Não foi possível concluir a ação.')}</Alert>
      )}

      <Paper sx={{ p: { xs: 1.75, md: 2.5 } }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', flexWrap: 'wrap', mb: 2 }}>
          <Box sx={{ width: 34, height: 34, borderRadius: '6px', bgcolor: horus.indigoClaro, color: horus.indigo, display: 'grid', placeItems: 'center', flex: 'none' }}>
            <QueryStatsIcon sx={{ fontSize: 18 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600 }}>
              {relatorio.descricao || 'Resultado'}
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: 12.5 }}>
              {resultado ? `${formatarData(resultado.periodo.data_inicio)} a ${formatarData(resultado.periodo.data_fim)}` : ' '}
              {resultado?.comparativo &&
                ` · comparando com ${formatarData(resultado.comparativo.periodo.data_inicio)} a ${formatarData(resultado.comparativo.periodo.data_fim)}`}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField select label="Período" value={preset} onChange={(e) => setPreset(e.target.value as PresetPeriodo | 'datas' | '')} sx={{ width: 190 }}>
              <MenuItem value="">{presetSalvo ? `${PRESET_LABELS[presetSalvo]} (salvo)` : 'Período salvo'}</MenuItem>
              {(Object.keys(PRESET_LABELS) as PresetPeriodo[])
                .filter((p) => p !== presetSalvo)
                .map((p) => (
                  <MenuItem key={p} value={p}>
                    {PRESET_LABELS[p]}
                  </MenuItem>
                ))}
              <MenuItem value="datas">Escolher datas</MenuItem>
            </TextField>
            {preset === 'datas' && (
              <>
                <TextField type="date" label="De" value={inicio} onChange={(e) => setInicio(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                <TextField type="date" label="Até" value={fim} onChange={(e) => setFim(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
              </>
            )}
            <TextField select label="Comparar com" value={comparandoAgora} onChange={(e) => setComparar(e.target.value as TipoComparativo | '')} sx={{ width: 250 }}>
              <MenuItem value="">Não comparar</MenuItem>
              {(Object.keys(COMPARATIVO_LABELS) as TipoComparativo[]).map((t) => (
                <MenuItem key={t} value={t}>
                  {COMPARATIVO_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>
            <Button variant="outlined" startIcon={<FilterListIcon />} disabled={filtraveis.length === 0} onClick={(e) => setMenuFiltro(e.currentTarget)}>
              Filtrar
            </Button>
            <ToggleButtonGroup exclusive size="small" value={visualAtual} onChange={(_, v: Visual | null) => v && setVisual(v)} aria-label="Visual">
              {VISUAIS.map(([valor, rotulo, icone]) => (
                <ToggleButton key={valor} value={valor} aria-label={rotulo} title={rotulo} sx={{ px: 1, '& svg': { fontSize: 17 } }}>
                  {icone}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </Box>

        {filtros.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
            <Typography sx={{ fontSize: 12.5, color: 'text.secondary', mr: 0.5 }}>Filtrando por</Typography>
            {filtros.map((r) => (
              <Chip
                key={r.id}
                label={resumoRegra(r, campoDe(r.campo))}
                color={regraCompleta(r) ? 'secondary' : 'default'}
                onClick={() => setRegraEmEdicao(r)}
                onDelete={() => setFiltros((f) => f.filter((x) => x.id !== r.id))}
              />
            ))}
            <Button size="small" variant="text" onClick={() => setFiltros([])}>
              Limpar filtros
            </Button>
          </Box>
        )}

        {execucao.isError && <Alert severity="error">{mensagemDeErro(execucao.error, 'Não foi possível executar o relatório.')}</Alert>}
        {execucao.isLoading && <CircularProgress size={22} />}
        {resultado && <Visualizacao resultado={resultado} visual={visualAtual} />}
      </Paper>

      <Menu anchorEl={menuFiltro} open={Boolean(menuFiltro)} onClose={() => setMenuFiltro(null)}>
        {filtraveis.map((c) => (
          <MenuItem
            key={c.chave}
            onClick={() => {
              novoFiltro(c);
              setMenuFiltro(null);
            }}
          >
            {c.rotulo}
          </MenuItem>
        ))}
      </Menu>

      <FiltroDialog
        key={regraEmEdicao?.id ?? 'nenhuma'}
        regra={regraEmEdicao}
        campo={regraEmEdicao ? campoDe(regraEmEdicao.campo) : undefined}
        onFechar={() => {
          // Filtro novo fechado sem valor some, pra não ficar regra pela metade.
          setFiltros((f) => f.filter((x) => x.id !== regraEmEdicao?.id || regraCompleta(x)));
          setRegraEmEdicao(null);
        }}
        onSalvar={(r) => {
          setFiltros((f) => f.map((x) => (x.id === r.id ? r : x)));
          setRegraEmEdicao(null);
        }}
      />
    </Box>
  );
}

function exportarCsv(nome: string, resultado: ResultadoRelatorio): void {
  const colunas = resultado.colunas.filter((c) => c.tipo !== 'distribuicao');
  const arquivo = `${nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-')}-${resultado.periodo.data_inicio}-a-${resultado.periodo.data_fim}.csv`;
  baixarCsv(
    arquivo,
    colunas.map((c) => (c.tipo === 'minutos' ? `${c.rotulo} (min)` : c.rotulo)),
    resultado.linhas.map((l) =>
      colunas.map((c) => {
        if (c.tipo === 'dimensao') return l.dimensoes[c.chave]?.rotulo ?? '';
        const v = l.valores[c.chave];
        return typeof v === 'number' || typeof v === 'string' ? v : null;
      }),
    ),
  );
}

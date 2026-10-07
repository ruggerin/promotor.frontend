import DownloadIcon from '@mui/icons-material/Download';
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { FiltroPeriodo, hojeISO } from '../../components/relatorios/FiltroPeriodo';
import { SeletorPontoVenda } from '../../components/relatorios/SeletorPontoVenda';
import { SeletorComparativo, Variacao } from '../../components/relatorios/Comparativo';
import { AlternarVisao, GraficoCumprimento, type Visao } from '../../components/relatorios/Graficos';
import { baixarPdfVisitasPlanejadas, buscarVisitasPlanejadasXExecutadas, type TipoComparativo, type TotalPlanejadoExecutado } from '../../lib/api/relatorios';
import { baixarBlob, baixarCsv } from '../../lib/csv';
import { listarUsuarios } from '../../lib/api/usuarios';
import { horus } from '../../theme';

const RESPONSAVEL_ROTULOS: Record<string, string> = {
  PROMOTOR: 'Promotor',
  LOJA: 'Loja',
  EMPRESA: 'Empresa',
  OUTRO: 'Outro',
  NAO_INFORMADO: 'Sem informação (antes do registro de motivo)',
};

function formatarDia(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function Percentual({ valor }: { valor: number | null }) {
  if (valor === null) return <>—</>;
  return <Chip size="small" label={`${valor}%`} color={valor >= 90 ? 'success' : valor >= 60 ? 'warning' : 'error'} />;
}

function Kpi({ rotulo, valor, cor, extra }: { rotulo: string; valor: number | string; cor?: string; extra?: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2, flex: '1 1 140px' }}>
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: cor }}>
        {valor}
      </Typography>
      {extra}
    </Paper>
  );
}

/**
 * Relatório "Visitas planejadas × executadas" (docs/28 §2.1): cruza as Ordens de Serviço com prazo
 * no período (o planejado) com as Visitas (o executado), por dia e promotor.
 */
export function VisitasPlanejadasPage() {
  const [inicio, setInicio] = useState(hojeISO(-6));
  const [fim, setFim] = useState(hojeISO());
  const [promotorUuid, setPromotorUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [comparar, setComparar] = useState<TipoComparativo | ''>('');
  const [visao, setVisao] = useState<Visao>('tabela');

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Cumprimento de visitas" />);

  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores-relatorio'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', por_pagina: 200 }),
  });

  const query = useQuery({
    queryKey: ['relatorio-visitas-planejadas', { inicio, fim, promotorUuid, pontoVendaUuid, comparar }],
    queryFn: () =>
      buscarVisitasPlanejadasXExecutadas({ data_inicio: inicio, data_fim: fim, usuario_uuid: promotorUuid, ponto_venda_uuid: pontoVendaUuid, comparar: comparar || null }),
    enabled: Boolean(inicio && fim),
  });

  const pdfMutation = useMutation({
    mutationFn: () =>
      baixarPdfVisitasPlanejadas({ data_inicio: inicio, data_fim: fim, usuario_uuid: promotorUuid, ponto_venda_uuid: pontoVendaUuid }),
    onSuccess: (blob) => baixarBlob(`cumprimento-visitas-${inicio}-a-${fim}.pdf`, blob),
  });

  const erro =
    axios.isAxiosError<{ message?: string }>(query.error) ? (query.error.response?.data.message ?? 'Não foi possível carregar o relatório.') : null;
  const total: TotalPlanejadoExecutado | undefined = query.data?.total;
  const comp: TotalPlanejadoExecutado | undefined = query.data?.comparativo?.total;

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compara o que foi <strong>planejado</strong> (Ordens de Serviço com prazo no período) com o que foi{' '}
        <strong>executado</strong>. Visita espontânea é a que aconteceu sem Ordem de Serviço — fica de fora do
        percentual de cumprimento. Ordens canceladas não entram no planejado, mas são contadas à parte — com quem causou e o motivo. O
        “cumprimento ajustado” soma ao planejado as visitas canceladas por culpa do promotor: faltar e justificar
        não melhora o número dele.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <FiltroPeriodo inicio={inicio} fim={fim} onChange={(i, f) => { setInicio(i); setFim(f); }} />
        <Autocomplete
          size="small"
          sx={{ width: 260 }}
          options={promotoresQuery.data?.usuarios ?? []}
          getOptionLabel={(u) => u.nome}
          loading={promotoresQuery.isLoading}
          onChange={(_, u) => setPromotorUuid(u?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Promotor" />}
        />
        <SeletorPontoVenda onChange={setPontoVendaUuid} />
        <SeletorComparativo valor={comparar} onChange={setComparar} />
      </Box>
      {query.data?.comparativo && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Comparando com {formatarDia(query.data.comparativo.periodo.data_inicio)} a {formatarDia(query.data.comparativo.periodo.data_fim)}.
        </Typography>
      )}

      <Box sx={{ mb: 2 }}>
        <AlternarVisao valor={visao} onChange={setVisao} />
      </Box>

      <Button
        size="small"
        startIcon={<PictureAsPdfIcon />}
        disabled={!query.data || query.data.linhas.length === 0 || pdfMutation.isPending}
        sx={{ mb: 2, mr: 1 }}
        onClick={() => pdfMutation.mutate()}
      >
        {pdfMutation.isPending ? 'Gerando PDF...' : 'Exportar PDF'}
      </Button>
      <Button
        size="small"
        startIcon={<DownloadIcon />}
        disabled={!query.data || query.data.linhas.length === 0}
        sx={{ mb: 2 }}
        onClick={() =>
          baixarCsv(
            `cumprimento-visitas-${inicio}-a-${fim}.csv`,
            ['Dia', 'Promotor', 'Planejadas', 'Cumpridas', 'Em andamento', 'Atrasadas', 'A vencer', 'Canceladas', 'Espontaneas', 'Cumprimento (%)', 'Cumprimento ajustado (%)'],
            (query.data?.linhas ?? []).map((l) => [
              formatarDia(l.data), l.promotor?.nome ?? 'Fila aberta', l.planejadas, l.cumpridas, l.em_andamento,
              l.atrasadas, l.a_vencer, l.canceladas, l.espontaneas, l.percentual_cumprimento, l.percentual_cumprimento_ajustado,
            ]),
          )
        }
      >
        Exportar CSV
      </Button>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      {total && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Kpi rotulo="Planejadas" valor={total.planejadas} extra={<Variacao atual={total.planejadas} anterior={comp?.planejadas} />} />
          <Kpi rotulo="Cumpridas" valor={total.cumpridas} cor="#16a34a" extra={<Variacao atual={total.cumpridas} anterior={comp?.cumpridas} />} />
          <Kpi rotulo="Em andamento" valor={total.em_andamento} />
          <Kpi rotulo="Atrasadas" valor={total.atrasadas} cor={total.atrasadas > 0 ? '#dc2626' : undefined} extra={<Variacao atual={total.atrasadas} anterior={comp?.atrasadas} melhorQuandoMaior={false} />} />
          <Kpi rotulo="A vencer" valor={total.a_vencer} />
          <Kpi rotulo="Canceladas" valor={total.canceladas} cor={total.canceladas > 0 ? horus.ambarEscuro : undefined} extra={<Variacao atual={total.canceladas} anterior={comp?.canceladas} melhorQuandoMaior={false} />} />
          <Kpi rotulo="Espontâneas" valor={total.espontaneas} />
          <Kpi rotulo="Cumprimento" valor={total.percentual_cumprimento === null ? '—' : `${total.percentual_cumprimento}%`} extra={<Variacao atual={total.percentual_cumprimento} anterior={comp?.percentual_cumprimento} sufixo="%" />} />
          <Kpi rotulo="Cumprimento ajustado" valor={total.percentual_cumprimento_ajustado === null ? '—' : `${total.percentual_cumprimento_ajustado}%`} extra={<Variacao atual={total.percentual_cumprimento_ajustado} anterior={comp?.percentual_cumprimento_ajustado} sufixo="%" />} />
        </Box>
      )}

      {total && total.canceladas > 0 && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Visitas canceladas no período
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {Object.entries(total.canceladas_por_responsavel).map(([responsavel, qtd]) => (
              <Chip key={responsavel} size="small" label={`${RESPONSAVEL_ROTULOS[responsavel] ?? responsavel}: ${qtd}`} color={responsavel === 'PROMOTOR' ? 'warning' : 'default'} />
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {total.canceladas_por_motivo.map((m) => (
              <Chip key={m.motivo} size="small" variant="outlined" label={`${m.motivo}: ${m.quantidade}`} />
            ))}
          </Box>
        </Paper>
      )}

      {visao === 'grafico' && query.data && (
        <Paper sx={{ p: 2 }}>
          <GraficoCumprimento linhas={query.data.linhas} />
        </Paper>
      )}

      {visao === 'tabela' && (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Dia</TableCell>
              <TableCell>Promotor</TableCell>
              <TableCell align="right">Planejadas</TableCell>
              <TableCell align="right">Cumpridas</TableCell>
              <TableCell align="right">Em andamento</TableCell>
              <TableCell align="right">Atrasadas</TableCell>
              <TableCell align="right">A vencer</TableCell>
              <TableCell align="right">Canceladas</TableCell>
              <TableCell align="right">Espontâneas</TableCell>
              <TableCell align="right">Cumprimento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.data?.linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  Nada planejado nem executado nesse período.
                </TableCell>
              </TableRow>
            )}
            {query.data?.linhas.map((l) => (
              <TableRow key={`${l.data}-${l.promotor?.id ?? 'fila'}`} hover>
                <TableCell>{formatarDia(l.data)}</TableCell>
                <TableCell>{l.promotor?.nome ?? <em>Fila aberta (sem promotor)</em>}</TableCell>
                <TableCell align="right">{l.planejadas}</TableCell>
                <TableCell align="right">{l.cumpridas}</TableCell>
                <TableCell align="right">{l.em_andamento}</TableCell>
                <TableCell align="right" sx={{ color: l.atrasadas > 0 ? 'error.main' : undefined, fontWeight: l.atrasadas > 0 ? 700 : undefined }}>
                  {l.atrasadas}
                </TableCell>
                <TableCell align="right">{l.a_vencer}</TableCell>
                <TableCell align="right">{l.canceladas}</TableCell>
                <TableCell align="right">{l.espontaneas}</TableCell>
                <TableCell align="right">
                  <Percentual valor={l.percentual_cumprimento} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </Box>
  );
}

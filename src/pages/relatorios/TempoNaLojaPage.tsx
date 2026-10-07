import DownloadIcon from '@mui/icons-material/Download';
import { Alert, Autocomplete, Box, Button, CircularProgress, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { SeletorComparativo, Variacao } from '../../components/relatorios/Comparativo';
import { AlternarMedida, AlternarVisao, GraficoTempo, type MedidaTempo, type Visao } from '../../components/relatorios/Graficos';
import { FiltroPeriodo, hojeISO } from '../../components/relatorios/FiltroPeriodo';
import { SeletorPontoVenda } from '../../components/relatorios/SeletorPontoVenda';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { buscarTempoNaLoja, type AgruparTempoNaLoja, type TipoComparativo } from '../../lib/api/relatorios';
import { listarUsuarios } from '../../lib/api/usuarios';
import { baixarCsv } from '../../lib/csv';

const AGRUPAR_LABELS: Record<AgruparTempoNaLoja, string> = { loja: 'Por loja', promotor: 'Por promotor', rede: 'Por rede', dia: 'Por dia' };

export function formatarMinutos(min: number | null | undefined): string {
  if (min === null || min === undefined) return '—';
  return min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, '0')}min` : `${min} min`;
}

function formatarDia(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function Kpi({ rotulo, valor, extra }: { rotulo: string; valor: string; extra?: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2, flex: '1 1 150px' }}>
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700 }}>
        {valor}
      </Typography>
      {extra}
    </Paper>
  );
}

/**
 * "Tempo dentro do PDV" (docs/59 §4.2): duração do check-in ao checkout menos o tempo fora da
 * loja (afastamento, docs/49) — a mesma conta do "Tempo em loja" da Rota do Dia. Visita sem
 * checkout, cancelada ou fora de 2 min–12 h fica fora da média.
 */
export function TempoNaLojaPage() {
  const [inicio, setInicio] = useState(hojeISO(-29));
  const [fim, setFim] = useState(hojeISO());
  const [agrupar, setAgrupar] = useState<AgruparTempoNaLoja>('loja');
  const [promotorUuid, setPromotorUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [redeUuid, setRedeUuid] = useState<string | null>(null);
  const [comparar, setComparar] = useState<TipoComparativo | ''>('');
  const [visao, setVisao] = useState<Visao>('tabela');
  const [medida, setMedida] = useState<MedidaTempo>('media');

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Tempo no PDV" />);

  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores-relatorio'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', por_pagina: 200 }),
  });
  const redesQuery = useQuery({ queryKey: ['redes-lojas', 'relatorio-tempo'], queryFn: () => listarRedesLojas({ ativo: true }) });

  const query = useQuery({
    queryKey: ['relatorio-tempo-na-loja', { inicio, fim, agrupar, promotorUuid, pontoVendaUuid, redeUuid, comparar }],
    queryFn: () =>
      buscarTempoNaLoja({
        data_inicio: inicio,
        data_fim: fim,
        agrupar,
        usuario_uuid: promotorUuid,
        ponto_venda_uuid: pontoVendaUuid,
        rede_loja_uuid: redeUuid,
        comparar: comparar || null,
      }),
    enabled: Boolean(inicio && fim),
  });

  const erro = axios.isAxiosError<{ message?: string }>(query.error)
    ? (query.error.response?.data.message ?? 'Não foi possível carregar o relatório.')
    : null;
  const total = query.data?.total;
  const comp = query.data?.comparativo?.total;
  const linhas = query.data?.linhas ?? [];

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Quanto tempo os promotores ficam <strong>dentro</strong> da loja — do check-in ao checkout, descontando o tempo
        em que estiveram fora do raio. Visitas sem checkout, canceladas ou com duração fora de 2 min a 12 h não entram
        na média e aparecem como “desconsideradas”.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2, alignItems: 'center' }}>
        <FiltroPeriodo inicio={inicio} fim={fim} onChange={(i, f) => { setInicio(i); setFim(f); }} />
        <Autocomplete
          size="small"
          sx={{ width: 240 }}
          options={promotoresQuery.data?.usuarios ?? []}
          getOptionLabel={(u) => u.nome}
          loading={promotoresQuery.isLoading}
          onChange={(_, u) => setPromotorUuid(u?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Promotor" />}
        />
        <SeletorPontoVenda onChange={setPontoVendaUuid} />
        <TextField select size="small" label="Rede" value={redeUuid ?? ''} onChange={(e) => setRedeUuid(e.target.value || null)} sx={{ width: 200 }}>
          <MenuItem value="">Todas</MenuItem>
          {(redesQuery.data?.redes_lojas ?? []).map((r) => (
            <MenuItem key={r.id} value={r.id}>
              {r.descricao}
            </MenuItem>
          ))}
        </TextField>
        <SeletorComparativo valor={comparar} onChange={setComparar} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <ToggleButtonGroup size="small" exclusive value={agrupar} onChange={(_, v: AgruparTempoNaLoja | null) => v && setAgrupar(v)}>
          {(Object.keys(AGRUPAR_LABELS) as AgruparTempoNaLoja[]).map((a) => (
            <ToggleButton key={a} value={a} sx={{ textTransform: 'none' }}>
              {AGRUPAR_LABELS[a]}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <AlternarMedida valor={medida} onChange={setMedida} />
        <AlternarVisao valor={visao} onChange={setVisao} />
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          disabled={linhas.length === 0}
          onClick={() =>
            baixarCsv(
              `tempo-no-pdv-${agrupar}-${inicio}-a-${fim}.csv`,
              [AGRUPAR_LABELS[agrupar], 'Visitas', 'Tempo total (min)', 'Média (min)', 'Mediana (min)', 'Itens trabalhados', 'Minutos por item'],
              linhas.map((l) => [l.nome, l.visitas, l.tempo_total_minutos, l.media_minutos, l.mediana_minutos, l.itens_trabalhados, l.minutos_por_item]),
            )
          }
        >
          Exportar CSV
        </Button>
        {query.data?.comparativo && (
          <Typography variant="caption" color="text.secondary">
            Comparando com {formatarDia(query.data.comparativo.periodo.data_inicio)} a {formatarDia(query.data.comparativo.periodo.data_fim)}.
          </Typography>
        )}
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erro}
        </Alert>
      )}

      {total && (
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
          <Kpi rotulo="Visitas consideradas" valor={String(total.visitas)} extra={<Variacao atual={total.visitas} anterior={comp?.visitas} />} />
          <Kpi rotulo="Tempo total" valor={formatarMinutos(total.tempo_total_minutos)} extra={<Variacao atual={total.tempo_total_minutos} anterior={comp?.tempo_total_minutos} sufixo=" min" />} />
          <Kpi rotulo="Tempo médio" valor={formatarMinutos(total.media_minutos)} extra={<Variacao atual={total.media_minutos} anterior={comp?.media_minutos} sufixo=" min" />} />
          <Kpi rotulo="Mediana" valor={formatarMinutos(total.mediana_minutos)} />
          <Kpi rotulo="Itens trabalhados" valor={total.itens_trabalhados === null ? 'sem informação' : String(total.itens_trabalhados)} />
          <Kpi rotulo="Min por item" valor={total.minutos_por_item === null ? 'sem informação' : String(total.minutos_por_item).replace('.', ',')} />
          <Kpi rotulo="Desconsideradas" valor={String(total.desconsideradas)} />
        </Box>
      )}

      {visao === 'grafico' && query.data && (
        <Paper sx={{ p: 2 }}>
          <GraficoTempo linhas={linhas} comparando={Boolean(comparar)} medida={medida} porDia={agrupar === 'dia'} />
        </Paper>
      )}

      {visao === 'tabela' && (
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{agrupar === 'dia' ? 'Dia' : AGRUPAR_LABELS[agrupar].replace('Por ', '')}</TableCell>
              <TableCell align="right">Visitas</TableCell>
              <TableCell align="right" sx={medida === 'soma' ? { fontWeight: 700 } : undefined}>Tempo total</TableCell>
              <TableCell align="right" sx={medida === 'media' ? { fontWeight: 700 } : undefined}>Média</TableCell>
              <TableCell align="right">Mediana</TableCell>
              <TableCell align="right">Itens</TableCell>
              <TableCell align="right">Min/item</TableCell>
              {comparar && <TableCell align="right">Média no comparativo</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={comparar ? 8 : 7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={comparar ? 8 : 7} align="center" sx={{ py: 4 }}>
                  Não temos visitas com checkout nesse período.
                </TableCell>
              </TableRow>
            )}
            {linhas.map((l) => (
              <TableRow key={l.chave} hover>
                <TableCell>{agrupar === 'dia' ? formatarDia(l.nome) : l.nome}</TableCell>
                <TableCell align="right">{l.visitas}</TableCell>
                <TableCell align="right" sx={medida === 'soma' ? { fontWeight: 700 } : undefined}>{formatarMinutos(l.tempo_total_minutos)}</TableCell>
                <TableCell align="right" sx={medida === 'media' ? { fontWeight: 700 } : undefined}>
                  {formatarMinutos(l.media_minutos)}
                  <Variacao atual={l.media_minutos} anterior={l.media_minutos_comparativo} sufixo=" min" />
                </TableCell>
                <TableCell align="right">{formatarMinutos(l.mediana_minutos)}</TableCell>
                <TableCell align="right">{l.itens_trabalhados ?? '—'}</TableCell>
                <TableCell align="right">{l.minutos_por_item === null ? '—' : String(l.minutos_por_item).replace('.', ',')}</TableCell>
                {comparar && <TableCell align="right">{formatarMinutos(l.media_minutos_comparativo)}</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      )}
    </Box>
  );
}

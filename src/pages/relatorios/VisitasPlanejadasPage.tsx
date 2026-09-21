import DownloadIcon from '@mui/icons-material/Download';
import { Alert, Autocomplete, Box, Button, Chip, CircularProgress, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import { useMutation, useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { FiltroPeriodo, hojeISO } from '../../components/relatorios/FiltroPeriodo';
import { SeletorPontoVenda } from '../../components/relatorios/SeletorPontoVenda';
import { baixarPdfVisitasPlanejadas, buscarVisitasPlanejadasXExecutadas, type TotalPlanejadoExecutado } from '../../lib/api/relatorios';
import { baixarBlob, baixarCsv } from '../../lib/csv';
import { listarUsuarios } from '../../lib/api/usuarios';

function formatarDia(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function Percentual({ valor }: { valor: number | null }) {
  if (valor === null) return <>—</>;
  return <Chip size="small" label={`${valor}%`} color={valor >= 90 ? 'success' : valor >= 60 ? 'warning' : 'error'} />;
}

function Kpi({ rotulo, valor, cor }: { rotulo: string; valor: number | string; cor?: string }) {
  return (
    <Paper sx={{ p: 2, flex: '1 1 140px' }}>
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
      <Typography variant="h5" sx={{ fontWeight: 700, color: cor }}>
        {valor}
      </Typography>
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

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Cumprimento de visitas
    </Typography>,
  );

  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores-relatorio'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', por_pagina: 200 }),
  });

  const query = useQuery({
    queryKey: ['relatorio-visitas-planejadas', { inicio, fim, promotorUuid, pontoVendaUuid }],
    queryFn: () =>
      buscarVisitasPlanejadasXExecutadas({ data_inicio: inicio, data_fim: fim, usuario_uuid: promotorUuid, ponto_venda_uuid: pontoVendaUuid }),
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

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Compara o que foi <strong>planejado</strong> (Ordens de Serviço com prazo no período) com o que foi{' '}
        <strong>executado</strong>. Visita espontânea é a que aconteceu sem Ordem de Serviço — fica de fora do
        percentual de cumprimento. Ordens canceladas ou aguardando aprovação não entram no planejado.
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
            ['Dia', 'Promotor', 'Planejadas', 'Cumpridas', 'Em andamento', 'Atrasadas', 'A vencer', 'Espontaneas', 'Cumprimento (%)'],
            (query.data?.linhas ?? []).map((l) => [
              formatarDia(l.data), l.promotor?.nome ?? 'Fila aberta', l.planejadas, l.cumpridas, l.em_andamento,
              l.atrasadas, l.a_vencer, l.espontaneas, l.percentual_cumprimento,
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
          <Kpi rotulo="Planejadas" valor={total.planejadas} />
          <Kpi rotulo="Cumpridas" valor={total.cumpridas} cor="#16a34a" />
          <Kpi rotulo="Em andamento" valor={total.em_andamento} />
          <Kpi rotulo="Atrasadas" valor={total.atrasadas} cor={total.atrasadas > 0 ? '#dc2626' : undefined} />
          <Kpi rotulo="A vencer" valor={total.a_vencer} />
          <Kpi rotulo="Espontâneas" valor={total.espontaneas} />
          <Kpi rotulo="Cumprimento" valor={total.percentual_cumprimento === null ? '—' : `${total.percentual_cumprimento}%`} />
        </Box>
      )}

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
              <TableCell align="right">Espontâneas</TableCell>
              <TableCell align="right">Cumprimento</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={9} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.data?.linhas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center">
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
                <TableCell align="right">{l.espontaneas}</TableCell>
                <TableCell align="right">
                  <Percentual valor={l.percentual_cumprimento} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

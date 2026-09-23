import { Autocomplete, Box, Chip, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../components/DataTable';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarUsuarios } from '../../lib/api/usuarios';
import { listarVisitas } from '../../lib/api/visitas';
import type { StatusVisita, Visita } from '../../types/api';

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const STATUS_COLORS: Record<StatusVisita, 'warning' | 'success' | 'default'> = {
  ABERTA: 'warning',
  FINALIZADA: 'success',
  CANCELADA: 'default',
};

const STATUS_LABELS: Record<StatusVisita, string> = {
  ABERTA: 'Aberta',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const coluna = createColumnHelper<Visita>();

export function VisitasListPage() {
  const navigate = useNavigate();
  // MUI TablePagination é 0-indexed, a API é 1-indexed — a conversão acontece na hora de
  // montar a query.
  const [page, setPage] = useState(0);
  // Padrão "hoje" nas duas pontas — sem isso a tela carrega com TODA visita já feita, ficando
  // cheia demais pra ser útil de cara (mesmo raciocínio do Painel de Atividades).
  const [dataInicio, setDataInicio] = useState(hojeISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [usuarioUuid, setUsuarioUuid] = useState<string | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusVisita | ''>('');

  // Só a primeira página de cada lista — suficiente pros dados de teste de agora; se a
  // empresa tiver mais de 15 promotores/PDVs, a API precisaria de um jeito de listar tudo
  // (ela ainda não aceita ?per_page= customizado).
  const usuariosQuery = useQuery({
    queryKey: ['usuarios', 'promotores'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR' }),
  });

  const pontosVendaQuery = useQuery({
    queryKey: ['pontos-venda', 'filtro'],
    queryFn: () => listarPontosVenda(),
  });

  const visitasQuery = useQuery({
    queryKey: ['visitas', { page, dataInicio, dataFim, usuarioUuid, pontoVendaUuid, status }],
    queryFn: () =>
      listarVisitas({
        page: page + 1,
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        usuario_uuid: usuarioUuid ?? undefined,
        ponto_venda_uuid: pontoVendaUuid ?? undefined,
        status: status || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const perPage = visitasQuery.data?.meta.per_page ?? 15;

  // Ordena só as linhas já carregadas nesta página (ver DataTable) — a paginação em si continua
  // vindo do backend, sem endpoint de sort próprio ainda.
  const colunas = useMemo(
    () => [
      coluna.accessor((visita) => visita.ponto_venda?.fantasia ?? '', {
        id: 'ponto_venda',
        header: 'Ponto de venda',
      }),
      coluna.accessor((visita) => visita.usuario?.nome ?? '', {
        id: 'usuario',
        header: 'Promotor',
      }),
      coluna.accessor((visita) => new Date(visita.inicio_data).getTime(), {
        id: 'inicio',
        header: 'Início',
        cell: (info) => new Date(info.row.original.inicio_data).toLocaleString('pt-BR'),
      }),
      coluna.accessor((visita) => (visita.fim_data ? new Date(visita.fim_data).getTime() : 0), {
        id: 'fim',
        header: 'Fim',
        cell: (info) => {
          const fimData = info.row.original.fim_data;
          return fimData ? new Date(fimData).toLocaleString('pt-BR') : '—';
        },
      }),
      coluna.accessor('status', {
        header: 'Status',
        cell: (info) => <Chip label={info.getValue()} color={STATUS_COLORS[info.getValue()]} size="small" />,
      }),
      coluna.accessor('inicio_distancia_metros', {
        header: 'Distância check-in',
        cell: (info) => `${Math.round(info.getValue())}m`,
        meta: { align: 'right' },
      }),
    ],
    [],
  );

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Visitas
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      {/* Larguras explícitas nos 5 campos (em vez de deixar o TextField de data ocupar o que
          quiser) — sem isso a barra passava de ~1140px disponíveis em 1440px de tela e "Status"
          quebrava sozinho pra uma segunda linha (docs/30-CRITICA-UX-ADMIN-WEB.md §4). */}
      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          label="Data início"
          type="date"
          size="small"
          sx={{ width: 160 }}
          slotProps={{ inputLabel: { shrink: true } }}
          value={dataInicio}
          onChange={(e) => {
            setPage(0);
            setDataInicio(e.target.value);
          }}
        />
        <TextField
          label="Data fim"
          type="date"
          size="small"
          sx={{ width: 160 }}
          slotProps={{ inputLabel: { shrink: true } }}
          value={dataFim}
          onChange={(e) => {
            setPage(0);
            setDataFim(e.target.value);
          }}
        />
        <Autocomplete
          size="small"
          sx={{ width: 240 }}
          options={usuariosQuery.data?.usuarios ?? []}
          getOptionLabel={(option) => option.nome}
          loading={usuariosQuery.isLoading}
          onChange={(_, value) => {
            setPage(0);
            setUsuarioUuid(value?.id ?? null);
          }}
          renderInput={(params) => <TextField {...params} label="Promotor" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 280 }}
          options={pontosVendaQuery.data?.pontos_venda ?? []}
          getOptionLabel={(option) => option.fantasia}
          loading={pontosVendaQuery.isLoading}
          onChange={(_, value) => {
            setPage(0);
            setPontoVendaUuid(value?.id ?? null);
          }}
          renderInput={(params) => <TextField {...params} label="Ponto de venda" />}
        />
        <TextField
          select
          label="Status"
          size="small"
          sx={{ width: 180 }}
          value={status}
          onChange={(e) => {
            setPage(0);
            setStatus(e.target.value as StatusVisita | '');
          }}
        >
          <MenuItem value="">Todos</MenuItem>
          {(Object.keys(STATUS_LABELS) as StatusVisita[]).map((valor) => (
            <MenuItem key={valor} value={valor}>
              {STATUS_LABELS[valor]}
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      <DataTable
        columns={colunas}
        data={visitasQuery.data?.visitas ?? []}
        getRowId={(visita) => visita.id}
        isLoading={visitasQuery.isLoading}
        isError={visitasQuery.isError}
        emptyMessage="Nenhuma visita encontrada."
        onRowClick={(visita) => navigate(`/visitas/${visita.id}`)}
        page={page}
        onPageChange={setPage}
        rowsPerPage={perPage}
        totalRows={visitasQuery.data?.meta.total ?? 0}
      />
    </Box>
  );
}

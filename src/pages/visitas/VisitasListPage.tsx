import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarUsuarios } from '../../lib/api/usuarios';
import { listarVisitas } from '../../lib/api/visitas';
import type { StatusVisita } from '../../types/api';

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

export function VisitasListPage() {
  const navigate = useNavigate();
  // MUI TablePagination é 0-indexed, a API é 1-indexed — a conversão acontece na hora de
  // montar a query.
  const [page, setPage] = useState(0);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
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

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Visitas
      </Typography>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          label="Data início"
          type="date"
          size="small"
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

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ponto de venda</TableCell>
              <TableCell>Promotor</TableCell>
              <TableCell>Início</TableCell>
              <TableCell>Fim</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Distância check-in</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visitasQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {visitasQuery.isError && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar a lista — você pode não ter permissão para isto, ou
                    houve um problema de conexão.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {visitasQuery.data?.visitas.length === 0 && !visitasQuery.isError && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhuma visita encontrada.
                </TableCell>
              </TableRow>
            )}
            {visitasQuery.data?.visitas.map((visita) => (
              <TableRow
                key={visita.id}
                hover
                tabIndex={0}
                role="button"
                sx={{ cursor: 'pointer' }}
                onClick={() => navigate(`/visitas/${visita.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/visitas/${visita.id}`);
                  }
                }}
              >
                <TableCell>{visita.ponto_venda?.fantasia}</TableCell>
                <TableCell>{visita.usuario?.nome}</TableCell>
                <TableCell>{new Date(visita.inicio_data).toLocaleString('pt-BR')}</TableCell>
                <TableCell>
                  {visita.fim_data ? new Date(visita.fim_data).toLocaleString('pt-BR') : '—'}
                </TableCell>
                <TableCell>
                  <Chip label={visita.status} color={STATUS_COLORS[visita.status]} size="small" />
                </TableCell>
                <TableCell align="right">{Math.round(visita.inicio_distancia_metros)}m</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={visitasQuery.data?.meta.total ?? 0}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          rowsPerPage={perPage}
          rowsPerPageOptions={[perPage]}
          onRowsPerPageChange={() => {
            // A API não aceita per_page customizado ainda — só existe pra satisfazer o
            // componente controlado do MUI.
          }}
        />
      </TableContainer>
    </Box>
  );
}

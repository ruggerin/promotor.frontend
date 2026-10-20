import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import {
  Alert,
  Autocomplete,
  Box,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from 'recharts';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { listarUsuarios } from '../../lib/api/usuarios';
import { buscarComparativo } from '../../lib/api/xp';
import type { GranularidadeComparativo } from '../../types/api';

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const fmt = (n: number) => n.toLocaleString('pt-BR');

/** Rótulo curto do período: "out/26", "sem 13/10" ou "seg 13/10". */
function rotulo(inicio: string, g: GranularidadeComparativo): string {
  const [ano, mes, dia] = inicio.split('-');
  if (g === 'mes') return `${MESES[Number(mes) - 1]}/${ano.slice(2)}`;
  if (g === 'semana') return `sem ${dia}/${mes}`;
  return `${DIAS[new Date(Number(ano), Number(mes) - 1, Number(dia)).getDay()]} ${dia}/${mes}`;
}

const TEXTO: Record<GranularidadeComparativo, { titulo: string; atual: string }> = {
  mes: { titulo: 'Últimos 6 meses', atual: 'O mês atual ainda está em andamento.' },
  semana: { titulo: 'Últimas 8 semanas', atual: 'A semana atual ainda está em andamento.' },
  dia: { titulo: 'Últimos 14 dias', atual: 'Hoje ainda está em andamento.' },
};

/** Seta e cor da variação (pontos percentuais ou %). Sem base anterior, nada. */
function Variacao({ valor, sufixo }: { valor: number | null; sufixo: string }) {
  if (valor === null) return null;
  if (valor === 0) return <Typography variant="caption" color="text.secondary"> =</Typography>;
  const sobe = valor > 0;
  return (
    <Typography variant="caption" sx={{ color: sobe ? 'success.main' : 'error.main', display: 'inline-flex', alignItems: 'center', fontWeight: 700 }}>
      {sobe ? <ArrowDropUpIcon fontSize="small" /> : <ArrowDropDownIcon fontSize="small" />}
      {Math.abs(valor)}
      {sufixo}
    </Typography>
  );
}

/**
 * Comparativo da régua (docs/88 §11): aproveitamento, realizado, iniciativa e perdas período a
 * período — mês, semana ou dia —, com a variação contra o anterior e cada promotor lado a lado
 * (quem melhorou, quem caiu). Dá pra olhar a equipe inteira ou um promotor só.
 */
export function ComparativoMensal({ supervisor }: { supervisor?: string }) {
  const [granularidade, setGranularidade] = useState<GranularidadeComparativo>('mes');
  const [promotor, setPromotor] = useState<{ id: string; nome: string; foto_url?: string | null } | null>(null);
  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores-ativos'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', ativo: true, por_pagina: 200 }),
  });
  const query = useQuery({
    queryKey: ['xp', 'comparativo', granularidade, supervisor, promotor?.id],
    queryFn: () => buscarComparativo(granularidade, { supervisor_uuid: supervisor, usuario_uuid: promotor?.id }),
    placeholderData: keepPreviousData,
  });

  const controles = (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
      <ToggleButtonGroup exclusive size="small" value={granularidade} onChange={(_, v) => v && setGranularidade(v)}>
        <ToggleButton value="mes">Mês</ToggleButton>
        <ToggleButton value="semana">Semana</ToggleButton>
        <ToggleButton value="dia">Dia</ToggleButton>
      </ToggleButtonGroup>
      <Autocomplete
        size="small"
        sx={{ minWidth: 260 }}
        options={(promotoresQuery.data?.usuarios ?? []).map((u) => ({ id: u.id, nome: u.nome, foto_url: u.foto_url }))}
        getOptionLabel={(o) => o.nome}
        isOptionEqualToValue={(a, b) => a.id === b.id}
        value={promotor}
        onChange={(_, v) => setPromotor(v)}
        renderOption={(props, o) => (
          <Box component="li" {...props} key={o.id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <UsuarioAvatar nome={o.nome} fotoUrl={o.foto_url} size={24} />
            {o.nome}
          </Box>
        )}
        renderInput={(params) => <TextField {...params} label="Promotor" placeholder="Toda a equipe" />}
      />
    </Box>
  );

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {controles}
        <CircularProgress />
      </Box>
    );
  }
  if (!query.data) return <Alert severity="error">Não foi possível carregar o comparativo.</Alert>;
  const { periodos, promotores } = query.data;
  const g = query.data.granularidade;
  const dados = periodos.map((p) => ({ periodo: rotulo(p.inicio, g), realizado: p.realizado, possivel: p.possivel, aproveitamento: p.aproveitamento }));
  const vazio = periodos.every((p) => p.possivel === 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {controles}
      <Paper sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
          {TEXTO[g].titulo}
          {promotor ? ` · ${promotor.nome}` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Barras: XP realizado e possível. Linha: aproveitamento do plano. {TEXTO[g].atual}
        </Typography>
        {vazio ? (
          <Typography variant="body2" sx={{ py: 4, textAlign: 'center' }} color="text.secondary">
            Sem dado da régua nesse período.
          </Typography>
        ) : (
          <Box sx={{ height: 260, mt: 1 }}>
            <ResponsiveContainer>
              <ComposedChart data={dados}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="periodo" fontSize={12} />
                <YAxis yAxisId="xp" fontSize={11} width={56} tickFormatter={(v) => fmt(Number(v))} />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} unit="%" fontSize={11} width={40} />
                <RTooltip formatter={(v, nome) => (nome === 'Aproveitamento' ? `${v}%` : fmt(Number(v)))} />
                <Legend />
                <Bar yAxisId="xp" dataKey="possivel" name="Possível" fill="#c7d2fe" />
                <Bar yAxisId="xp" dataKey="realizado" name="Realizado" fill="#4f46e5" />
                <Line yAxisId="pct" type="monotone" dataKey="aproveitamento" name="Aproveitamento" stroke="#d97706" strokeWidth={2} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </Box>
        )}
      </Paper>

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell />
              {periodos.map((p) => (
                <TableCell key={p.inicio} align="right" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {rotulo(p.inicio, g)}
                  {p.em_andamento && (
                    <Typography variant="caption" color="text.secondary" component="div">
                      em andamento
                    </Typography>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Aproveitamento</TableCell>
              {periodos.map((p) => (
                <TableCell key={p.inicio} align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {p.aproveitamento !== null ? `${p.aproveitamento}%` : '—'} <Variacao valor={p.variacao_aproveitamento} sufixo=" p.p." />
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Realizado / possível</TableCell>
              {periodos.map((p) => (
                <TableCell key={p.inicio} align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {p.possivel > 0 ? `${fmt(p.realizado)} / ${fmt(p.possivel)}` : '—'}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Iniciativa</TableCell>
              {periodos.map((p) => (
                <TableCell key={p.inicio} align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {p.iniciativa > 0 ? `+${fmt(p.iniciativa)}` : '—'} <Variacao valor={p.variacao_iniciativa} sufixo="%" />
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Perdas</TableCell>
              {periodos.map((p) => (
                <TableCell key={p.inicio} align="right">
                  {p.perdas > 0 ? fmt(p.perdas) : '—'}
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ fontWeight: 600 }}>Visitas feitas</TableCell>
              {periodos.map((p) => (
                <TableCell key={p.inicio} align="right" sx={{ whiteSpace: 'nowrap' }}>
                  {p.visitas_previstas > 0 ? `${fmt(p.visitas_feitas)} de ${fmt(p.visitas_previstas)}` : '—'}
                </TableCell>
              ))}
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>

      {!promotor && (
        <TableContainer component={Paper}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, px: 2, pt: 2 }}>
            Aproveitamento por promotor
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Promotor</TableCell>
                {periodos.map((p) => (
                  <TableCell key={p.inicio} align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {rotulo(p.inicio, g)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {promotores.length === 0 && (
                <TableRow>
                  <TableCell colSpan={periodos.length + 1} align="center">
                    Sem dado de régua no período.
                  </TableCell>
                </TableRow>
              )}
              {promotores.map((p) => (
                <TableRow key={p.usuario.id} hover sx={{ cursor: 'pointer' }} onClick={() => setPromotor(p.usuario)}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, whiteSpace: 'nowrap' }}>
                      <UsuarioAvatar nome={p.usuario.nome} fotoUrl={p.usuario.foto_url} size={28} />
                      {p.usuario.nome}
                    </Box>
                  </TableCell>
                  {p.periodos.map((m, i) => {
                    const antes = i > 0 ? p.periodos[i - 1].aproveitamento : null;
                    const variacao = antes !== null && m.aproveitamento !== null ? m.aproveitamento - antes : null;
                    return (
                      <TableCell key={m.inicio} align="right" sx={{ whiteSpace: 'nowrap' }}>
                        {m.aproveitamento !== null ? `${m.aproveitamento}%` : '—'} <Variacao valor={variacao} sufixo="" />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, pb: 1.5 }}>
            Clique num promotor pra ver o comparativo só dele.
          </Typography>
        </TableContainer>
      )}
    </Box>
  );
}

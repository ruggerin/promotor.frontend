import SearchIcon from '@mui/icons-material/Search';
import {
  Box,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Link,
  Paper,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { buscarLojasDaLinha, buscarVisitasPorLoja, type LojaNoPeriodo, type SituacaoLojaPlanejada } from '../../lib/api/relatorios';

// Lojas por trás do relatório Cumprimento de visitas: a linha "dia × promotor" aberta e a visão
// por loja do período. Mesma classificação dos números da linha (App\Support\LojasDoPlanejamento).

export const SITUACAO_LOJA: Record<SituacaoLojaPlanejada, { rotulo: string; cor: 'success' | 'warning' | 'default' | 'info' | 'error' }> = {
  visitada: { rotulo: 'Visitada', cor: 'success' },
  em_andamento: { rotulo: 'Em andamento', cor: 'info' },
  nao_visitada: { rotulo: 'Não visitada', cor: 'error' },
  a_vencer: { rotulo: 'A vencer', cor: 'default' },
  cancelada: { rotulo: 'Cancelada', cor: 'default' },
  espontanea: { rotulo: 'Espontânea', cor: 'info' },
};

const RESPONSAVEL: Record<string, string> = { PROMOTOR: 'promotor', LOJA: 'loja', EMPRESA: 'empresa', OUTRO: 'outro' };

const FILTROS: { valor: SituacaoLojaPlanejada | 'todas'; rotulo: string }[] = [
  { valor: 'todas', rotulo: 'Todas' },
  { valor: 'visitada', rotulo: 'Visitadas' },
  { valor: 'nao_visitada', rotulo: 'Não visitadas' },
  { valor: 'a_vencer', rotulo: 'A vencer' },
  { valor: 'cancelada', rotulo: 'Canceladas' },
  { valor: 'espontanea', rotulo: 'Espontâneas' },
];

function minutos(m: number | null): string {
  if (m === null) return '—';
  return m >= 60 ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

function diaCurto(iso: string): string {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

function NomeLoja({ loja }: { loja: { id: string; nome: string; codigo_externo: string | null } | null }) {
  if (!loja) return <em>Loja removida</em>;
  return (
    <>
      <Link component={RouterLink} to={`/pontos-venda/${loja.id}`} underline="hover" sx={{ fontWeight: 500 }}>
        {loja.nome}
      </Link>
      {loja.codigo_externo && (
        <Typography variant="caption" component="div" color="text.secondary" sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          {loja.codigo_externo}
        </Typography>
      )}
    </>
  );
}

/** Conteúdo da linha aberta: carrega as lojas só quando abre (o relatório de 30 dias não paga isso). */
export function LojasDaLinha({ data, promotorUuid, pontoVendaUuid }: { data: string; promotorUuid: string | null; pontoVendaUuid: string | null }) {
  const [filtro, setFiltro] = useState<SituacaoLojaPlanejada | 'todas'>('todas');
  const query = useQuery({
    queryKey: ['relatorio-visitas-planejadas', 'lojas', { data, promotorUuid, pontoVendaUuid }],
    queryFn: () => buscarLojasDaLinha({ data, usuario_uuid: promotorUuid, ponto_venda_uuid: pontoVendaUuid }),
  });
  const lojas = query.data ?? [];
  const visiveis = filtro === 'todas' ? lojas : lojas.filter((l) => l.situacao === filtro);

  if (query.isLoading) {
    return (
      <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress size={22} />
      </Box>
    );
  }
  if (query.isError) {
    return (
      <Typography color="error" variant="body2" sx={{ py: 1.5 }}>
        Não foi possível carregar as lojas desta linha.
      </Typography>
    );
  }

  return (
    <Box sx={{ py: 1.5 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center', mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mr: 0.5 }}>
          Lojas do dia ({lojas.length})
        </Typography>
        {FILTROS.map((f) => {
          const qtd = f.valor === 'todas' ? lojas.length : lojas.filter((l) => l.situacao === f.valor).length;
          if (f.valor !== 'todas' && qtd === 0) return null;
          return (
            <Chip
              key={f.valor}
              size="small"
              label={`${f.rotulo} · ${qtd}`}
              color={filtro === f.valor ? 'primary' : 'default'}
              variant={filtro === f.valor ? 'filled' : 'outlined'}
              onClick={() => setFiltro(f.valor)}
            />
          );
        })}
      </Box>
      <TableContainer>
        <Table size="small" sx={{ minWidth: 720 }}>
          <TableHead>
            <TableRow>
              <TableCell>Loja</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell>Previsto</TableCell>
              <TableCell>Entrada → saída</TableCell>
              <TableCell align="right">Tempo na loja</TableCell>
              <TableCell>Detalhe</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visiveis.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} sx={{ color: 'text.secondary' }}>
                  Nenhuma loja nessa situação.
                </TableCell>
              </TableRow>
            )}
            {visiveis.map((l, i) => (
              <TableRow key={`${l.ordem_servico_id ?? l.visita_id ?? i}`}>
                <TableCell>
                  <NomeLoja loja={l.loja} />
                </TableCell>
                <TableCell>
                  <Chip size="small" label={SITUACAO_LOJA[l.situacao].rotulo} color={SITUACAO_LOJA[l.situacao].cor} variant={l.situacao === 'a_vencer' || l.situacao === 'cancelada' ? 'outlined' : 'filled'} />
                </TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{l.situacao === 'espontanea' ? 'fora do plano' : (l.previsto ?? `até ${l.prazo_fim}`)}</TableCell>
                <TableCell sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                  {l.entrada ? (
                    l.visita_id ? (
                      <Link component={RouterLink} to={`/visitas/${l.visita_id}`} underline="hover">
                        {l.entrada} → {l.saida ?? '…'}
                      </Link>
                    ) : (
                      `${l.entrada} → ${l.saida ?? '…'}`
                    )
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell align="right">{minutos(l.minutos_na_loja)}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>
                  {l.situacao === 'cancelada'
                    ? [l.motivo_cancelamento ?? 'sem motivo', l.responsavel_cancelamento && `por ${RESPONSAVEL[l.responsavel_cancelamento] ?? l.responsavel_cancelamento}`].filter(Boolean).join(' · ')
                    : l.situacao === 'nao_visitada'
                      ? `prazo até ${l.prazo_fim}${l.obrigatoria ? ' · obrigatória' : ''}`
                      : l.registros !== null
                        ? `${l.registros} registro(s)`
                        : ''}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

/** Visão por loja do período: o que foi planejado, visitado e perdido em cada loja. */
export function VisitasPorLoja({
  inicio,
  fim,
  promotorUuid,
  pontoVendaUuid,
  onDados,
}: {
  inicio: string;
  fim: string;
  promotorUuid: string | null;
  pontoVendaUuid: string | null;
  onDados?: (lojas: LojaNoPeriodo[]) => void;
}) {
  const [soPerdidas, setSoPerdidas] = useState(true);
  const [busca, setBusca] = useState('');
  const query = useQuery({
    queryKey: ['relatorio-visitas-planejadas', 'por-loja', { inicio, fim, promotorUuid, pontoVendaUuid, soPerdidas }],
    queryFn: async () => {
      const r = await buscarVisitasPorLoja({ data_inicio: inicio, data_fim: fim, usuario_uuid: promotorUuid, ponto_venda_uuid: pontoVendaUuid, so_perdidas: soPerdidas });
      onDados?.(r.lojas);
      return r;
    },
    enabled: Boolean(inicio && fim),
  });

  const lojas = useMemo(() => {
    const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const termo = normalizar(busca.trim());
    const todas = query.data?.lojas ?? [];
    return termo ? todas.filter((l) => normalizar(`${l.loja.nome} ${l.loja.codigo_externo ?? ''}`).includes(termo)) : todas;
  }, [query.data, busca]);

  return (
    <Box>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {query.data
            ? `${query.data.lojas_com_perda} de ${query.data.total_lojas} loja(s) com visita perdida no período. Ordenado pelas que mais ficaram sem visita.`
            : ' '}
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <FormControlLabel control={<Switch size="small" checked={soPerdidas} onChange={(e) => setSoPerdidas(e.target.checked)} />} label="Só lojas com visita perdida" />
          <TextField
            size="small"
            placeholder="Buscar loja ou código"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            sx={{ width: 240 }}
            slotProps={{
              htmlInput: { 'aria-label': 'Buscar loja' },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small" sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>Loja</TableCell>
              <TableCell>Promotor</TableCell>
              <TableCell align="right">Planejadas</TableCell>
              <TableCell align="right">Visitadas</TableCell>
              <TableCell align="right">Não visitadas</TableCell>
              <TableCell align="right">Canceladas</TableCell>
              <TableCell align="right">Espontâneas</TableCell>
              <TableCell>Última visita</TableCell>
              <TableCell>Dias perdidos</TableCell>
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
            {query.data && lojas.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                  {busca ? `Nenhuma loja com "${busca}".` : soPerdidas ? 'Nenhuma visita perdida no período.' : 'Nada planejado nem executado nesse período.'}
                </TableCell>
              </TableRow>
            )}
            {lojas.map((l) => (
              <TableRow key={l.loja.id} hover>
                <TableCell>
                  <NomeLoja loja={l.loja} />
                </TableCell>
                <TableCell>{l.promotores.map((p) => p.nome).join(', ') || <em>sem promotor</em>}</TableCell>
                <TableCell align="right">{l.planejadas}</TableCell>
                <TableCell align="right">{l.visitadas}</TableCell>
                <TableCell align="right" sx={{ color: l.nao_visitadas > 0 ? 'error.main' : undefined, fontWeight: l.nao_visitadas > 0 ? 700 : undefined }}>
                  {l.nao_visitadas}
                </TableCell>
                <TableCell align="right">{l.canceladas}</TableCell>
                <TableCell align="right">{l.espontaneas}</TableCell>
                <TableCell>
                  {l.ultima_visita ? (
                    <>
                      {new Date(l.ultima_visita).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                      {l.dias_sem_visita !== null && l.dias_sem_visita > 0 && (
                        <Typography component="span" variant="caption" color={l.dias_sem_visita >= 7 ? 'error.main' : 'text.secondary'}>
                          {' '}
                          · há {l.dias_sem_visita} dia(s)
                        </Typography>
                      )}
                    </>
                  ) : (
                    <Typography variant="body2" color="error.main">
                      nunca visitada
                    </Typography>
                  )}
                </TableCell>
                <TableCell sx={{ fontSize: 12, color: 'text.secondary' }}>{l.dias_perdidos.map(diaCurto).join(', ') || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

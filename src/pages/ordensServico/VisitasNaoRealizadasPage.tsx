import { Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { CancelarVisitasDialog } from '../../components/ordensServico/CancelarVisitasDialog';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { listarOrdensServico } from '../../lib/api/ordensServico';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarUsuarios } from '../../lib/api/usuarios';
import type { OrdemServico, OrigemOrdemServico } from '../../types/api';

const ORIGEM_LABELS: Record<OrigemOrdemServico, string> = {
  MANUAL: 'Manual',
  CAMPANHA: 'Campanha',
  AGENDA: 'Agenda',
  CONTRATO: 'Contrato',
  DIRECIONAMENTO: 'Direcionamento',
};

function diasDeAtraso(prazoFim: string): number {
  return Math.max(1, Math.floor((Date.now() - new Date(prazoFim).getTime()) / 86_400_000));
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Fila de visitas planejadas que venceram e ninguém executou (docs/59). Nada aqui é encerrado
 * sozinho: o gestor decide, e cancelar exige dizer quem causou e por quê — fica registrado e
 * aparece nos relatórios. Enquanto a fila não zera, o contador do menu continua visível.
 */
export function VisitasNaoRealizadasPage() {
  const [page, setPage] = useState(0);
  const [origem, setOrigem] = useState<OrigemOrdemServico | ''>('');
  const [promotor, setPromotor] = useState<{ id: string; nome: string } | null>(null);
  const [loja, setLoja] = useState<{ id: string; fantasia: string } | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [aCancelar, setACancelar] = useState<OrdemServico[]>([]);

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Visitas não realizadas" />);

  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores-nao-realizadas'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR', por_pagina: 200 }),
  });
  const lojasQuery = useQuery({
    queryKey: ['pontos-venda', 'nao-realizadas'],
    queryFn: () => listarPontosVenda({ ativo: true, por_pagina: 200 }),
  });

  const query = useQuery({
    queryKey: ['visitas-nao-realizadas', { page, origem, promotor: promotor?.id, loja: loja?.id }],
    queryFn: () =>
      listarOrdensServico({
        page: page + 1,
        vencidas: true,
        origem: origem || undefined,
        usuario_uuid: promotor?.id,
        ponto_venda_uuid: loja?.id,
      }),
    placeholderData: keepPreviousData,
  });

  const ordens = query.data?.ordens_servico ?? [];
  const total = query.data?.meta.total ?? 0;
  const todasSelecionadas = ordens.length > 0 && ordens.every((os) => selecionadas.has(os.id));

  function alternar(uuid: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (!novo.delete(uuid)) novo.add(uuid);
      return novo;
    });
  }

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Visitas planejadas cujo prazo já passou sem ninguém executar. O sistema não as encerra sozinho: cada uma
        precisa de uma decisão sua. Para cancelar, informe <strong>quem causou</strong> e <strong>o motivo</strong> — o
        cancelamento fica registrado e aparece nos relatórios, inclusive no desempenho do promotor.
      </Typography>

      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          size="small"
          sx={{ width: 240 }}
          options={promotoresQuery.data?.usuarios ?? []}
          getOptionLabel={(u) => u.nome}
          loading={promotoresQuery.isLoading}
          onChange={(_, u) => {
            setPage(0);
            setPromotor(u ? { id: u.id, nome: u.nome } : null);
          }}
          renderInput={(params) => <TextField {...params} label="Promotor" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 260 }}
          options={lojasQuery.data?.pontos_venda ?? []}
          getOptionLabel={(p) => p.fantasia}
          loading={lojasQuery.isLoading}
          onChange={(_, p) => {
            setPage(0);
            setLoja(p ? { id: p.id, fantasia: p.fantasia } : null);
          }}
          renderInput={(params) => <TextField {...params} label="Loja" />}
        />
        <TextField
          select
          size="small"
          label="Origem"
          value={origem}
          onChange={(e) => {
            setPage(0);
            setOrigem(e.target.value as OrigemOrdemServico | '');
          }}
          sx={{ width: 180 }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(Object.keys(ORIGEM_LABELS) as OrigemOrdemServico[]).map((o) => (
            <MenuItem key={o} value={o}>
              {ORIGEM_LABELS[o]}
            </MenuItem>
          ))}
        </TextField>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="contained"
          color="error"
          disabled={selecionadas.size === 0}
          onClick={() => setACancelar(ordens.filter((os) => selecionadas.has(os.id)))}
        >
          Cancelar selecionadas ({selecionadas.size})
        </Button>
      </Paper>

      {query.isError && <Alert severity="error" sx={{ mb: 2 }}>Não foi possível carregar a fila — você pode não ter permissão para gerenciar ordens de serviço.</Alert>}

      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  size="small"
                  checked={todasSelecionadas}
                  indeterminate={!todasSelecionadas && ordens.some((os) => selecionadas.has(os.id))}
                  onChange={() => setSelecionadas(todasSelecionadas ? new Set() : new Set(ordens.map((os) => os.id)))}
                  slotProps={{ input: { 'aria-label': 'Selecionar todas as visitas da página' } }}
                />
              </TableCell>
              <TableCell>Loja</TableCell>
              <TableCell>Promotor</TableCell>
              <TableCell>Previsto para</TableCell>
              <TableCell>Atraso</TableCell>
              <TableCell>Origem</TableCell>
              <TableCell align="right">Ação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && ordens.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  Nenhuma visita vencida aguardando decisão.
                </TableCell>
              </TableRow>
            )}
            {ordens.map((os) => {
              const dias = diasDeAtraso(os.prazo_fim);
              return (
                <TableRow key={os.id} hover selected={selecionadas.has(os.id)}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={selecionadas.has(os.id)}
                      onChange={() => alternar(os.id)}
                      slotProps={{ input: { 'aria-label': `Selecionar visita de ${os.ponto_venda?.fantasia ?? 'loja'}` } }}
                    />
                  </TableCell>
                  <TableCell>{os.ponto_venda?.fantasia ?? '—'}</TableCell>
                  <TableCell>{os.usuario?.nome ?? <em>Fila aberta</em>}</TableCell>
                  <TableCell>{formatarData(os.prazo_fim)}</TableCell>
                  <TableCell>
                    <Chip size="small" color={dias > 7 ? 'error' : 'warning'} label={`${dias} ${dias === 1 ? 'dia' : 'dias'}`} />
                  </TableCell>
                  <TableCell>{ORIGEM_LABELS[os.origem]}</TableCell>
                  <TableCell align="right">
                    <Button size="small" color="error" onClick={() => setACancelar([os])}>
                      Cancelar com justificativa
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={query.data?.meta.per_page ?? 15}
          rowsPerPageOptions={[]}
        />
      </TableContainer>

      <CancelarVisitasDialog
        alvos={aCancelar}
        onClose={(cancelou) => {
          if (cancelou) setSelecionadas(new Set());
          setACancelar([]);
        }}
      />
    </Box>
  );
}

import { Box, Chip, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { ColumnDef } from '@tanstack/react-table';
import { useState } from 'react';
import { AcompanhamentoDialog, corDaSituacao } from '../../components/acompanhamentos/AcompanhamentoDialog';
import { DataTable } from '../../components/DataTable';
import { listarAcompanhamentos, ROTULO_SITUACAO, type AcompanhamentoResumo } from '../../lib/api/acompanhamentos';
import type { SituacaoAcompanhamento } from '../../types/api';

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

// Aba "Acompanhamentos" de Registros (docs/83 §5.3): o que está sendo conferido nas lojas, há
// quantos dias, e o histórico de cada um. Clicar abre a linha do tempo.
export function AcompanhamentosLista() {
  const [page, setPage] = useState(0);
  const [situacao, setSituacao] = useState<SituacaoAcompanhamento | ''>('ABERTO');
  const [aberto, setAberto] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['acompanhamentos', { page, situacao }],
    queryFn: () => listarAcompanhamentos({ page: page + 1, situacao: situacao || undefined }),
    placeholderData: keepPreviousData,
  });

  const colunas: ColumnDef<AcompanhamentoResumo, unknown>[] = [
    { id: 'formulario', header: 'Formulário', cell: ({ row }) => row.original.formulario?.descricao ?? '—' },
    { id: 'loja', header: 'Loja', cell: ({ row }) => row.original.loja?.fantasia ?? '—' },
    {
      id: 'situacao',
      header: 'Situação',
      cell: ({ row }) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Chip size="small" label={ROTULO_SITUACAO[row.original.situacao]} color={corDaSituacao(row.original.situacao)} variant="outlined" />
          {row.original.atrasado && <Chip size="small" label="Conferência atrasada" color="warning" />}
        </Box>
      ),
    },
    { id: 'aberto', header: 'Aberto em', cell: ({ row }) => data(row.original.aberto_em) },
    { id: 'dias', header: 'Dias', accessorKey: 'dias_em_aberto', meta: { align: 'right' } },
    { id: 'ultima', header: 'Última conferência', cell: ({ row }) => data(row.original.ultima_resposta_em) },
    { id: 'respostas', header: 'Conferências', accessorKey: 'respostas_count', meta: { align: 'right' } },
  ];

  return (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 760 }}>
        Registros que voltam a ser conferidos nas próximas visitas ("ainda está lá?"). Ligue no formulário, passo
        "Acompanhar".
      </Typography>
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Situação"
          sx={{ width: 220 }}
          value={situacao}
          onChange={(e) => {
            setPage(0);
            setSituacao(e.target.value as SituacaoAcompanhamento | '');
          }}
        >
          <MenuItem value="">Todas</MenuItem>
          {(Object.keys(ROTULO_SITUACAO) as SituacaoAcompanhamento[]).map((s) => (
            <MenuItem key={s} value={s}>
              {ROTULO_SITUACAO[s]}
            </MenuItem>
          ))}
        </TextField>
      </Paper>
      <DataTable
        columns={colunas}
        data={query.data?.acompanhamentos ?? []}
        getRowId={(a) => a.id}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        isPlaceholderData={query.isPlaceholderData}
        isError={query.isError}
        errorMessage="Não foi possível carregar os acompanhamentos."
        emptyMessage={situacao ? 'Nenhum acompanhamento nesta situação.' : 'Nenhum acompanhamento ainda.'}
        onRowClick={(a) => setAberto(a.id)}
        page={page}
        onPageChange={setPage}
        rowsPerPage={query.data?.meta.per_page ?? 30}
        totalRows={query.data?.meta.total ?? 0}
      />
      {aberto && <AcompanhamentoDialog id={aberto} onFechar={() => setAberto(null)} />}
    </>
  );
}

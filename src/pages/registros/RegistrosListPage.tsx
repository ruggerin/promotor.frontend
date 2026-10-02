import { Autocomplete, Box, Button, Chip, MenuItem, Paper, TextField, Typography } from '@mui/material';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { DataTable } from '../../components/DataTable';
import { buscarAlertaRequerResolucao } from '../../lib/api/parametros';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { listarRegistros } from '../../lib/api/registros';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import type { RegistroLista } from '../../types/api';
import type { AlertaOrigem } from '../planosAcao/NovoPlanoAcaoDialog';
import { NovoPlanoAcaoDialog } from '../planosAcao/NovoPlanoAcaoDialog';
import type { AlvoResolucao } from '../atividades/ResolverAlertaDialog';
import { ResolverAlertaDialog } from '../atividades/ResolverAlertaDialog';

type StatusFiltro = '' | 'aberto' | 'resolvido';

const STATUS_LABELS: Record<Exclude<StatusFiltro, ''>, string> = {
  aberto: 'Aberto',
  resolvido: 'Resolvido',
};

const coluna = createColumnHelper<RegistroLista>();

// Tela genérica de registros de visita (ruptura, avaria, validade próxima, foto, observação, o
// que mais for cadastrado) — docs/44-TELA-REGISTROS.md. Antes desta tela não existia lugar
// nenhum pra ver um registro fora do contexto de uma visita específica já aberta.
export function RegistrosListPage() {
  const navigate = useNavigate();
  // Drill-down do "Rupturas por SKU" da Operação do Dia chega aqui via link
  // (?produto_auditoria_uuid=&produto_descricao=&ruptura=1) — mesmo mecanismo já usado pela
  // listagem de Visitas, lido só uma vez no primeiro carregamento.
  const [searchParams] = useSearchParams();
  const [produtoFiltro, setProdutoFiltro] = useState(() => {
    const uuid = searchParams.get('produto_auditoria_uuid');
    if (!uuid) return null;
    return { uuid, descricao: searchParams.get('produto_descricao') ?? uuid };
  });
  const [rupturaFiltro, setRupturaFiltro] = useState(() => searchParams.get('ruptura') === '1');

  function limparFiltroOrigem() {
    setPage(0);
    setProdutoFiltro(null);
    setRupturaFiltro(false);
  }

  const [page, setPage] = useState(0);
  const [tipoRegistroFiltro, setTipoRegistroFiltro] = useState<{ id: string; label: string } | null>(null);
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [redeLojaUuid, setRedeLojaUuid] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [status, setStatus] = useState<StatusFiltro>('');
  const [alvoResolver, setAlvoResolver] = useState<AlvoResolucao | null>(null);
  const [alertaPlano, setAlertaPlano] = useState<AlertaOrigem | null>(null);

  // Mesmo parâmetro que decide se o botão "Marcar resolvido" aparece no Painel de Atividades
  // (docs/19) — sem ele, alerta é só informativo, não faz sentido oferecer ação de resolução
  // aqui também. Ver docs/56-RESOLVER-ALERTA-NA-TELA-REGISTROS.md.
  const requerResolucaoQuery = useQuery({ queryKey: ['parametros', 'alerta-requer-resolucao'], queryFn: buscarAlertaRequerResolucao });
  const requerResolucao = requerResolucaoQuery.data ?? false;

  const tiposRegistroQuery = useQuery({ queryKey: ['tipos-registro', 'filtro'], queryFn: () => listarTiposRegistro() });
  const pontosVendaQuery = useQuery({ queryKey: ['pontos-venda', 'filtro'], queryFn: () => listarPontosVenda() });
  const redesLojasQuery = useQuery({ queryKey: ['redes-lojas', 'filtro'], queryFn: () => listarRedesLojas() });

  const registrosQuery = useQuery({
    queryKey: [
      'registros',
      { page, tipoRegistroFiltro, pontoVendaUuid, redeLojaUuid, dataInicio, dataFim, status, produtoFiltro, rupturaFiltro },
    ],
    queryFn: () =>
      listarRegistros({
        page: page + 1,
        tipo_registro_uuid: tipoRegistroFiltro?.id,
        ponto_venda_uuid: pontoVendaUuid ?? undefined,
        rede_loja_uuid: redeLojaUuid ?? undefined,
        data_inicio: dataInicio || undefined,
        data_fim: dataFim || undefined,
        alerta_status: status || undefined,
        produto_auditoria_uuid: produtoFiltro?.uuid,
        ruptura: rupturaFiltro || undefined,
      }),
    placeholderData: keepPreviousData,
  });

  const perPage = registrosQuery.data?.meta.per_page ?? 15;

  const colunas = useMemo(
    () => [
      coluna.accessor((r) => new Date(r.ocorrido_em).getTime(), {
        id: 'ocorrido_em',
        header: 'Data/Hora',
        cell: (info) => new Date(info.row.original.ocorrido_em).toLocaleString('pt-BR'),
      }),
      coluna.accessor((r) => r.tipo_registro.descricao, {
        id: 'tipo_registro',
        header: 'Tipo',
        cell: (info) => <Chip label={info.getValue()} size="small" variant="outlined" />,
      }),
      coluna.accessor((r) => r.ponto_venda?.fantasia ?? '', {
        id: 'ponto_venda',
        header: 'Loja',
        cell: (info) => {
          const pv = info.row.original.ponto_venda;
          if (!pv) return '—';
          return (
            <Box>
              <Typography variant="body2">{pv.fantasia}</Typography>
              {pv.rede_loja && (
                <Typography variant="caption" color="text.secondary">
                  {pv.rede_loja.descricao}
                </Typography>
              )}
            </Box>
          );
        },
      }),
      coluna.accessor((r) => r.produto_auditoria?.descricao ?? '', {
        id: 'produto',
        header: 'Produto',
        cell: (info) => info.getValue() || '—',
      }),
      coluna.accessor((r) => r.observacao ?? '', {
        id: 'observacao',
        header: 'Observação',
        cell: (info) => info.getValue() || '—',
        meta: { wrap: true },
      }),
      coluna.accessor((r) => r.usuario?.nome ?? '', {
        id: 'usuario',
        header: 'Promotor',
        cell: (info) => info.getValue() || '—',
      }),
      coluna.accessor((r) => r.status ?? '', {
        id: 'status',
        header: 'Status',
        cell: (info) => {
          const r = info.row.original;
          if (!r.status) return '—';
          return (
            <Box>
              <Chip label={STATUS_LABELS[r.status]} size="small" color={r.status === 'aberto' ? 'warning' : 'success'} />
              {r.status === 'resolvido' && (r.motivo || r.motivo_texto) && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Motivo: {r.motivo?.descricao ?? r.motivo_texto}
                </Typography>
              )}
            </Box>
          );
        },
      }),
      ...(requerResolucao
        ? [
            coluna.display({
              id: 'acao',
              header: 'Ação',
              cell: (info) => {
                const r = info.row.original;
                if (r.status !== 'aberto') return null;
                return (
                  <Box sx={{ display: 'flex', gap: 1 }} onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      onClick={() => setAlvoResolver({ visitaUuid: r.visita_id, registroUuid: r.id, tipo: r.tipo_registro.descricao, produto: r.produto_auditoria?.descricao, pontoVenda: r.ponto_venda?.fantasia })}
                      sx={{ textTransform: 'none' }}
                    >
                      Resolver
                    </Button>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() =>
                        setAlertaPlano({
                          registroUuid: r.id,
                          tipo: r.tipo_registro.descricao,
                          produto: r.produto_auditoria?.descricao,
                          pontoVenda: r.ponto_venda?.fantasia,
                          observacao: r.observacao,
                        })
                      }
                      sx={{ textTransform: 'none' }}
                    >
                      Abrir plano
                    </Button>
                  </Box>
                );
              },
            }),
          ]
        : []),
    ],
    [requerResolucao],
  );

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Registros" />);

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Qualquer ocorrência registrada em campo — ruptura, avaria, validade próxima, foto ou
        observação — filtrável por tipo, loja, rede e período, sempre ligada à visita de origem.
      </Typography>

      {(produtoFiltro || rupturaFiltro) && (
        <Paper sx={{ p: 1, mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Filtrando pela Operação do dia:
          </Typography>
          <Chip
            size="small"
            color="warning"
            label={produtoFiltro ? `${produtoFiltro.descricao} · ruptura aberta` : 'Ruptura aberta'}
            onDelete={limparFiltroOrigem}
          />
        </Paper>
      )}

      <Paper sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
        <Autocomplete
          size="small"
          sx={{ width: 220 }}
          options={(tiposRegistroQuery.data?.tipos_registro ?? []).map((t) => ({ id: t.id, label: t.descricao }))}
          loading={tiposRegistroQuery.isLoading}
          value={tipoRegistroFiltro}
          onChange={(_, value) => {
            setPage(0);
            setTipoRegistroFiltro(value);
          }}
          renderInput={(params) => <TextField {...params} label="Tipo de registro" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 240 }}
          options={pontosVendaQuery.data?.pontos_venda ?? []}
          getOptionLabel={(option) => option.fantasia}
          loading={pontosVendaQuery.isLoading}
          onChange={(_, value) => {
            setPage(0);
            setPontoVendaUuid(value?.id ?? null);
          }}
          renderInput={(params) => <TextField {...params} label="Loja" />}
        />
        <Autocomplete
          size="small"
          sx={{ width: 200 }}
          options={redesLojasQuery.data?.redes_lojas ?? []}
          getOptionLabel={(option) => option.descricao}
          loading={redesLojasQuery.isLoading}
          onChange={(_, value) => {
            setPage(0);
            setRedeLojaUuid(value?.id ?? null);
          }}
          renderInput={(params) => <TextField {...params} label="Rede" />}
        />
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
        <TextField
          select
          label="Status"
          size="small"
          sx={{ width: 160 }}
          value={status}
          onChange={(e) => {
            setPage(0);
            setStatus(e.target.value as StatusFiltro);
          }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="aberto">Aberto</MenuItem>
          <MenuItem value="resolvido">Resolvido</MenuItem>
        </TextField>
      </Paper>

      <DataTable
        columns={colunas}
        data={registrosQuery.data?.registros ?? []}
        getRowId={(r) => r.id}
        isLoading={registrosQuery.isLoading}
        isError={registrosQuery.isError}
        emptyMessage="Nenhum registro encontrado com esses filtros."
        onRowClick={(r) => navigate(`/visitas/${r.visita_id}`)}
        page={page}
        onPageChange={setPage}
        rowsPerPage={perPage}
        totalRows={registrosQuery.data?.meta.total ?? 0}
      />

      <ResolverAlertaDialog open={!!alvoResolver} alvo={alvoResolver} onClose={() => setAlvoResolver(null)} />
      <NovoPlanoAcaoDialog open={!!alertaPlano} alerta={alertaPlano} onClose={() => setAlertaPlano(null)} />
    </Box>
  );
}

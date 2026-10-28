import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { buscarHistoricoConfiguracoes, type AlteracaoHistorico, type ItemConfiguracao, type OrigemAlteracao } from '../../lib/api/parametros';

// Auditoria das configurações: quem mudou o quê, de quanto pra quanto, quando e de onde.

export const ORIGEM_ROTULO: Record<OrigemAlteracao, string> = {
  CONFIGURACOES: 'Configurações',
  AVANCADO: 'Avançado',
  PADROES: 'Padrões do sistema',
  SUPORTE: 'Suporte',
  COMANDO: 'Rotina do sistema',
  SISTEMA: 'Sistema',
};

function valorLegivel(valor: string | null, ativo: boolean | null, item: ItemConfiguracao | undefined): string {
  if (valor === null && ativo === null) return '—';
  if (ativo === false) return item?.ativo_significa === 'sem_limite' ? 'sem limite' : 'desativado (vale o padrão)';
  if (valor === null) return '—';
  if (item?.tipo === 'bool' || valor === 'true' || valor === 'false') return valor === 'true' ? 'Sim' : valor === 'false' ? 'Não' : valor;
  const opcao = item?.opcoes?.find((o) => o.valor === valor);
  if (opcao) return opcao.rotulo;
  return item?.unidade ? `${valor} ${item.unidade}` : valor;
}

function Linha({ h, item }: { h: AlteracaoHistorico; item: ItemConfiguracao | undefined }) {
  const criacao = h.valor_anterior === null && h.ativo_anterior === null;
  return (
    <TableRow>
      <TableCell sx={{ whiteSpace: 'nowrap' }}>{new Date(h.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {item?.rotulo ?? h.rotulo}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
          {h.chave}
        </Typography>
      </TableCell>
      <TableCell>
        {criacao ? (
          <>
            <Typography component="span" variant="body2" color="text.secondary">
              criado com{' '}
            </Typography>
            <strong>{valorLegivel(h.valor_novo, h.ativo_novo, item)}</strong>
          </>
        ) : (
          <>
            <Typography component="span" variant="body2" color="text.secondary" sx={{ textDecoration: 'line-through' }}>
              {valorLegivel(h.valor_anterior, h.ativo_anterior, item)}
            </Typography>
            {' → '}
            <strong>{valorLegivel(h.valor_novo, h.ativo_novo, item)}</strong>
          </>
        )}
      </TableCell>
      <TableCell>{h.por ?? <em>—</em>}</TableCell>
      <TableCell>
        <Chip size="small" variant="outlined" label={ORIGEM_ROTULO[h.origem] ?? h.origem} color={h.origem === 'SUPORTE' ? 'warning' : 'default'} />
      </TableCell>
    </TableRow>
  );
}

export function HistoricoConfiguracoesDialog({
  open,
  onClose,
  itens,
  chaveInicial = null,
}: {
  open: boolean;
  onClose: () => void;
  itens: ItemConfiguracao[];
  chaveInicial?: string | null;
}) {
  const [chave, setChave] = useState<string | null>(chaveInicial);
  useEffect(() => {
    if (open) setChave(chaveInicial);
  }, [open, chaveInicial]);

  const query = useInfiniteQuery({
    queryKey: ['parametros', 'historico', chave],
    queryFn: ({ pageParam }) => buscarHistoricoConfiguracoes({ chave, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (ultima) => (ultima.meta.current_page < ultima.meta.last_page ? ultima.meta.current_page + 1 : undefined),
    enabled: open,
  });
  const linhas = query.data?.pages.flatMap((p) => p.historico) ?? [];
  const total = query.data?.pages[0]?.meta.total ?? 0;
  const porChave = new Map(itens.map((i) => [i.chave, i]));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Histórico de alterações das configurações</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
          <Autocomplete
            size="small"
            sx={{ width: 360, maxWidth: '100%' }}
            options={itens}
            value={itens.find((i) => i.chave === chave) ?? null}
            getOptionLabel={(i) => i.rotulo}
            onChange={(_, i) => setChave(i?.chave ?? null)}
            renderInput={(params) => <TextField {...params} label="Configuração" placeholder="Todas" />}
          />
          <Typography variant="body2" color="text.secondary">
            {query.data ? `${total} alteração(ões)` : ' '}
          </Typography>
        </Box>
        <TableContainer>
          <Table size="small" sx={{ minWidth: 680 }}>
            <TableHead>
              <TableRow>
                <TableCell>Quando</TableCell>
                <TableCell>Configuração</TableCell>
                <TableCell>De → para</TableCell>
                <TableCell>Por</TableCell>
                <TableCell>Onde</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {query.isLoading && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <CircularProgress size={22} />
                  </TableCell>
                </TableRow>
              )}
              {query.data && linhas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    Nenhuma alteração registrada{chave ? ' nesta configuração' : ''}. O histórico começa a contar a partir desta versão.
                  </TableCell>
                </TableRow>
              )}
              {linhas.map((h, i) => (
                <Linha key={`${h.em}-${h.chave}-${i}`} h={h} item={porChave.get(h.chave)} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {query.hasNextPage && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.5 }}>
            <Button onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
              {query.isFetchingNextPage ? 'Carregando…' : 'Carregar mais'}
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}

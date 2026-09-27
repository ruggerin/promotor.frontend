import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import {
  acaoPedidoVenda,
  atualizarPedidoVenda,
  buscarPedidoVenda,
  type PedidoVendaDetailResponse,
} from '../../lib/api/pedidosVenda';
import type { PedidoVenda, PedidoVendaItem } from '../../types/api';
import { formatarDataHora } from '../planosAcao/statusPlanoAcao';
import { formatarMoeda, formatarNumero, formatarPct, STATUS_PEDIDO_VENDA } from './statusPedidoVenda';

type AcaoComMotivo = 'aprovar' | 'rejeitar' | 'cancelar';

const DIALOGO: Record<AcaoComMotivo, { titulo: string; texto: string; rotulo: string; obrigatorio: boolean; botao: string }> = {
  aprovar: {
    titulo: 'Autorizar preços?',
    texto: 'O pedido passa para "Aprovado" com os preços abaixo do mínimo exatamente como estão. Qualquer edição posterior invalida esta autorização.',
    rotulo: 'Observação (opcional)',
    obrigatorio: false,
    botao: 'Autorizar',
  },
  rejeitar: {
    titulo: 'Rejeitar autorização?',
    texto: 'O pedido volta para rascunho, com o vendedor. Diga o que precisa mudar.',
    rotulo: 'Motivo da rejeição',
    obrigatorio: true,
    botao: 'Rejeitar',
  },
  cancelar: {
    titulo: 'Cancelar pedido?',
    texto: 'Cancelamento é definitivo — para refazer, é um pedido novo.',
    rotulo: 'Motivo (opcional)',
    obrigatorio: false,
    botao: 'Cancelar pedido',
  },
};

function mensagemErro(err: unknown): string {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err)) {
    const errors = err.response?.data?.errors;
    if (errors) return Object.values(errors)[0]?.[0] ?? 'Erro ao salvar.';
    return err.response?.data?.message ?? 'Erro ao salvar.';
  }
  return 'Erro ao salvar.';
}

// Detalhe do Pedido de Venda — itens com preço de tabela × mínimo × digitado, histórico e as ações
// que o backend diz que o usuário pode fazer agora. Ver docs/38-PEDIDO-VENDEDOR.md §7/§8.
export function PedidoVendaDetailPage() {
  const { publicId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acao, setAcao] = useState<AcaoComMotivo | null>(null);
  const [confirmandoConclusao, setConfirmandoConclusao] = useState(false);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['pedidos-venda', publicId], queryFn: () => buscarPedidoVenda(publicId) });

  function aplicar(data: PedidoVendaDetailResponse) {
    queryClient.setQueryData(['pedidos-venda', publicId], data);
    void queryClient.invalidateQueries({ queryKey: ['pedidos-venda'], exact: false, refetchType: 'none' });
    setErro(null);
  }

  const mutacaoAcao = useMutation({
    mutationFn: ({ nome, motivo }: { nome: AcaoComMotivo | 'concluir' | 'enviar'; motivo?: string }) =>
      acaoPedidoVenda(publicId, nome, motivo),
    onSuccess: (data) => {
      aplicar(data);
      setAcao(null);
      setConfirmandoConclusao(false);
    },
    onError: (err) => setErro(mensagemErro(err)),
  });

  const cabecalho = usePageHeader(
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <IconButton size="small" onClick={() => navigate('/pedidos-venda')}>
        <ArrowBackIcon fontSize="small" />
      </IconButton>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        Pedido de Venda
      </Typography>
    </Box>,
  );

  if (query.isLoading) {
    return (
      <Box>
        {cabecalho}
        <CircularProgress />
      </Box>
    );
  }
  if (!query.data) {
    return (
      <Box>
        {cabecalho}
        <Alert severity="error">Pedido não encontrado.</Alert>
      </Box>
    );
  }

  const { pedido_venda: pedido, permissoes } = query.data;
  const status = STATUS_PEDIDO_VENDA[pedido.status];
  const itens = pedido.itens ?? [];
  const abaixo = itens.filter((i) => i.requer_autorizacao).length;

  return (
    <Box>
      {cabecalho}

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flex: 1, minWidth: 240 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {pedido.ponto_venda?.fantasia ?? '—'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {[pedido.ponto_venda?.razao_social, pedido.ponto_venda?.cnpj].filter(Boolean).join(' · ')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 3, mt: 1.5, flexWrap: 'wrap' }}>
              <Info rotulo="Vendedor">{pedido.vendedor?.nome ?? '—'}</Info>
              <Info rotulo="Criado em">{formatarDataHora(pedido.created_at)}</Info>
              <Info rotulo="Origem">{pedido.visita_id ? 'Durante a visita' : 'Fora de visita'}</Info>
              {pedido.concluido_em && (
                <Info rotulo="Concluído">
                  {formatarDataHora(pedido.concluido_em)} por {pedido.concluido_por?.nome ?? '—'}
                </Info>
              )}
            </Box>
            {pedido.observacao && (
              <Typography variant="body2" sx={{ mt: 1.5, whiteSpace: 'pre-wrap' }}>
                <strong>Observação:</strong> {pedido.observacao}
              </Typography>
            )}
          </Box>
          <Box sx={{ textAlign: 'right' }}>
            <Chip label={status.label} color={status.cor} />
            <Typography variant="h5" sx={{ fontWeight: 700, mt: 1 }}>
              {formatarMoeda(pedido.total)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {pedido.total_itens} {pedido.total_itens === 1 ? 'item' : 'itens'}
            </Typography>
          </Box>
        </Box>

        {erro && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setErro(null)}>
            {erro}
          </Alert>
        )}

        {pedido.status === 'PENDENTE_AUTORIZACAO' && permissoes.e_autor && !permissoes.aprovar && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Você criou este pedido — a autorização precisa vir de outra pessoa.
          </Alert>
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
          {permissoes.aprovar && (
            <>
              <Button variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => setAcao('aprovar')}>
                Autorizar preços
              </Button>
              <Button variant="outlined" color="error" startIcon={<CloseIcon />} onClick={() => setAcao('rejeitar')}>
                Rejeitar
              </Button>
            </>
          )}
          {permissoes.editar && !editando && (
            <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => setEditando(true)}>
              Corrigir itens
            </Button>
          )}
          {permissoes.enviar && !editando && (
            <Button
              variant="contained"
              onClick={() => mutacaoAcao.mutate({ nome: 'enviar' })}
              disabled={mutacaoAcao.isPending}
            >
              {pedido.requer_autorizacao ? 'Solicitar autorização' : 'Enviar'}
            </Button>
          )}
          {permissoes.concluir && (
            <Button variant="contained" color="success" onClick={() => setConfirmandoConclusao(true)}>
              Concluir pedido
            </Button>
          )}
          {permissoes.cancelar && (
            <Button color="inherit" onClick={() => setAcao('cancelar')} sx={{ ml: 'auto' }}>
              Cancelar pedido
            </Button>
          )}
        </Box>
      </Paper>

      {editando ? (
        <EdicaoItens
          pedido={pedido}
          onCancelar={() => setEditando(false)}
          onSalvo={(data) => {
            aplicar(data);
            setEditando(false);
          }}
        />
      ) : (
        <Paper variant="outlined" sx={{ mb: 2 }}>
          <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1 }}>
              Itens
            </Typography>
            {abaixo > 0 && (
              <Chip
                size="small"
                color="warning"
                icon={<WarningAmberIcon />}
                label={`${abaixo} ${abaixo === 1 ? 'item abaixo' : 'itens abaixo'} do preço mínimo`}
              />
            )}
          </Box>
          <TabelaItens itens={itens} />
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Histórico
        </Typography>
        {(pedido.historico ?? []).map((h) => (
          <Box key={h.id} sx={{ borderLeft: 2, borderColor: 'divider', pl: 1.5, pb: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {h.descricao}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatarDataHora(h.created_at)} · {h.usuario?.nome ?? 'Sistema'}
            </Typography>
            {h.motivo && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                Motivo: {h.motivo}
              </Typography>
            )}
            {h.snapshot && h.snapshot.itens.some((i) => i.requer_autorizacao) && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                {h.snapshot.itens
                  .filter((i) => i.requer_autorizacao)
                  .map((i) => `${i.descricao}: ${formatarMoeda(i.preco)} (mín. ${formatarMoeda(i.preco_minimo)})`)
                  .join(' · ')}
              </Typography>
            )}
          </Box>
        ))}
      </Paper>

      <DialogoMotivo
        acao={acao}
        pendente={mutacaoAcao.isPending}
        onFechar={() => setAcao(null)}
        onConfirmar={(motivo) => acao && mutacaoAcao.mutate({ nome: acao, motivo })}
      />

      <Dialog open={confirmandoConclusao} onClose={() => setConfirmandoConclusao(false)}>
        <DialogTitle>Concluir pedido?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Marque como concluído quando o pedido já tiver sido lançado/faturado. Depois de concluído, ele não pode mais
            ser editado nem cancelado.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmandoConclusao(false)}>Voltar</Button>
          <Button
            variant="contained"
            color="success"
            disabled={mutacaoAcao.isPending}
            onClick={() => mutacaoAcao.mutate({ nome: 'concluir' })}
          >
            Concluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function TabelaItens({ itens }: { itens: PedidoVendaItem[] }) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Produto</TableCell>
          <TableCell align="right">Qtd.</TableCell>
          <TableCell align="right">Tabela</TableCell>
          <TableCell align="right">Mínimo</TableCell>
          <TableCell align="right">Preço</TableCell>
          <TableCell align="right">Desconto</TableCell>
          <TableCell align="right">Subtotal</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {itens.map((i) => (
          <TableRow key={i.id} sx={{ bgcolor: (t) => (i.requer_autorizacao ? alpha(t.palette.warning.main, 0.08) : undefined) }}>
            <TableCell>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {i.produto?.descricao ?? '—'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {[i.produto?.codigo_externo, i.produto?.codigo_barras].filter(Boolean).join(' · ')}
              </Typography>
            </TableCell>
            <TableCell align="right">{formatarNumero(i.quantidade)}</TableCell>
            <TableCell align="right">{formatarMoeda(i.preco_tabela)}</TableCell>
            <TableCell align="right" title={`Desconto máximo: ${formatarPct(i.desconto_maximo_pct ?? 0)}`}>
              {formatarMoeda(i.preco_minimo)}
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 600, color: i.requer_autorizacao ? 'warning.dark' : undefined }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                {i.requer_autorizacao && <WarningAmberIcon color="warning" sx={{ fontSize: 16 }} titleAccess="Abaixo do mínimo" />}
                {formatarMoeda(i.preco)}
              </Box>
            </TableCell>
            <TableCell align="right">{formatarPct(i.desconto_pct)}</TableCell>
            <TableCell align="right">{formatarMoeda(i.subtotal)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

interface LinhaEdicao {
  produtoUuid: string;
  descricao: string;
  precoMinimo: number;
  quantidade: string;
  preco: string;
}

function numeroBr(v: string): number {
  const t = v.trim();
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
}

// Correção pelo back-office (caso 3 do §3): ajusta quantidade/preço ou remove itens. Salvar um
// pedido aprovado o devolve pra rascunho — a aprovação anterior não cobre a edição.
function EdicaoItens({
  pedido,
  onCancelar,
  onSalvo,
}: {
  pedido: PedidoVenda;
  onCancelar: () => void;
  onSalvo: (data: PedidoVendaDetailResponse) => void;
}) {
  const [linhas, setLinhas] = useState<LinhaEdicao[]>(() =>
    (pedido.itens ?? []).map((i) => ({
      produtoUuid: i.produto?.id ?? '',
      descricao: i.produto?.descricao ?? '—',
      precoMinimo: i.preco_minimo,
      quantidade: String(i.quantidade).replace('.', ','),
      preco: i.preco.toFixed(2).replace('.', ','),
    })),
  );
  const [observacao, setObservacao] = useState(pedido.observacao ?? '');
  const [erro, setErro] = useState<string | null>(null);

  const salvar = useMutation({
    mutationFn: () =>
      atualizarPedidoVenda(pedido.id, {
        observacao: observacao.trim() || null,
        itens: linhas.map((l) => ({ produto_uuid: l.produtoUuid, quantidade: numeroBr(l.quantidade), preco: numeroBr(l.preco) })),
      }),
    onSuccess: onSalvo,
    onError: (err) => setErro(mensagemErro(err)),
  });

  const invalido = linhas.length === 0 || linhas.some((l) => !(numeroBr(l.quantidade) > 0) || !(numeroBr(l.preco) > 0));

  function alterar(idx: number, campo: 'quantidade' | 'preco', valor: string) {
    setLinhas((atual) => atual.map((l, i) => (i === idx ? { ...l, [campo]: valor } : l)));
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        Corrigir itens
      </Typography>
      {pedido.status === 'APROVADO' && (
        <Alert severity="warning" sx={{ my: 1 }}>
          Este pedido já está aprovado. Salvar a correção devolve ele para rascunho — se ainda houver item abaixo do
          mínimo, vai precisar de nova autorização.
        </Alert>
      )}
      {erro && (
        <Alert severity="error" sx={{ my: 1 }}>
          {erro}
        </Alert>
      )}
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Produto</TableCell>
            <TableCell sx={{ width: 140 }}>Quantidade</TableCell>
            <TableCell sx={{ width: 160 }}>Preço (R$)</TableCell>
            <TableCell sx={{ width: 48 }} />
          </TableRow>
        </TableHead>
        <TableBody>
          {linhas.map((l, idx) => {
            const abaixo = numeroBr(l.preco) < l.precoMinimo;
            return (
              <TableRow key={l.produtoUuid}>
                <TableCell>{l.descricao}</TableCell>
                <TableCell>
                  <TextField size="small" value={l.quantidade} onChange={(e) => alterar(idx, 'quantidade', e.target.value)} />
                </TableCell>
                <TableCell>
                  <TextField
                    size="small"
                    value={l.preco}
                    onChange={(e) => alterar(idx, 'preco', e.target.value)}
                    color={abaixo ? 'warning' : undefined}
                    focused={abaixo || undefined}
                    helperText={abaixo ? `Mínimo ${formatarMoeda(l.precoMinimo)}` : undefined}
                  />
                </TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    onClick={() => setLinhas((atual) => atual.filter((_, i) => i !== idx))}
                    disabled={linhas.length === 1}
                    title={linhas.length === 1 ? 'O pedido precisa de pelo menos um item — cancele o pedido' : 'Remover'}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <TextField
        label="Observação"
        value={observacao}
        onChange={(e) => setObservacao(e.target.value)}
        fullWidth
        multiline
        minRows={2}
        margin="normal"
      />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onCancelar}>Descartar</Button>
        <Button variant="contained" disabled={invalido || salvar.isPending} onClick={() => salvar.mutate()}>
          Salvar correção
        </Button>
      </Box>
    </Paper>
  );
}

function DialogoMotivo({
  acao,
  pendente,
  onFechar,
  onConfirmar,
}: {
  acao: AcaoComMotivo | null;
  pendente: boolean;
  onFechar: () => void;
  onConfirmar: (motivo: string | undefined) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const config = acao ? DIALOGO[acao] : null;

  function fechar() {
    setMotivo('');
    onFechar();
  }

  return (
    <Dialog open={!!acao} onClose={fechar} maxWidth="sm" fullWidth>
      <DialogTitle>{config?.titulo}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 1 }}>{config?.texto}</DialogContentText>
        <TextField
          label={config?.rotulo}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          fullWidth
          multiline
          minRows={2}
          autoFocus
          required={config?.obrigatorio}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={fechar}>Voltar</Button>
        <Button
          variant="contained"
          color={acao === 'aprovar' ? 'success' : 'error'}
          disabled={pendente || (!!config?.obrigatorio && motivo.trim() === '')}
          onClick={() => {
            onConfirmar(motivo.trim() || undefined);
            setMotivo('');
          }}
        >
          {config?.botao}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">
        {rotulo}
      </Typography>
      <Typography variant="body2">{children}</Typography>
    </Box>
  );
}

import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  FormGroup,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  atualizarWebhook,
  buscarCatalogoEscopos,
  criarWebhook,
  excluirWebhook,
  listarEntregasWebhook,
  listarWebhooks,
  novoSegredoWebhook,
  reenviarEntrega,
  testarWebhook,
  type EntregaWebhook,
  type Webhook,
} from '../../lib/api/integracoes';
import { dataHoraCurta, mensagemErro } from './comum';

// docs/96 Fase 4 — webhooks da integração: o Horus avisa o sistema do cliente quando algo acontece.
// O segredo da assinatura aparece só ao criar e ao gerar um novo.

const SITUACAO: Record<EntregaWebhook['situacao'], { rotulo: string; cor: 'success' | 'error' | 'warning' | 'default' }> = {
  entregue: { rotulo: 'Entregue', cor: 'success' },
  abandonada: { rotulo: 'Abandonada', cor: 'error' },
  tentando: { rotulo: 'Tentando de novo', cor: 'warning' },
  na_fila: { rotulo: 'Na fila', cor: 'default' },
};

interface Props {
  integracao: string;
  revogada: boolean;
}

function Entregas({ integracao, webhook }: { integracao: string; webhook: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['integracoes', integracao, 'webhooks', webhook, 'entregas'], queryFn: () => listarEntregasWebhook(integracao, webhook) });
  const reenviar = useMutation({
    mutationFn: (entrega: string) => reenviarEntrega(integracao, webhook, entrega),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['integracoes', integracao, 'webhooks'] }),
  });

  if (query.data?.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1.5 }}>
        Nenhum aviso enviado ainda.
      </Typography>
    );
  }

  return (
    <TableContainer>
      <Table size="small" sx={{ minWidth: 560 }}>
        <TableHead>
          <TableRow>
            <TableCell>Quando</TableCell>
            <TableCell>Evento</TableCell>
            <TableCell>Situação</TableCell>
            <TableCell>Resposta</TableCell>
            <TableCell align="right" />
          </TableRow>
        </TableHead>
        <TableBody>
          {query.data?.map((e) => (
            <TableRow key={e.uuid}>
              <TableCell>{dataHoraCurta(e.created_at)}</TableCell>
              <TableCell sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>{e.evento}</TableCell>
              <TableCell>
                <Chip size="small" label={SITUACAO[e.situacao].rotulo} color={SITUACAO[e.situacao].cor} variant={SITUACAO[e.situacao].cor === 'default' ? 'outlined' : 'filled'} />
                {e.tentativas > 1 && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {e.tentativas} tentativas
                  </Typography>
                )}
              </TableCell>
              <TableCell sx={{ fontSize: 12, maxWidth: 280 }}>
                {e.ultimo_status ?? '—'}
                {e.ultimo_erro && (
                  <Typography variant="caption" component="div" color="error.main" sx={{ wordBreak: 'break-word' }}>
                    {e.ultimo_erro}
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                {(e.situacao === 'abandonada' || e.situacao === 'tentando') && (
                  <Button size="small" onClick={() => reenviar.mutate(e.uuid)} disabled={reenviar.isPending}>
                    Reenviar
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export function WebhooksPanel({ integracao, revogada }: Props) {
  const queryClient = useQueryClient();
  const catalogo = useQuery({ queryKey: ['integracoes', 'escopos'], queryFn: buscarCatalogoEscopos, staleTime: Infinity });
  const query = useQuery({ queryKey: ['integracoes', integracao, 'webhooks'], queryFn: () => listarWebhooks(integracao) });
  const [editando, setEditando] = useState<Webhook | 'novo' | null>(null);
  const [url, setUrl] = useState('');
  const [eventos, setEventos] = useState<string[]>([]);
  const [segredo, setSegredo] = useState<string | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const permitidos = new Set(query.data?.eventos_permitidos ?? []);
  const rotulo = (valor: string) => catalogo.data?.eventos.find((e) => e.valor === valor)?.rotulo ?? valor;

  function atualizar() {
    void queryClient.invalidateQueries({ queryKey: ['integracoes', integracao, 'webhooks'] });
  }

  function abrir(w: Webhook | 'novo') {
    setErroForm(null);
    setEditando(w);
    setUrl(w === 'novo' ? '' : w.url);
    setEventos(w === 'novo' ? [] : w.eventos);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (editando === 'novo') return criarWebhook(integracao, { url: url.trim(), eventos });
      await atualizarWebhook(integracao, (editando as Webhook).uuid, { url: url.trim(), eventos });
      return null;
    },
    onSuccess: (r) => {
      setEditando(null);
      if (r) setSegredo(r.segredo);
      atualizar();
    },
    onError: (e) => setErroForm(mensagemErro(e, 'Não foi possível salvar o webhook.')),
  });

  const acao = useMutation({
    mutationFn: async ({ tipo, w }: { tipo: 'testar' | 'ligar' | 'desligar' | 'segredo' | 'excluir'; w: Webhook }) => {
      if (tipo === 'testar') {
        const r = await testarWebhook(integracao, w.uuid);
        setAviso(
          r.ok
            ? { tipo: 'success', texto: `Aviso de teste entregue (${r.entrega.ultimo_status}, ${r.entrega.ultima_duracao_ms} ms).` }
            : { tipo: 'error', texto: `O teste falhou: ${r.entrega.ultimo_erro ?? 'sem resposta'}` },
        );
      } else if (tipo === 'segredo') {
        setSegredo((await novoSegredoWebhook(integracao, w.uuid)).segredo);
      } else if (tipo === 'excluir') {
        await excluirWebhook(integracao, w.uuid);
      } else {
        await atualizarWebhook(integracao, w.uuid, { ativo: tipo === 'ligar' });
      }
    },
    onSuccess: atualizar,
    onError: (e) => setAviso({ tipo: 'error', texto: mensagemErro(e, 'Não foi possível concluir a ação.') }),
  });

  return (
    <Paper sx={{ mt: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            Webhooks
          </Typography>
          <Typography variant="body2" color="text.secondary">
            O Horus avisa o sistema do cliente quando uma visita fecha ou uma ruptura aparece. Cada aviso vai assinado (HMAC-SHA256).
          </Typography>
        </Box>
        {!revogada && (
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => abrir('novo')} disabled={(query.data?.webhooks.length ?? 0) >= 5}>
            Novo webhook
          </Button>
        )}
      </Box>

      {aviso && (
        <Alert severity={aviso.tipo} onClose={() => setAviso(null)} sx={{ mx: 2.5, mb: 1.5 }}>
          {aviso.texto}
        </Alert>
      )}

      {query.data?.webhooks.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ px: 2.5, pb: 2 }}>
          Nenhum webhook. Sem eles, o sistema do cliente só fica sabendo das coisas quando consulta a API.
        </Typography>
      )}

      <Stack divider={<Box sx={{ borderTop: 1, borderColor: 'divider' }} />}>
        {query.data?.webhooks.map((w) => (
          <Box key={w.uuid}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between', alignItems: 'flex-start', px: 2.5, py: 1.5 }}>
              <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }} useFlexGap>
                  <Typography variant="body2" sx={{ fontFamily: 'IBM Plex Mono, monospace', wordBreak: 'break-all' }}>
                    {w.url}
                  </Typography>
                  <Chip size="small" label={w.ativo ? 'Ligado' : 'Desligado'} color={w.ativo ? 'success' : 'default'} variant={w.ativo ? 'filled' : 'outlined'} />
                  {(w.pendentes ?? 0) > 0 && <Chip size="small" label={`${w.pendentes} na fila`} variant="outlined" />}
                </Stack>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 1 }}>
                  {w.eventos.map((e) => (
                    <Chip key={e} size="small" label={rotulo(e)} color={permitidos.has(e) ? 'primary' : 'default'} variant="outlined" title={permitidos.has(e) ? undefined : 'A integração não tem a permissão de leitura deste evento: ele não é enviado.'} />
                  ))}
                </Box>
                <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75 }}>
                  Última entrega: {dataHoraCurta(w.ultima_entrega_em)}
                  {w.falhas_seguidas > 0 ? ` · ${w.falhas_seguidas} falha(s) seguida(s)` : ''}
                </Typography>
                {w.desativado_motivo && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    {w.desativado_motivo}
                  </Alert>
                )}
              </Box>
              {!revogada && (
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  <Button size="small" onClick={() => acao.mutate({ tipo: 'testar', w })} disabled={acao.isPending}>
                    Testar
                  </Button>
                  <Button size="small" onClick={() => setAberto(aberto === w.uuid ? null : w.uuid)}>
                    {aberto === w.uuid ? 'Ocultar avisos' : 'Ver avisos'}
                  </Button>
                  <Button size="small" onClick={() => abrir(w)}>
                    Editar
                  </Button>
                  <Button size="small" onClick={() => acao.mutate({ tipo: w.ativo ? 'desligar' : 'ligar', w })}>
                    {w.ativo ? 'Desligar' : 'Ligar'}
                  </Button>
                  <Button size="small" onClick={() => window.confirm('Gerar um segredo novo? O sistema do cliente precisa trocar o segredo para continuar validando os avisos.') && acao.mutate({ tipo: 'segredo', w })}>
                    Novo segredo
                  </Button>
                  <Button size="small" color="error" onClick={() => window.confirm(`Excluir o webhook ${w.url}?`) && acao.mutate({ tipo: 'excluir', w })}>
                    Excluir
                  </Button>
                </Stack>
              )}
            </Box>
            <Collapse in={aberto === w.uuid} unmountOnExit>
              <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
                <Entregas integracao={integracao} webhook={w.uuid} />
              </Box>
            </Collapse>
          </Box>
        ))}
      </Stack>

      <Dialog open={editando !== null} onClose={() => setEditando(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{editando === 'novo' ? 'Novo webhook' : 'Editar webhook'}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {erroForm && <Alert severity="error">{erroForm}</Alert>}
            <TextField
              label="Endereço (URL)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://sistema-do-cliente.com.br/horus/avisos"
              fullWidth
              required
              helperText="Precisa ser https:// e público (rede interna é recusada)."
              slotProps={{ htmlInput: { style: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 } } }}
            />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                Avisar quando
              </Typography>
              <FormGroup>
                {catalogo.data?.eventos.map((e) => {
                  const pode = permitidos.has(e.valor);
                  return (
                    <FormControlLabel
                      key={e.valor}
                      disabled={!pode}
                      control={
                        <Checkbox
                          checked={eventos.includes(e.valor)}
                          onChange={() => setEventos((atual) => (atual.includes(e.valor) ? atual.filter((v) => v !== e.valor) : [...atual, e.valor]))}
                        />
                      }
                      label={
                        <span>
                          {e.rotulo}
                          {!pode && (
                            <Typography component="span" variant="caption" color="text.secondary">
                              {' '}
                              · precisa da permissão {e.escopo}
                            </Typography>
                          )}
                        </span>
                      }
                    />
                  );
                })}
              </FormGroup>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditando(null)}>Cancelar</Button>
          <Button variant="contained" onClick={() => salvar.mutate()} disabled={!url.trim() || eventos.length === 0 || salvar.isPending}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={segredo !== null} maxWidth="sm" fullWidth>
        <DialogTitle>Segredo da assinatura</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
            Copie agora e configure no sistema do cliente: ele não aparece de novo. Cada aviso traz o cabeçalho <code>X-Horus-Assinatura: t=…,v1=…</code>, com v1 =
            HMAC-SHA256(segredo, &quot;t.corpo&quot;).
          </DialogContentText>
          <TextField
            value={segredo ?? ''}
            fullWidth
            onFocus={(e) => e.target.select()}
            slotProps={{ htmlInput: { readOnly: true, style: { fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 } } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => void navigator.clipboard?.writeText(segredo ?? '')}>Copiar</Button>
          <Button variant="contained" onClick={() => setSegredo(null)}>
            Já guardei
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

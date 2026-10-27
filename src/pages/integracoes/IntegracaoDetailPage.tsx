import ArrowBackIcon from '@mui/icons-material/ArrowBack';
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
  FormControlLabel,
  MenuItem,
  Paper,
  Stack,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import {
  buscarIntegracao,
  listarRequisicoes,
  pausarIntegracao,
  reativarIntegracao,
  revogarIntegracao,
  rotacionarToken,
} from '../../lib/api/integracoes';
import { tempoDesde } from '../../lib/formatarData';
import { dataCurta, dataHoraCurta, mensagemErro, rotuloValidade, SituacaoChip } from './comum';
import { IntegracaoFormDialog } from './IntegracaoFormDialog';
import { TokenCriadoDialog } from './TokenCriadoDialog';
import { WebhooksPanel } from './WebhooksPanel';

// docs/96 §8.3 — detalhe: permissões, tokens valendo, uso de hoje, últimas requisições e as ações
// (editar, gerar novo token, pausar, revogar).

const VALIDADES = [30, 90, 180, 365];

function Indicador({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
      <Box sx={{ mt: 0.5 }}>{children}</Box>
    </Paper>
  );
}

export function IntegracaoDetailPage() {
  const { publicId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [soErros, setSoErros] = useState(false);
  const [editando, setEditando] = useState(false);
  const [rotacionando, setRotacionando] = useState(false);
  const [validadeNova, setValidadeNova] = useState<number | null>(365);
  const [revogando, setRevogando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [novoToken, setNovoToken] = useState<{ token: string; antigoValidoAte: string } | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['integracoes', publicId], queryFn: () => buscarIntegracao(publicId) });
  const requisicoes = useQuery({ queryKey: ['integracoes', publicId, 'requisicoes', soErros], queryFn: () => listarRequisicoes(publicId, soErros) });
  const integracao = query.data;
  const cabecalho = usePageHeader(<TituloComAtualizar titulo={integracao?.nome ?? 'Integração'} />);

  function atualizar() {
    void queryClient.invalidateQueries({ queryKey: ['integracoes'] });
  }

  const pausa = useMutation({
    mutationFn: () => (integracao?.situacao === 'pausada' ? reativarIntegracao(publicId) : pausarIntegracao(publicId)),
    onSuccess: atualizar,
    onError: (e) => setErro(mensagemErro(e, 'Não foi possível alterar a integração.')),
  });
  const rotacao = useMutation({
    mutationFn: () => rotacionarToken(publicId, validadeNova),
    onSuccess: (r) => {
      setRotacionando(false);
      setNovoToken({ token: r.token, antigoValidoAte: r.antigo_valido_ate });
      atualizar();
    },
    onError: (e) => setErro(mensagemErro(e, 'Não foi possível gerar o novo token.')),
  });
  const revogacao = useMutation({
    mutationFn: () => revogarIntegracao(publicId, motivo.trim()),
    onSuccess: () => {
      setRevogando(false);
      setMotivo('');
      atualizar();
    },
    onError: (e) => setErro(mensagemErro(e, 'Não foi possível revogar a integração.')),
  });

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!integracao) {
    return <Alert severity="error">Integração não encontrada.</Alert>;
  }

  const revogada = integracao.situacao === 'revogada';

  return (
    <Box>
      {cabecalho}
      <Button startIcon={<ArrowBackIcon />} size="small" onClick={() => navigate('/integracoes')} sx={{ mb: 1 }}>
        Integrações
      </Button>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
        <Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {integracao.nome}
            </Typography>
            <SituacaoChip situacao={integracao.situacao} />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {[integracao.descricao, integracao.criada_por && `criada por ${integracao.criada_por} em ${dataCurta(integracao.created_at)}`].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
        {!revogada && (
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => setEditando(true)}>
              Editar permissões
            </Button>
            <Button variant="outlined" onClick={() => setRotacionando(true)}>
              Gerar novo token
            </Button>
            <Button variant="outlined" onClick={() => pausa.mutate()} disabled={pausa.isPending}>
              {integracao.situacao === 'pausada' ? 'Reativar' : 'Pausar'}
            </Button>
            <Button variant="outlined" color="error" onClick={() => setRevogando(true)}>
              Revogar
            </Button>
          </Stack>
        )}
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}
      {revogada && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Revogada por {integracao.revogada_por ?? '—'} em {dataHoraCurta(integracao.revogada_em)}
          {integracao.revogada_motivo ? `: "${integracao.revogada_motivo}"` : ''}. Os tokens não funcionam mais. Para voltar a integrar, crie uma nova.
        </Alert>
      )}
      {integracao.situacao === 'pausada' && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Pausada: as chamadas recebem 403 até você reativar. Os tokens continuam guardados.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 1.5, mb: 2 }}>
        <Indicador rotulo="Requisições hoje">
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {(integracao.uso_hoje?.requisicoes ?? 0).toLocaleString('pt-BR')}
          </Typography>
        </Indicador>
        <Indicador rotulo="Erros hoje">
          <Typography variant="h5" sx={{ fontWeight: 600 }} color={integracao.uso_hoje?.erros ? 'error.main' : undefined}>
            {integracao.uso_hoje?.erros ?? 0}
          </Typography>
        </Indicador>
        <Indicador rotulo="Último uso">
          <Typography sx={{ fontWeight: 600 }}>
            {integracao.ultimo_uso_em ? `há ${tempoDesde(integracao.ultimo_uso_em)}` : 'nunca'}{' '}
            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
              {integracao.ultimo_ip}
            </Typography>
          </Typography>
        </Indicador>
        <Indicador rotulo="Limite">
          <Typography sx={{ fontWeight: 600 }}>{integracao.limite_por_minuto} / minuto</Typography>
        </Indicador>
      </Box>

      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
        <Paper sx={{ p: 2.5, flex: '1 1 320px', minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
            Permissões de acesso
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2.5 }}>
            {integracao.escopos.map((e) => (
              <Chip key={e} size="small" label={e} color="primary" variant="outlined" />
            ))}
          </Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }} gutterBottom>
            Tokens
          </Typography>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {integracao.tokens.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Nenhum token valendo{revogada ? '.' : '. Gere um novo para a integração voltar a funcionar.'}
              </Typography>
            )}
            {integracao.tokens.map((t) => (
              <Box
                key={t.prefixo + (t.expira_em ?? '')}
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 1,
                  px: 1.5,
                  py: 1,
                  borderRadius: 1,
                  border: 1,
                  borderStyle: t.antigo ? 'dashed' : 'solid',
                  borderColor: t.antigo ? 'warning.light' : 'divider',
                  fontSize: 13,
                }}
              >
                <Box component="span" sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                  {t.prefixo}
                </Box>
                <Typography variant="body2" color={t.antigo ? 'warning.dark' : 'text.secondary'}>
                  {t.antigo ? `antigo · para em ${dataCurta(t.expira_em)}` : t.expira_em ? `vale até ${dataCurta(t.expira_em)}` : 'sem validade'}
                </Typography>
              </Box>
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            IPs permitidos: {integracao.ips_permitidos.length ? integracao.ips_permitidos.join(', ') : 'qualquer um'}
          </Typography>
        </Paper>

        <Paper sx={{ flex: '999 1 560px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, px: 2.5, py: 1.5 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Últimas requisições
            </Typography>
            <FormControlLabel control={<Switch size="small" checked={soErros} onChange={(e) => setSoErros(e.target.checked)} />} label="Só erros" />
          </Box>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 560 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Quando</TableCell>
                  <TableCell>Rota</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Itens</TableCell>
                  <TableCell align="right">Tempo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requisicoes.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">
                        {soErros ? 'Nenhum erro registrado.' : 'Nenhuma chamada ainda.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
                {requisicoes.data?.map((r, idx) => (
                  <Fragment key={`${r.created_at}-${idx}`}>
                    <TableRow sx={r.status >= 400 ? { bgcolor: 'error.light', '& td': { borderBottom: r.erro ? 0 : undefined } } : undefined}>
                      <TableCell>{dataHoraCurta(r.created_at)}</TableCell>
                      <TableCell sx={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: 12 }}>
                        {r.metodo} {r.rota.replace('/api/integracao', '')}
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'IBM Plex Mono, monospace', color: r.status >= 400 ? 'error.main' : 'success.main' }}>{r.status}</TableCell>
                      <TableCell align="right">{r.registros ?? '—'}</TableCell>
                      <TableCell align="right">{r.duracao_ms} ms</TableCell>
                    </TableRow>
                    {r.status >= 400 && r.erro && (
                      <TableRow sx={{ bgcolor: 'error.light' }}>
                        <TableCell colSpan={5} sx={{ pt: 0, color: 'error.main', fontSize: 12 }}>
                          {r.erro}
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ px: 2.5, py: 1.5, m: 0, borderTop: 1, borderColor: 'divider' }}>
            Guardamos as requisições por 90 dias.
          </Typography>
        </Paper>
      </Box>

      <WebhooksPanel integracao={integracao.uuid} revogada={revogada} />

      <IntegracaoFormDialog open={editando} integracao={integracao} onClose={() => setEditando(false)} />

      <Dialog open={rotacionando} onClose={() => setRotacionando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Gerar novo token</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            O token atual continua valendo por mais 7 dias, para dar tempo de trocar no sistema do cliente. Depois, para sozinho.
          </DialogContentText>
          <TextField
            select
            fullWidth
            label="Validade do novo token"
            value={validadeNova === null ? 'sem' : String(validadeNova)}
            onChange={(e) => setValidadeNova(e.target.value === 'sem' ? null : Number(e.target.value))}
          >
            {VALIDADES.map((d) => (
              <MenuItem key={d} value={String(d)}>
                {rotuloValidade(d)}
              </MenuItem>
            ))}
            <MenuItem value="sem">Sem validade</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRotacionando(false)}>Cancelar</Button>
          <Button variant="contained" onClick={() => rotacao.mutate()} disabled={rotacao.isPending}>
            Gerar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={revogando} onClose={() => setRevogando(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Revogar {integracao.nome}?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Todos os tokens param na hora, e não tem como desfazer. A integração continua na lista para auditoria.
          </DialogContentText>
          <TextField autoFocus fullWidth required label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder='ex.: "token vazou", "projeto encerrado"' />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevogando(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={() => revogacao.mutate()} disabled={!motivo.trim() || revogacao.isPending}>
            Revogar
          </Button>
        </DialogActions>
      </Dialog>

      <TokenCriadoDialog
        open={novoToken !== null}
        nome={integracao.nome}
        token={novoToken?.token ?? null}
        antigoValidoAte={novoToken?.antigoValidoAte}
        onClose={() => setNovoToken(null)}
      />
    </Box>
  );
}

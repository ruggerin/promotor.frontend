import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import BlockIcon from '@mui/icons-material/Block';
import CheckIcon from '@mui/icons-material/Check';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import UndoIcon from '@mui/icons-material/Undo';
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
  Divider,
  Link as MuiLink,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useRef, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import {
  adicionarEtapaPlanoAcao,
  alterarStatusEtapa,
  baixarEvidencia,
  buscarPlanoAcao,
  cancelarPlanoAcao,
  concluirPlanoAcao,
  listarResponsaveisPlanoAcao,
  type PermissoesPlanoAcao,
  type PlanoAcaoDetailResponse,
} from '../../lib/api/planosAcao';
import type { PlanoAcao, PlanoAcaoEtapa, StatusEtapaPlanoAcao } from '../../types/api';
import { EtapaCampos } from './EtapaCampos';
import { etapaParaPayload, etapaVazia, mensagemErro, type EtapaForm } from './etapaForm';
import {
  formatarDataHora,
  formatarDuracao,
  formatarPrazo,
  planoAtivo,
  STATUS_ETAPA,
  STATUS_PLANO,
  TRANSICOES_ETAPA,
} from './statusPlanoAcao';

// Cor do marcador da timeline por status da etapa (bloqueada/atrasada sempre destacadas).
function corMarcador(etapa: PlanoAcaoEtapa): string {
  if (etapa.status === 'BLOQUEADA') return '#dc2626';
  if (etapa.atrasada) return '#f59e0b';
  if (etapa.status === 'FEITA') return '#15803d';
  if (etapa.status === 'CANCELADA') return '#9ca3af';
  if (etapa.status === 'EM_ANDAMENTO') return '#4f46e5';
  return '#c7c9d9';
}

type AcaoEtapa = { etapa: PlanoAcaoEtapa; status: StatusEtapaPlanoAcao };

// Detalhe do Plano de Ação — timeline das etapas + detalhes/evidências na lateral + histórico
// append-only. Layout do protótipo (docs/37-agentes/37-PROTOTIPO.md). Ver docs/37-PLANOS-DE-ACAO.md.
export function PlanoAcaoDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [acaoEtapa, setAcaoEtapa] = useState<AcaoEtapa | null>(null);
  const [adicionando, setAdicionando] = useState(false);
  const [confirmandoConclusao, setConfirmandoConclusao] = useState(false);
  const [cancelando, setCancelando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const query = useQuery({ queryKey: ['planos-acao', publicId], queryFn: () => buscarPlanoAcao(publicId!) });
  const plano = query.data?.plano_acao;
  const permissoes = query.data?.permissoes;

  function aplicarResposta(data: PlanoAcaoDetailResponse) {
    queryClient.setQueryData(['planos-acao', publicId], data);
    void queryClient.invalidateQueries({ queryKey: ['planos-acao'], exact: false, refetchType: 'none' });
    void queryClient.invalidateQueries({ queryKey: ['atividades'] });
    setErro(null);
  }

  // Transições sem formulário (iniciar, voltar pra pendente) vão direto; as outras abrem diálogo.
  const statusDiretoMutation = useMutation({
    mutationFn: ({ etapa, status }: AcaoEtapa) => alterarStatusEtapa(plano!.id, etapa.id, { status }),
    onSuccess: aplicarResposta,
    onError: (err) => setErro(mensagemErro(err, 'Não foi possível alterar a etapa.')),
  });

  const concluirMutation = useMutation({
    mutationFn: () => concluirPlanoAcao(plano!.id),
    onSuccess: (data) => {
      aplicarResposta(data);
      setConfirmandoConclusao(false);
    },
    onError: (err) => {
      setConfirmandoConclusao(false);
      setErro(mensagemErro(err, 'Não foi possível concluir o plano.'));
    },
  });

  function acionarEtapa(etapa: PlanoAcaoEtapa, status: StatusEtapaPlanoAcao) {
    if (status === 'PENDENTE' || status === 'EM_ANDAMENTO') {
      statusDiretoMutation.mutate({ etapa, status });
    } else {
      setAcaoEtapa({ etapa, status });
    }
  }

  const cabecalho = usePageHeader(
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => navigate('/planos-acao')}>
        Planos de Ação
      </Button>
      {plano && (
        <Typography variant="h6" sx={{ fontWeight: 700 }} noWrap>
          {plano.titulo}
        </Typography>
      )}
    </Box>,
  );

  if (query.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 6 }}>
        {cabecalho}
        <CircularProgress />
      </Box>
    );
  }

  if (!plano || !permissoes) {
    const status = axios.isAxiosError(query.error) ? query.error.response?.status : undefined;
    return (
      <Box>
        {cabecalho}
        <Alert severity="error">
          {status === 403
            ? 'Seu perfil não tem a permissão "Planos de Ação — visualizar".'
            : 'Plano de ação não encontrado.'}
        </Alert>
      </Box>
    );
  }

  const ativo = planoAtivo(plano.status);
  const etapas = plano.etapas ?? [];
  const etapasEmAberto = etapas.filter((e) => e.status !== 'FEITA' && e.status !== 'CANCELADA').length;
  const podeMovimentar = ativo && permissoes.movimentar_etapa;
  const evidencias = etapas.filter((e) => e.evidencia_texto || e.evidencia_arquivo_url);

  return (
    <Box>
      {cabecalho}

      {/* Faixa de status + ações do plano. */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Chip label={STATUS_PLANO[plano.status].label} color={STATUS_PLANO[plano.status].cor} />
        {plano.atrasado && <Chip icon={<WarningAmberIcon />} label="Atrasado" color="error" variant="outlined" />}
        <Typography variant="body2" color="text.secondary">
          {etapas.length - etapasEmAberto}/{etapas.length} etapas finalizadas · aberto há{' '}
          {formatarDuracao(plano.created_at, plano.concluido_em ?? plano.cancelado_em)}
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {ativo && (
          <>
            <Button
              color="inherit"
              disabled={!permissoes.cancelar}
              onClick={() => setCancelando(true)}
              title={permissoes.cancelar ? undefined : 'Requer a permissão "Planos de Ação — cancelar"'}
            >
              Cancelar plano
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<CheckIcon />}
              disabled={!permissoes.concluir || etapasEmAberto > 0}
              onClick={() => setConfirmandoConclusao(true)}
            >
              Concluir plano
            </Button>
          </>
        )}
      </Paper>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 2fr) minmax(280px, 1fr)' }, gap: 2 }}>
        {/* Timeline de etapas */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Etapas
          </Typography>
          {etapas.map((etapa, i) => (
            <EtapaLinha
              key={etapa.id}
              etapa={etapa}
              ultima={i === etapas.length - 1 && !podeMovimentar}
              podeMovimentar={podeMovimentar}
              ocupado={statusDiretoMutation.isPending}
              onAcao={(status) => acionarEtapa(etapa, status)}
            />
          ))}
          {podeMovimentar && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', columnGap: 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ width: 12, height: 12, mt: 1.25, borderRadius: '50%', border: '2px dashed', borderColor: 'divider' }} />
              </Box>
              <Box>
                <Button startIcon={<AddIcon />} onClick={() => setAdicionando(true)}>
                  Adicionar nova etapa
                </Button>
              </Box>
            </Box>
          )}
        </Box>

        {/* Lateral: detalhes, evidências, aviso de permissão */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <DetalhesPlano plano={plano} />
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Evidências coletadas
            </Typography>
            {evidencias.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nenhuma evidência ainda.
              </Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {evidencias.map((e) => (
                  <Box key={e.id}>
                    <Typography variant="caption" color="text.secondary">
                      Etapa {e.ordem} · {e.titulo}
                    </Typography>
                    <Evidencia etapa={e} />
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
          <AvisoPermissoes permissoes={permissoes} ativo={ativo} etapasEmAberto={etapasEmAberto} />
        </Box>
      </Box>

      {/* Histórico append-only — só leitura (docs/37 §4.9). */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Histórico
        </Typography>
        {(plano.historico ?? []).map((h, i) => (
          <Box key={h.id}>
            {i > 0 && <Divider sx={{ my: 1 }} />}
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', minWidth: 110 }}>
                {formatarDataHora(h.created_at)}
              </Typography>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Typography variant="body2">
                  {h.descricao}
                  <Typography component="span" variant="body2" color="text.secondary">
                    {' '}
                    — {h.usuario?.nome ?? 'Sistema'}
                  </Typography>
                </Typography>
                {h.motivo && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Motivo: {h.motivo}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>
        ))}
      </Paper>

      <StatusEtapaDialog
        acao={acaoEtapa}
        planoId={plano.id}
        onClose={() => setAcaoEtapa(null)}
        onSucesso={(data) => {
          aplicarResposta(data);
          setAcaoEtapa(null);
        }}
      />
      <AdicionarEtapaDialog
        aberto={adicionando}
        planoId={plano.id}
        onClose={() => setAdicionando(false)}
        onSucesso={(data) => {
          aplicarResposta(data);
          setAdicionando(false);
        }}
      />
      <CancelarPlanoDialog
        aberto={cancelando}
        planoId={plano.id}
        onClose={() => setCancelando(false)}
        onSucesso={(data) => {
          aplicarResposta(data);
          setCancelando(false);
        }}
      />
      <Dialog open={confirmandoConclusao} onClose={() => setConfirmandoConclusao(false)}>
        <DialogTitle>Concluir plano de ação?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Confirma que o problema foi realmente resolvido? O plano deixa de aceitar movimentação e o alerta de
            origem passa a constar como resolvido.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmandoConclusao(false)}>Voltar</Button>
          <Button
            variant="contained"
            color="success"
            disabled={concluirMutation.isPending}
            onClick={() => concluirMutation.mutate()}
          >
            Concluir
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function EtapaLinha({
  etapa,
  ultima,
  podeMovimentar,
  ocupado,
  onAcao,
}: {
  etapa: PlanoAcaoEtapa;
  ultima: boolean;
  podeMovimentar: boolean;
  ocupado: boolean;
  onAcao: (status: StatusEtapaPlanoAcao) => void;
}) {
  const cor = corMarcador(etapa);
  const transicoes = podeMovimentar ? TRANSICOES_ETAPA[etapa.status] : [];
  const finalizada = etapa.status === 'FEITA' || etapa.status === 'CANCELADA';

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '28px minmax(0,1fr)', columnGap: 1.5 }}>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!ultima && <Box sx={{ position: 'absolute', top: 12, bottom: 0, width: '2px', bgcolor: 'divider' }} />}
        <Box
          sx={{
            position: 'relative',
            width: 24,
            height: 24,
            mt: 1.25,
            borderRadius: '50%',
            bgcolor: cor,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {etapa.status === 'FEITA' ? <CheckIcon sx={{ fontSize: 16 }} /> : etapa.ordem}
        </Box>
      </Box>
      <Paper
        variant="outlined"
        sx={{
          p: 1.5,
          mb: 1.5,
          opacity: etapa.status === 'CANCELADA' ? 0.65 : 1,
          borderColor: etapa.status === 'BLOQUEADA' ? 'error.light' : undefined,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography
            variant="body1"
            sx={{ fontWeight: 600, flexGrow: 1, textDecoration: etapa.status === 'CANCELADA' ? 'line-through' : 'none' }}
          >
            {etapa.titulo}
          </Typography>
          {etapa.atrasada && <Chip size="small" label="Atrasada" color="warning" />}
          <Chip size="small" label={STATUS_ETAPA[etapa.status].label} color={STATUS_ETAPA[etapa.status].cor} />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 0.5 }}>
          <Info rotulo="Prazo">{formatarPrazo(etapa.prazo)}</Info>
          {etapa.responsavel && <Info rotulo="Responsável">{etapa.responsavel.nome}</Info>}
          {etapa.responsavel_externo_nome && (
            <Info rotulo="Externo">
              {etapa.responsavel_externo_nome}
              {etapa.responsavel_externo_contato ? ` (${etapa.responsavel_externo_contato})` : ''}
            </Info>
          )}
          {etapa.evidencia_obrigatoria && !finalizada && <Info rotulo="Evidência">obrigatória</Info>}
        </Box>

        {etapa.descricao && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, whiteSpace: 'pre-wrap' }}>
            {etapa.descricao}
          </Typography>
        )}

        {etapa.motivo && (
          <Alert severity={etapa.status === 'BLOQUEADA' ? 'error' : 'info'} sx={{ mt: 1, py: 0 }}>
            {etapa.motivo}
          </Alert>
        )}

        {etapa.status === 'FEITA' && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Feita por {etapa.feita_por?.nome ?? '—'} em {formatarDataHora(etapa.feita_em)}
              {etapa.responsavel_externo_nome ? ` (acompanhando ${etapa.responsavel_externo_nome})` : ''}
            </Typography>
            <Evidencia etapa={etapa} />
          </Box>
        )}

        {transicoes.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
            {transicoes.includes('EM_ANDAMENTO') && (
              <Button size="small" startIcon={<PlayArrowIcon />} disabled={ocupado} onClick={() => onAcao('EM_ANDAMENTO')}>
                {etapa.status === 'BLOQUEADA' ? 'Desbloquear e iniciar' : 'Iniciar'}
              </Button>
            )}
            {transicoes.includes('FEITA') && (
              <Button size="small" variant="contained" startIcon={<CheckIcon />} disabled={ocupado} onClick={() => onAcao('FEITA')}>
                Marcar como feita
              </Button>
            )}
            {transicoes.includes('PENDENTE') && (
              <Button size="small" color="inherit" startIcon={<UndoIcon />} disabled={ocupado} onClick={() => onAcao('PENDENTE')}>
                Voltar para pendente
              </Button>
            )}
            {transicoes.includes('BLOQUEADA') && (
              <Button size="small" color="error" startIcon={<BlockIcon />} disabled={ocupado} onClick={() => onAcao('BLOQUEADA')}>
                Bloquear
              </Button>
            )}
            {transicoes.includes('CANCELADA') && (
              <Button size="small" color="inherit" disabled={ocupado} onClick={() => onAcao('CANCELADA')}>
                Não se aplica
              </Button>
            )}
          </Box>
        )}
      </Paper>
    </Box>
  );
}

function Info({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <Typography variant="body2">
      <Typography component="span" variant="body2" color="text.secondary">
        {rotulo}:{' '}
      </Typography>
      {children}
    </Typography>
  );
}

function Evidencia({ etapa }: { etapa: PlanoAcaoEtapa }) {
  const [baixando, setBaixando] = useState(false);

  async function abrirAnexo() {
    if (!etapa.evidencia_arquivo_url) return;
    setBaixando(true);
    try {
      const blob = await baixarEvidencia(etapa.evidencia_arquivo_url);
      window.open(URL.createObjectURL(blob), '_blank', 'noopener');
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      {etapa.evidencia_texto && <Typography variant="body2">{etapa.evidencia_texto}</Typography>}
      {etapa.evidencia_arquivo_url && (
        <Button size="small" startIcon={<AttachFileIcon />} disabled={baixando} onClick={() => void abrirAnexo()}>
          {baixando ? 'Abrindo...' : 'Ver anexo'}
        </Button>
      )}
    </Box>
  );
}

function DetalhesPlano({ plano }: { plano: PlanoAcao }) {
  const origem = plano.origem;

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Detalhes
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Info rotulo="Origem">
          {origem
            ? `Alerta "${origem.tipo_registro?.descricao ?? '—'}"${origem.produto ? ` · ${origem.produto}` : ''}`
            : 'Criado manualmente'}
        </Info>
        {plano.ponto_venda && (
          <Info rotulo="Loja">
            <MuiLink component={RouterLink} to={`/pontos-venda/${plano.ponto_venda.id}`}>
              {plano.ponto_venda.fantasia}
            </MuiLink>
            {plano.ponto_venda.rede ? ` · rede ${plano.ponto_venda.rede.descricao}` : ''}
          </Info>
        )}
        {plano.rede_loja && <Info rotulo="Rede">{plano.rede_loja.descricao}</Info>}
        {origem && (
          <>
            <Info rotulo="Registrado">
              {formatarDataHora(origem.registrado_em)}
              {origem.promotor ? ` por ${origem.promotor}` : ''}
            </Info>
            {origem.observacao && <Info rotulo="Observação">{origem.observacao}</Info>}
            {origem.visita_id && (
              <MuiLink component={RouterLink} to={`/visitas/${origem.visita_id}`} variant="body2">
                Ver visita de origem
              </MuiLink>
            )}
            <Divider sx={{ my: 0.5 }} />
          </>
        )}
        <Info rotulo="Prazo do plano">{formatarPrazo(plano.prazo)}</Info>
        <Info rotulo="Aberto por">
          {plano.criado_por?.nome ?? '—'} em {formatarDataHora(plano.created_at)}
        </Info>
        {plano.concluido_em && (
          <Info rotulo="Concluído por">
            {plano.concluido_por?.nome ?? '—'} em {formatarDataHora(plano.concluido_em)}
          </Info>
        )}
        {plano.cancelado_em && (
          <>
            <Info rotulo="Cancelado por">
              {plano.cancelado_por?.nome ?? '—'} em {formatarDataHora(plano.cancelado_em)}
            </Info>
            {plano.motivo_cancelamento && <Info rotulo="Motivo">{plano.motivo_cancelamento}</Info>}
          </>
        )}
        {plano.descricao && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
            {plano.descricao}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

// Explica por que um botão está desabilitado — "Concluir" é deliberadamente mais restrito que
// movimentar etapa (docs/37 §4.7), e sem isso o usuário só vê um botão cinza sem saber o porquê.
function AvisoPermissoes({
  permissoes,
  ativo,
  etapasEmAberto,
}: {
  permissoes: PermissoesPlanoAcao;
  ativo: boolean;
  etapasEmAberto: number;
}) {
  if (!ativo) return null;

  const avisos: string[] = [];
  if (!permissoes.movimentar_etapa) avisos.push('Você só pode visualizar — movimentar etapas requer "Planos de Ação — movimentar etapa".');
  if (!permissoes.concluir) avisos.push('Concluir o plano requer a permissão "Planos de Ação — concluir".');
  else if (etapasEmAberto > 0)
    avisos.push(`O plano só pode ser concluído com todas as etapas feitas ou marcadas como "não se aplica" (${etapasEmAberto} em aberto).`);

  if (avisos.length === 0) return null;

  return (
    <Alert severity="info" icon={<LockOutlinedIcon />}>
      {avisos.map((a) => (
        <Typography key={a} variant="body2">
          {a}
        </Typography>
      ))}
    </Alert>
  );
}

const TITULO_DIALOGO: Partial<Record<StatusEtapaPlanoAcao, string>> = {
  FEITA: 'Marcar etapa como feita',
  BLOQUEADA: 'Bloquear etapa',
  CANCELADA: 'Etapa não se aplica',
};

function StatusEtapaDialog({
  acao,
  planoId,
  onClose,
  onSucesso,
}: {
  acao: AcaoEtapa | null;
  planoId: string;
  onClose: () => void;
  onSucesso: (data: PlanoAcaoDetailResponse) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [evidenciaTexto, setEvidenciaTexto] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: () =>
      alterarStatusEtapa(planoId, acao!.etapa.id, {
        status: acao!.status,
        motivo: motivo.trim() || undefined,
        evidencia_texto: evidenciaTexto.trim() || undefined,
        evidencia_arquivo: arquivo,
      }),
    onSuccess: onSucesso,
    onError: (err) => setErro(mensagemErro(err, 'Não foi possível alterar a etapa.')),
  });

  function fechar() {
    setMotivo('');
    setEvidenciaTexto('');
    setArquivo(null);
    setErro(null);
    onClose();
  }

  const feita = acao?.status === 'FEITA';
  const exigeMotivo = acao?.status === 'BLOQUEADA' || acao?.status === 'CANCELADA';
  const exigeEvidencia = feita && acao?.etapa.evidencia_obrigatoria;
  const valido =
    (!exigeMotivo || motivo.trim() !== '') && (!exigeEvidencia || evidenciaTexto.trim() !== '' || arquivo !== null);

  return (
    <Dialog open={!!acao} onClose={fechar} maxWidth="sm" fullWidth>
      <DialogTitle>{acao ? TITULO_DIALOGO[acao.status] : ''}</DialogTitle>
      <DialogContent>
        {acao && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Etapa {acao.etapa.ordem} · {acao.etapa.titulo}
            {feita && acao.etapa.responsavel_externo_nome
              ? ` — você registra em nome do acompanhamento de ${acao.etapa.responsavel_externo_nome}.`
              : ''}
          </Typography>
        )}
        {exigeMotivo && (
          <TextField
            autoFocus
            fullWidth
            required
            multiline
            minRows={2}
            label={acao?.status === 'BLOQUEADA' ? 'O que travou?' : 'Por que não se aplica?'}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        )}
        {feita && (
          <>
            <TextField
              autoFocus
              fullWidth
              label={exigeEvidencia ? 'Evidência (obrigatória: texto ou anexo)' : 'Evidência (opcional)'}
              placeholder="Ex.: Pedido 48213, NF 12345"
              value={evidenciaTexto}
              onChange={(e) => setEvidenciaTexto(e.target.value)}
              sx={{ mb: 1.5 }}
            />
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              hidden
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
            />
            <Button startIcon={<AttachFileIcon />} onClick={() => inputRef.current?.click()}>
              {arquivo ? arquivo.name : 'Anexar arquivo (PDF ou imagem)'}
            </Button>
          </>
        )}
        {erro && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {erro}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={fechar}>Voltar</Button>
        <Button
          variant="contained"
          color={acao?.status === 'BLOQUEADA' ? 'error' : 'primary'}
          disabled={!valido || mutation.isPending}
          onClick={() => mutation.mutate(undefined, { onSuccess: () => fechar() })}
        >
          Confirmar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AdicionarEtapaDialog({
  aberto,
  planoId,
  onClose,
  onSucesso,
}: {
  aberto: boolean;
  planoId: string;
  onClose: () => void;
  onSucesso: (data: PlanoAcaoDetailResponse) => void;
}) {
  const [etapa, setEtapa] = useState<EtapaForm>(etapaVazia());
  const [erro, setErro] = useState<string | null>(null);
  const responsaveisQuery = useQuery({
    queryKey: ['planos-acao', 'responsaveis'],
    queryFn: listarResponsaveisPlanoAcao,
    enabled: aberto,
  });

  const mutation = useMutation({
    mutationFn: () => adicionarEtapaPlanoAcao(planoId, etapaParaPayload(etapa)),
    onSuccess: (data) => {
      onSucesso(data);
      setEtapa(etapaVazia());
      setErro(null);
    },
    onError: (err) => setErro(mensagemErro(err, 'Não foi possível adicionar a etapa.')),
  });

  return (
    <Dialog open={aberto} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Adicionar nova etapa</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A etapa entra no fim da fila.
        </Typography>
        <EtapaCampos etapa={etapa} responsaveis={responsaveisQuery.data ?? []} onChange={setEtapa} />
        {erro && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {erro}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={etapa.titulo.trim() === '' || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Adicionar
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function CancelarPlanoDialog({
  aberto,
  planoId,
  onClose,
  onSucesso,
}: {
  aberto: boolean;
  planoId: string;
  onClose: () => void;
  onSucesso: (data: PlanoAcaoDetailResponse) => void;
}) {
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => cancelarPlanoAcao(planoId, motivo.trim()),
    onSuccess: (data) => {
      onSucesso(data);
      setMotivo('');
    },
    onError: (err) => setErro(mensagemErro(err, 'Não foi possível cancelar o plano.')),
  });

  return (
    <Dialog open={aberto} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cancelar plano de ação</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          O plano deixa de aceitar movimentação. Se o problema voltar a acontecer, abra um plano novo a partir do
          alerta.
        </DialogContentText>
        <TextField
          autoFocus
          fullWidth
          required
          multiline
          minRows={2}
          label="Motivo do cancelamento"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {erro && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {erro}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Voltar</Button>
        <Button
          variant="contained"
          color="error"
          disabled={motivo.trim() === '' || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Cancelar plano
        </Button>
      </DialogActions>
    </Dialog>
  );
}

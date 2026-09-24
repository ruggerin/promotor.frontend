import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Stack,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ComentariosRegistro } from '../../components/ComentariosRegistro';
import { apiClient } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  buscarVisita,
  cancelarVisita,
  corrigirHorariosVisita,
  forcarCheckoutVisita,
} from '../../lib/api/visitas';
import type { AcaoIntervencaoVisita, CampoRespondido, StatusVisita, VisitaRegistro } from '../../types/api';

const STATUS_COLORS: Record<StatusVisita, 'warning' | 'success' | 'default'> = {
  ABERTA: 'warning',
  FINALIZADA: 'success',
  CANCELADA: 'default',
};

const STATUS_LABELS: Record<StatusVisita, string> = {
  ABERTA: 'Aberta',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const ACAO_LABELS: Record<AcaoIntervencaoVisita, string> = {
  CANCELAMENTO: 'Cancelamento',
  CHECKOUT_FORCADO: 'Checkout forçado',
  CORRECAO_HORARIO: 'Correção de horário',
};

// <input type="datetime-local"> trabalha em horário local sem fuso; o backend guarda tudo em
// UTC. Converte nas duas pontas pra o gestor trabalhar no mesmo horário que vê no resto da tela.
function isoParaInputLocal(iso: string): string {
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function inputLocalParaIso(valor: string): string {
  return new Date(valor).toISOString();
}

function formatarHora(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function formatarDuracao(inicioIso: string, fimIso: string): string {
  const seg = Math.max(0, Math.floor((new Date(fimIso).getTime() - new Date(inicioIso).getTime()) / 1000));
  const h = Math.floor(seg / 3600);
  const min = Math.floor(seg / 60) % 60;
  return h > 0 ? `${h}h ${String(min).padStart(2, '0')}min` : `${min}min`;
}

function mensagemDeErro(err: unknown): string {
  if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response) {
    const errors = err.response.data.errors;
    if (errors) {
      return Object.values(errors)[0]?.[0] ?? 'Não foi possível concluir a ação.';
    }
    return err.response.data.message ?? 'Não foi possível concluir a ação.';
  }
  return 'Não foi possível conectar à API. Tente novamente.';
}

/**
 * A rota de imagem exige Authorization: Bearer — uma <img src> comum não manda esse header,
 * então baixamos via Axios (que já injeta o token pelo interceptor) e criamos uma blob URL.
 */
function ImagemBlob({ url, alt, tamanho = 160 }: { url: string; alt: string; tamanho?: number }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelado = false;

    apiClient
      .get<Blob>(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelado) {
          return;
        }
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {
        // Falha silenciosa — o card do registro segue mostrando os outros dados normalmente.
      });

    return () => {
      cancelado = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [url]);

  if (!blobUrl) {
    return <Skeleton variant="rectangular" width={tamanho} height={tamanho} sx={{ borderRadius: 1.5, flexShrink: 0 }} />;
  }

  return (
    <Box
      component="img"
      src={blobUrl}
      alt={alt}
      sx={{ width: tamanho, height: tamanho, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }}
    />
  );
}

// Rótulo → valor formatado, já resolvido pelo backend (App\Support\FormatadorValoresCampos) —
// SORTIMENTO vem à parte (presentes/ausentes com nome do produto, não uuid cru).
function CamposRespondidos({ campos }: { campos: CampoRespondido[] }) {
  if (campos.length === 0) return null;

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
      {campos.map((campo, i) => (
        <Box
          key={campo.chave}
          sx={{
            p: 1.25,
            borderTop: i > 0 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          {campo.tipo_campo === 'SORTIMENTO' ? (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {campo.rotulo}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {campo.sortimento?.presentes.map((p) => (
                  <Chip key={p.id} label={p.descricao} size="small" color="success" variant="outlined" />
                ))}
                {campo.sortimento?.ausentes.map((p) => (
                  <Chip key={p.id} label={p.descricao} size="small" color="error" variant="outlined" />
                ))}
                {(campo.sortimento?.presentes.length ?? 0) === 0 && (campo.sortimento?.ausentes.length ?? 0) === 0 && (
                  <Typography variant="body2" color="text.secondary">Nenhum produto respondido.</Typography>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">{campo.rotulo}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{campo.valor}</Typography>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

function tituloRegistro(registro: VisitaRegistro): string {
  const vinculo = registro.secao?.descricao ?? registro.departamento?.descricao ?? registro.marca?.descricao;
  return registro.produto_auditoria?.descricao ?? vinculo ?? registro.tipo_registro.descricao;
}

function RegistroCard({ registro, onAbrir }: { registro: VisitaRegistro; onAbrir: () => void }) {
  const vinculo = registro.secao?.descricao ?? registro.departamento?.descricao ?? registro.marca?.descricao;
  const previaValores = registro.campos_respondidos
    .filter((c) => c.tipo_campo !== 'SORTIMENTO')
    .map((c) => c.valor)
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');

  return (
    <Card variant="outlined">
      <CardActionArea onClick={onAbrir} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 1.5 }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1.5,
            bgcolor: 'action.hover',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {registro.imagens.length > 0 ? (
            <>
              <ImagemThumb url={registro.imagens[0].url} alt={tituloRegistro(registro)} />
              {registro.imagens.length > 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 2,
                    bottom: 2,
                    bgcolor: 'rgba(17,24,39,0.72)',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 700,
                    borderRadius: 0.75,
                    px: 0.5,
                  }}
                >
                  +{registro.imagens.length - 1}
                </Box>
              )}
            </>
          ) : (
            <ImageOutlinedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
            {tituloRegistro(registro)}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {registro.tipo_registro.descricao}
            {vinculo && vinculo !== tituloRegistro(registro) ? ` · ${vinculo}` : ''}
          </Typography>
          {previaValores && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {previaValores}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {registro.ruptura && <Chip label="Ruptura" color="error" size="small" />}
            {registro.pontuacao !== null && <Chip label={`${registro.pontuacao}% compliance`} color="warning" size="small" variant="outlined" />}
            {(registro.comentarios_count ?? 0) > 0 && (
              <Chip
                icon={<ChatBubbleOutlinedIcon sx={{ fontSize: 14 }} />}
                label={registro.comentarios_count}
                size="small"
                variant="outlined"
                color={(registro.comentarios_novos ?? 0) > 0 ? 'primary' : 'default'}
              />
            )}
          </Box>
        </Box>
      </CardActionArea>
    </Card>
  );
}

// Thumbnail pequena pro card da lista — mesma técnica de blob autenticado do ImagemBlob, só que
// preenchendo a caixa (sem placeholder de Skeleton do tamanho errado enquanto carrega).
function ImagemThumb({ url, alt }: { url: string; alt: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelado = false;
    apiClient
      .get<Blob>(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
      })
      .catch(() => {});
    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  if (!blobUrl) return null;
  return <Box component="img" src={blobUrl} alt={alt} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}

function RegistroDetalheDialog({
  registro,
  visitaUuid,
  onClose,
}: {
  registro: VisitaRegistro | null;
  visitaUuid: string;
  onClose: () => void;
}) {
  if (!registro) return null;
  const vinculo = registro.secao?.descricao ?? registro.departamento?.descricao ?? registro.marca?.descricao;

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{tituloRegistro(registro)}</Typography>
          <Typography variant="body2" color="text.secondary">{registro.tipo_registro.descricao}</Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {registro.imagens.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
              {registro.imagens.map((img) => (
                <ImagemBlob key={img.id} url={img.url} alt={tituloRegistro(registro)} tamanho={220} />
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                height: 140,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              <ImageOutlinedIcon sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">Sem foto</Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {registro.ruptura && <Chip label="Ruptura" color="error" size="small" />}
            {registro.pontuacao !== null && <Chip label={`${registro.pontuacao}% compliance`} color="warning" size="small" variant="outlined" />}
          </Box>

          {vinculo && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Vínculo</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{vinculo}</Typography>
            </Box>
          )}

          <CamposRespondidos campos={registro.campos_respondidos} />

          {registro.observacao && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>
                Observação
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{registro.observacao}</Typography>
            </Box>
          )}

          <ComentariosRegistro
            visitaUuid={visitaUuid}
            registroUuid={registro.id}
            totalInicial={registro.comentarios_count}
            novosIniciais={registro.comentarios_novos}
          />
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

type DialogAberto = 'cancelar' | 'forcar' | 'corrigir' | null;
type Filtro = 'todos' | 'ruptura' | 'comentarios';

export function VisitaDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario } = useAuth();

  const visitaQuery = useQuery({
    queryKey: ['visitas', publicId],
    queryFn: () => buscarVisita(publicId as string),
    enabled: Boolean(publicId),
  });

  const [dialog, setDialog] = useState<DialogAberto>(null);
  const [motivo, setMotivo] = useState('');
  const [inicioInput, setInicioInput] = useState('');
  const [fimInput, setFimInput] = useState('');
  const [erroDialog, setErroDialog] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [registroAberto, setRegistroAberto] = useState<VisitaRegistro | null>(null);

  const visita = visitaQuery.data?.visita;

  // Hook sempre chamado, mesmo antes de saber se a visita carregou — Rules of Hooks não
  // permite pular a chamada num render e chamar no outro.
  const cabecalho = usePageHeader(
    visita ? (
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        {visita.ponto_venda?.fantasia}
      </Typography>
    ) : null,
  );

  const registrosValidos = useMemo(() => (visita?.registros ?? []).filter((r) => !r.cancelado_em), [visita?.registros]);
  const nRupturas = useMemo(() => registrosValidos.filter((r) => r.ruptura).length, [registrosValidos]);
  const nComComentarios = useMemo(() => registrosValidos.filter((r) => (r.comentarios_count ?? 0) > 0).length, [registrosValidos]);
  const compliance = useMemo(() => {
    const pontuados = registrosValidos.filter((r) => r.pontuacao !== null);
    if (pontuados.length === 0) return null;
    return Math.round(pontuados.reduce((soma, r) => soma + (r.pontuacao ?? 0), 0) / pontuados.length);
  }, [registrosValidos]);

  const registrosFiltrados = useMemo(() => {
    if (filtro === 'ruptura') return registrosValidos.filter((r) => r.ruptura);
    if (filtro === 'comentarios') return registrosValidos.filter((r) => (r.comentarios_count ?? 0) > 0);
    return registrosValidos;
  }, [registrosValidos, filtro]);

  function abrirDialog(qual: Exclude<DialogAberto, null>) {
    setErroDialog(null);
    setMotivo('');
    setInicioInput(visita?.inicio_data ? isoParaInputLocal(visita.inicio_data) : '');
    setFimInput(visita?.fim_data ? isoParaInputLocal(visita.fim_data) : '');
    setDialog(qual);
  }

  function fecharDialog() {
    setDialog(null);
  }

  function aoConcluir() {
    void queryClient.invalidateQueries({ queryKey: ['visitas', publicId] });
    void queryClient.invalidateQueries({ queryKey: ['visitas'] });
    fecharDialog();
  }

  const cancelarMutation = useMutation({
    mutationFn: () => cancelarVisita(publicId as string, motivo),
    onSuccess: aoConcluir,
    onError: (err) => setErroDialog(mensagemDeErro(err)),
  });

  const forcarMutation = useMutation({
    mutationFn: () =>
      forcarCheckoutVisita(publicId as string, {
        motivo,
        fim_data: inputLocalParaIso(fimInput),
      }),
    onSuccess: aoConcluir,
    onError: (err) => setErroDialog(mensagemDeErro(err)),
  });

  const corrigirMutation = useMutation({
    mutationFn: () => {
      const payload: { motivo: string; inicio_data?: string; fim_data?: string } = { motivo };
      if (inicioInput && (!visita?.inicio_data || inicioInput !== isoParaInputLocal(visita.inicio_data))) {
        payload.inicio_data = inputLocalParaIso(inicioInput);
      }
      if (fimInput && (!visita?.fim_data || fimInput !== isoParaInputLocal(visita.fim_data))) {
        payload.fim_data = inputLocalParaIso(fimInput);
      }
      return corrigirHorariosVisita(publicId as string, payload);
    },
    onSuccess: aoConcluir,
    onError: (err) => setErroDialog(mensagemDeErro(err)),
  });

  const salvando = cancelarMutation.isPending || forcarMutation.isPending || corrigirMutation.isPending;
  const motivoValido = motivo.trim().length >= 5;

  if (visitaQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (visitaQuery.isError || !visita) {
    return <Typography color="error">Visita não encontrada.</Typography>;
  }

  // Gating só por user_type (mesmo padrão do AppLayout) — o backend é a trava real da permissão
  // visitas.intervir; um GESTOR sem ela no perfil vê os botões mas recebe 403 no diálogo.
  const podeIntervir = usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR';
  const intervencoes = visita.intervencoes ?? [];

  return (
    <Box>
      {cabecalho}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/visitas')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Chip label={STATUS_LABELS[visita.status]} color={STATUS_COLORS[visita.status]} />
        {visita.checkout_tipo === 'ADMIN' && (
          <Chip label="Checkout feito pelo admin" color="info" size="small" variant="outlined" />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {podeIntervir && visita.status === 'ABERTA' && (
          <>
            <Button variant="outlined" onClick={() => abrirDialog('forcar')}>
              Forçar checkout
            </Button>
            <Button variant="outlined" color="error" onClick={() => abrirDialog('cancelar')}>
              Cancelar visita
            </Button>
          </>
        )}
        {podeIntervir && visita.status === 'FINALIZADA' && (
          <>
            <Button variant="outlined" onClick={() => abrirDialog('corrigir')}>
              Corrigir horários
            </Button>
            <Button variant="outlined" color="error" onClick={() => abrirDialog('cancelar')}>
              Cancelar visita
            </Button>
          </>
        )}
      </Box>

      {/* Timeline check-in/checkout, estilo do app mobile — ver mobile/src/screens/VisitaDetalheScreen.tsx */}
      <Paper sx={{ p: 2.5, mb: 2, display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Check-in</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>{formatarHora(visita.inicio_data)}</Typography>
          <Typography variant="caption" color="text.secondary">
            {formatarData(visita.inicio_data)} · {Math.round(visita.inicio_distancia_metros)}m do PDV
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, px: 2 }}>
          {visita.fim_data && (
            <Chip label={formatarDuracao(visita.inicio_data, visita.fim_data)} size="small" color="primary" sx={{ fontWeight: 700 }} />
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main' }} />
            <Box sx={{ width: 32, height: 2, bgcolor: 'primary.light' }} />
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: visita.fim_data ? 'primary.main' : 'divider' }} />
          </Box>
        </Box>
        <Box sx={{ flex: 1, textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Check-out</Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {visita.fim_data ? formatarHora(visita.fim_data) : '—'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {visita.fim_data
              ? visita.checkout_tipo === 'ADMIN'
                ? 'forçado pelo admin (sem GPS)'
                : `${formatarData(visita.fim_data)} · ${Math.round(visita.fim_distancia_metros ?? 0)}m do PDV`
              : 'Ainda não finalizada'}
          </Typography>
        </Box>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.5, mb: 2 }}>
        <Paper sx={{ p: 1.5 }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{registrosValidos.length}</Typography>
          <Typography variant="caption" color="text.secondary">Registros</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, bgcolor: compliance !== null ? '#fffbeb' : undefined }}>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>{compliance !== null ? `${compliance}%` : '—'}</Typography>
          <Typography variant="caption" color="text.secondary">Compliance</Typography>
        </Paper>
        <Paper sx={{ p: 1.5, bgcolor: nRupturas > 0 ? '#fef2f2' : undefined }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: nRupturas > 0 ? 'error.main' : undefined }}>{nRupturas}</Typography>
          <Typography variant="caption" color="text.secondary">Rupturas</Typography>
        </Paper>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Registros
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filtro}
          onChange={(_, valor) => valor && setFiltro(valor)}
        >
          <ToggleButton value="todos">Todos ({registrosValidos.length})</ToggleButton>
          <ToggleButton value="ruptura">Rupturas ({nRupturas})</ToggleButton>
          <ToggleButton value="comentarios">Com comentários ({nComComentarios})</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {registrosFiltrados.length === 0 && (
        <Typography color="text.secondary" sx={{ mb: 2 }}>Nenhum registro nesse filtro.</Typography>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5, mb: 3 }}>
        {registrosFiltrados.map((registro) => (
          <RegistroCard key={registro.id} registro={registro} onAbrir={() => setRegistroAberto(registro)} />
        ))}
      </Box>

      {intervencoes.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Intervenções administrativas
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Quando</TableCell>
                  <TableCell>Ação</TableCell>
                  <TableCell>Por</TableCell>
                  <TableCell>O que mudou</TableCell>
                  <TableCell>Motivo</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {intervencoes.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell>{new Date(i.created_at).toLocaleString('pt-BR')}</TableCell>
                    <TableCell>{ACAO_LABELS[i.acao]}</TableCell>
                    <TableCell>{i.usuario?.nome ?? '—'}</TableCell>
                    <TableCell>{i.descricao}</TableCell>
                    <TableCell>{i.motivo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <RegistroDetalheDialog registro={registroAberto} visitaUuid={visita.id} onClose={() => setRegistroAberto(null)} />

      <Dialog open={dialog !== null} onClose={salvando ? undefined : fecharDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialog === 'cancelar' && 'Cancelar visita'}
          {dialog === 'forcar' && 'Forçar checkout'}
          {dialog === 'corrigir' && 'Corrigir horários'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {erroDialog && <Alert severity="error">{erroDialog}</Alert>}

            {dialog === 'cancelar' && (
              <Alert severity="warning">
                A visita fica marcada como cancelada e deixa de contar em relatórios. Os registros
                não são apagados. Se houver ordem de serviço vinculada, ela volta a ficar pendente.
              </Alert>
            )}

            {dialog === 'forcar' && (
              <TextField
                label="Horário real da saída"
                type="datetime-local"
                value={fimInput}
                onChange={(e) => setFimInput(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
                fullWidth
              />
            )}

            {dialog === 'corrigir' && (
              <>
                <TextField
                  label="Horário de entrada"
                  type="datetime-local"
                  value={inicioInput}
                  onChange={(e) => setInicioInput(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
                <TextField
                  label="Horário de saída"
                  type="datetime-local"
                  value={fimInput}
                  onChange={(e) => setFimInput(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </>
            )}

            <TextField
              label="Motivo da intervenção"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              multiline
              minRows={2}
              required
              fullWidth
              helperText="Fica registrado no log de auditoria (mínimo 5 caracteres)."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={fecharDialog} disabled={salvando}>
            Voltar
          </Button>
          <Button
            variant="contained"
            color={dialog === 'cancelar' ? 'error' : 'primary'}
            disabled={
              salvando ||
              !motivoValido ||
              (dialog === 'forcar' && !fimInput) ||
              (dialog === 'corrigir' && !inicioInput && !fimInput)
            }
            onClick={() => {
              if (dialog === 'cancelar') cancelarMutation.mutate();
              if (dialog === 'forcar') forcarMutation.mutate();
              if (dialog === 'corrigir') corrigirMutation.mutate();
            }}
          >
            {salvando ? 'Salvando...' : 'Confirmar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

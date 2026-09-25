import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import CloseIcon from '@mui/icons-material/Close';
import EventNoteOutlinedIcon from '@mui/icons-material/EventNoteOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import RemoveShoppingCartOutlinedIcon from '@mui/icons-material/RemoveShoppingCartOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Link as MuiLink,
  Paper,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ComentariosRegistro } from '../../components/ComentariosRegistro';
import { AutenticatedImage } from '../../components/fotos/AutenticatedImage';
import { CORES_MAPA_VISITA } from '../../components/mapa/coresMapaVisita';
import { MapaVisita } from '../../components/mapa/MapaVisita';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { apiClient } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  buscarVisita,
  cancelarVisita,
  corrigirHorariosVisita,
  forcarCheckoutVisita,
} from '../../lib/api/visitas';
import type { AcaoIntervencaoVisita, CampoRespondido, StatusVisita, Visita, VisitaRegistro } from '../../types/api';

const STATUS_COLORS: Record<StatusVisita, 'warning' | 'success' | 'default'> = {
  ABERTA: 'warning',
  FINALIZADA: 'success',
  CANCELADA: 'default',
};

const STATUS_LABELS: Record<StatusVisita, string> = {
  ABERTA: 'Em andamento',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const ACAO_LABELS: Record<AcaoIntervencaoVisita, string> = {
  CANCELAMENTO: 'Cancelamento',
  CHECKOUT_FORCADO: 'Checkout forçado',
  CORRECAO_HORARIO: 'Correção de horário',
};

// Card "chapado" (sem sombra, só borda) — padrão visual desta tela.
const CARD_SX = { borderRadius: 1.25, boxShadow: 'none' } as const;

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

function formatarDataLonga(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function formatarDuracao(inicioIso: string, fimIso: string | null): string {
  const fim = fimIso ? new Date(fimIso).getTime() : Date.now();
  const seg = Math.max(0, Math.floor((fim - new Date(inicioIso).getTime()) / 1000));
  const h = Math.floor(seg / 3600);
  const min = Math.floor(seg / 60) % 60;
  return h > 0 ? `${h}h ${String(min).padStart(2, '0')}min` : `${min}min`;
}

function formatarDistancia(metros: number): string {
  return metros >= 1000 ? `${(metros / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(metros)} m`;
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
    <Paper
      variant="outlined"
      onClick={onAbrir}
      sx={{
        ...CARD_SX,
        p: 1.5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 1.5,
        cursor: 'pointer',
        transition: 'border-color .15s, background-color .15s',
        borderColor: registro.ruptura ? (t) => alpha(t.palette.error.main, 0.35) : undefined,
        '&:hover': { borderColor: 'primary.light', bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 1,
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
                  right: 3,
                  bottom: 3,
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
        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap title={tituloRegistro(registro)}>
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
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.75 }}>
          {registro.ruptura && <Chip label="Ruptura" color="error" size="small" sx={{ height: 22 }} />}
          {registro.pontuacao !== null && (
            <Chip label={`${registro.pontuacao}% compliance`} color="warning" size="small" variant="outlined" sx={{ height: 22 }} />
          )}
          {(registro.comentarios_count ?? 0) > 0 && (
            <Chip
              icon={<ChatBubbleOutlinedIcon sx={{ fontSize: 14 }} />}
              label={registro.comentarios_count}
              size="small"
              variant="outlined"
              sx={{ height: 22 }}
              color={(registro.comentarios_novos ?? 0) > 0 ? 'primary' : 'default'}
            />
          )}
        </Box>
      </Box>
    </Paper>
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

// Título de seção dentro de um card — ícone + rótulo, mesmo peso visual em todos os blocos.
function TituloCard({ icone, titulo, acao }: { icone: ReactNode; titulo: string; acao?: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
      <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icone}</Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
        {titulo}
      </Typography>
      {acao}
    </Box>
  );
}

function Legenda({ cor, rotulo }: { cor: string; rotulo: string }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: cor }} />
      <Typography variant="caption" color="text.secondary">
        {rotulo}
      </Typography>
    </Box>
  );
}

// Selo de distância até a loja — verde dentro do raio de check-in, âmbar fora. Sem raio (empresa
// desativou o limite), só mostra a distância.
function SeloDistancia({ metros, raio }: { metros: number; raio: number | null | undefined }) {
  if (raio == null) {
    return <Chip size="small" variant="outlined" label={`${formatarDistancia(metros)} da loja`} sx={{ height: 22 }} />;
  }
  const dentro = metros <= raio;
  return (
    <Chip
      size="small"
      color={dentro ? 'success' : 'warning'}
      variant="outlined"
      label={`${formatarDistancia(metros)} · ${dentro ? 'dentro do raio' : 'fora do raio'}`}
      title={`Raio de check-in atual da empresa: ${Math.round(raio)} m`}
      sx={{ height: 22 }}
    />
  );
}

// Jornada — linha do tempo vertical check-in → permanência → checkout.
function Jornada({ visita, raio }: { visita: Visita; raio: number | null | undefined }) {
  const finalizada = !!visita.fim_data;
  const cancelada = visita.status === 'CANCELADA';

  const etapa = (cor: string, ativo: boolean, conteudo: ReactNode, ultimo = false) => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '20px 1fr', columnGap: 1.5 }}>
      <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!ultimo && <Box sx={{ position: 'absolute', top: 18, bottom: -6, width: '2px', bgcolor: 'divider' }} />}
        <Box
          sx={{
            mt: 0.5,
            width: 14,
            height: 14,
            borderRadius: '50%',
            bgcolor: ativo ? cor : 'background.paper',
            border: '3px solid',
            borderColor: ativo ? alpha(cor, 0.3) : 'divider',
            boxSizing: 'content-box',
            zIndex: 1,
          }}
        />
      </Box>
      <Box sx={{ pb: ultimo ? 0 : 2 }}>{conteudo}</Box>
    </Box>
  );

  return (
    <Box sx={{ px: 2, pb: 2 }}>
      {etapa(
        CORES_MAPA_VISITA.checkin,
        true,
        <>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Check-in
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
            <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {formatarHora(visita.inicio_data)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatarDataLonga(visita.inicio_data)}
            </Typography>
          </Box>
          <Box sx={{ mt: 0.5 }}>
            <SeloDistancia metros={visita.inicio_distancia_metros} raio={raio} />
          </Box>
        </>,
      )}
      {etapa(
        '#94a3b8',
        false,
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            px: 1.25,
            py: 0.5,
            borderRadius: 5,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
            color: 'primary.dark',
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {cancelada && !finalizada ? '—' : formatarDuracao(visita.inicio_data, visita.fim_data)}
          </Typography>
          <Typography variant="caption">
            {finalizada ? 'de permanência' : cancelada ? 'visita cancelada' : 'em andamento'}
          </Typography>
        </Box>,
      )}
      {etapa(
        CORES_MAPA_VISITA.checkout,
        finalizada,
        <>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>
            Check-out
          </Typography>
          {visita.fim_data ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                  {formatarHora(visita.fim_data)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatarDataLonga(visita.fim_data)}
                </Typography>
              </Box>
              <Box sx={{ mt: 0.5 }}>
                {visita.checkout_tipo === 'ADMIN' ? (
                  <Chip size="small" color="info" variant="outlined" label="Forçado pelo admin (sem GPS)" sx={{ height: 22 }} />
                ) : visita.fim_distancia_metros != null ? (
                  <SeloDistancia metros={visita.fim_distancia_metros} raio={raio} />
                ) : null}
              </Box>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {cancelada ? 'Sem checkout' : 'Ainda não finalizada'}
            </Typography>
          )}
        </>,
        true,
      )}
    </Box>
  );
}

function Indicador({
  icone,
  valor,
  rotulo,
  cor,
}: {
  icone: ReactNode;
  valor: string | number;
  rotulo: string;
  cor?: 'error' | 'warning' | 'primary';
}) {
  return (
    <Paper variant="outlined" sx={{ ...CARD_SX, p: 1.5, display: 'flex', alignItems: 'center', gap: 1.25 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: cor ? `${cor}.main` : 'text.secondary',
          bgcolor: (t) => (cor ? alpha(t.palette[cor].main, 0.1) : t.palette.action.hover),
        }}
      >
        {icone}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1, color: cor ? `${cor}.main` : undefined }}>
          {valor}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {rotulo}
        </Typography>
      </Box>
    </Paper>
  );
}

// Respostas dos formulários direto na página (sem abrir registro por registro) — agrupadas por
// formulário (TipoRegistro); um formulário respondido pra vários produtos vira um bloco por
// produto dentro do mesmo card. Só entram registros com ao menos uma pergunta respondida.
function FormulariosRespondidos({
  registros,
  onAbrir,
}: {
  registros: VisitaRegistro[];
  onAbrir: (registro: VisitaRegistro) => void;
}) {
  const grupos = useMemo(() => {
    const porFormulario = new Map<string, { nome: string; registros: VisitaRegistro[] }>();
    for (const r of registros) {
      if (r.campos_respondidos.length === 0) continue;
      const grupo = porFormulario.get(r.tipo_registro.id) ?? { nome: r.tipo_registro.descricao, registros: [] };
      grupo.registros.push(r);
      porFormulario.set(r.tipo_registro.id, grupo);
    }
    return [...porFormulario.entries()];
  }, [registros]);

  if (grupos.length === 0) return null;

  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
        Respostas dos formulários
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2, alignItems: 'start' }}>
        {grupos.map(([id, grupo]) => {
          const pontuados = grupo.registros.filter((r) => r.pontuacao !== null);
          const media = pontuados.length
            ? Math.round(pontuados.reduce((s, r) => s + (r.pontuacao ?? 0), 0) / pontuados.length)
            : null;

          return (
            <Paper key={id} variant="outlined" sx={CARD_SX}>
              <TituloCard
                icone={<FactCheckOutlinedIcon fontSize="small" />}
                titulo={grupo.nome}
                acao={
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {grupo.registros.length > 1 && (
                      <Chip size="small" variant="outlined" label={`${grupo.registros.length} respostas`} sx={{ height: 22 }} />
                    )}
                    {media !== null && (
                      <Chip size="small" color="warning" variant="outlined" label={`${media}% compliance`} sx={{ height: 22 }} />
                    )}
                  </Box>
                }
              />
              <Divider />
              <Stack spacing={2} sx={{ p: 2 }}>
                {grupo.registros.map((r) => {
                  const titulo = tituloRegistro(r);
                  return (
                    <Box key={r.id}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        {titulo !== grupo.nome && (
                          <Typography variant="body2" sx={{ fontWeight: 700, flexGrow: 1 }}>
                            {titulo}
                          </Typography>
                        )}
                        {r.ruptura && <Chip label="Ruptura" color="error" size="small" sx={{ height: 22 }} />}
                        {grupo.registros.length > 1 && r.pontuacao !== null && (
                          <Chip label={`${r.pontuacao}%`} color="warning" size="small" variant="outlined" sx={{ height: 22 }} />
                        )}
                        <Box sx={{ flexGrow: titulo !== grupo.nome ? 0 : 1 }} />
                        <Button
                          size="small"
                          sx={{ textTransform: 'none' }}
                          startIcon={(r.comentarios_count ?? 0) > 0 ? <ChatBubbleOutlinedIcon fontSize="small" /> : <ImageOutlinedIcon fontSize="small" />}
                          onClick={() => onAbrir(r)}
                        >
                          {r.imagens.length > 0 ? `${r.imagens.length} foto(s)` : 'Detalhes'}
                          {(r.comentarios_count ?? 0) > 0 ? ` · ${r.comentarios_count} coment.` : ''}
                        </Button>
                      </Box>
                      <CamposRespondidos campos={r.campos_respondidos} />
                      {r.observacao && (
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          <strong>Obs.:</strong> {r.observacao}
                        </Typography>
                      )}
                    </Box>
                  );
                })}
              </Stack>
            </Paper>
          );
        })}
      </Box>
    </Box>
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
  const raio = visitaQuery.data?.raio_checkin_metros;

  // Hook sempre chamado, mesmo antes de saber se a visita carregou — Rules of Hooks não
  // permite pular a chamada num render e chamar no outro.
  const cabecalho = usePageHeader(
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
      <IconButton size="small" onClick={() => navigate('/visitas')} title="Voltar para Visitas">
        <ArrowBackIcon fontSize="small" />
      </IconButton>
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        Detalhe da visita
      </Typography>
    </Box>,
  );

  const registrosValidos = useMemo(() => (visita?.registros ?? []).filter((r) => !r.cancelado_em), [visita?.registros]);
  const nRupturas = useMemo(() => registrosValidos.filter((r) => r.ruptura).length, [registrosValidos]);
  const nComComentarios = useMemo(() => registrosValidos.filter((r) => (r.comentarios_count ?? 0) > 0).length, [registrosValidos]);
  const nFotos = useMemo(() => registrosValidos.reduce((soma, r) => soma + r.imagens.length, 0), [registrosValidos]);
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
        {cabecalho}
        <CircularProgress />
      </Box>
    );
  }

  if (visitaQuery.isError || !visita) {
    return (
      <Box>
        {cabecalho}
        <Typography color="error">Visita não encontrada.</Typography>
      </Box>
    );
  }

  // Gating só por user_type (mesmo padrão do AppLayout) — o backend é a trava real da permissão
  // visitas.intervir; um GESTOR sem ela no perfil vê os botões mas recebe 403 no diálogo.
  const podeIntervir = usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR';
  const intervencoes = visita.intervencoes ?? [];
  const pdv = visita.ponto_venda;

  const pontoLoja =
    pdv?.latitude != null && pdv.longitude != null
      ? { latitude: pdv.latitude, longitude: pdv.longitude, rotulo: pdv.fantasia, detalhe: pdv.endereco ?? undefined }
      : null;
  const pontoCheckin = {
    latitude: visita.inicio_latitude,
    longitude: visita.inicio_longitude,
    rotulo: `Check-in · ${formatarHora(visita.inicio_data)}`,
    detalhe: `${formatarDistancia(visita.inicio_distancia_metros)} da loja`,
  };
  // Checkout forçado pelo admin não tem GPS — sem pino.
  const pontoCheckout =
    visita.fim_data && visita.fim_latitude != null && visita.fim_longitude != null
      ? {
          latitude: visita.fim_latitude,
          longitude: visita.fim_longitude,
          rotulo: `Check-out · ${formatarHora(visita.fim_data)}`,
          detalhe: visita.fim_distancia_metros != null ? `${formatarDistancia(visita.fim_distancia_metros)} da loja` : undefined,
        }
      : null;

  return (
    <Box sx={{ maxWidth: 1400, mx: 'auto' }}>
      {cabecalho}

      {/* Cabeçalho da visita — loja, promotor, status e ações. */}
      <Paper variant="outlined" sx={{ ...CARD_SX, p: 2.5, mb: 2, display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            borderRadius: 1.25,
            overflow: 'hidden',
            flexShrink: 0,
            bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {pdv?.fachada_url ? (
            <AutenticatedImage url={pdv.fachada_url} alt={pdv.fantasia} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <StorefrontOutlinedIcon sx={{ fontSize: 34 }} />
          )}
        </Box>

        <Box sx={{ flex: '1 1 320px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            {pdv ? (
              <MuiLink
                component={RouterLink}
                to={`/pontos-venda/${pdv.id}`}
                underline="hover"
                color="inherit"
                variant="h5"
                sx={{ fontWeight: 800, lineHeight: 1.2 }}
              >
                {pdv.fantasia}
              </MuiLink>
            ) : (
              <Typography variant="h5" sx={{ fontWeight: 800 }}>—</Typography>
            )}
            <Chip label={STATUS_LABELS[visita.status]} color={STATUS_COLORS[visita.status]} size="small" />
          </Box>
          {pdv?.razao_social && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {pdv.razao_social}
            </Typography>
          )}
          {/* Endereço inteiro, quebrando linha se precisar — nunca cortado com reticências. */}
          {pdv?.endereco && (
            <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
              <PlaceOutlinedIcon sx={{ fontSize: 16, mt: '2px', flexShrink: 0 }} />
              {pdv.endereco}
            </Typography>
          )}
          {(visita.ordem_servico || visita.campanha || visita.checkout_tipo === 'ADMIN') && (
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1 }}>
              {visita.ordem_servico && (
                <Chip size="small" variant="outlined" icon={<EventNoteOutlinedIcon />} label="Veio de uma Ordem de Serviço" />
              )}
              {visita.campanha && (
                <Chip size="small" variant="outlined" icon={<CampaignOutlinedIcon />} label={visita.campanha.descricao} />
              )}
              {visita.checkout_tipo === 'ADMIN' && (
                <Chip size="small" variant="outlined" color="info" label="Checkout feito pelo admin" />
              )}
            </Box>
          )}
        </Box>

        {visita.usuario && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, pr: 1 }}>
            <UsuarioAvatar nome={visita.usuario.nome} fotoUrl={visita.usuario.foto_url} size={40} />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                Promotor
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {visita.usuario.nome}
              </Typography>
            </Box>
          </Box>
        )}

        {podeIntervir && visita.status !== 'CANCELADA' && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {visita.status === 'ABERTA' && (
              <Button variant="outlined" onClick={() => abrirDialog('forcar')}>
                Forçar checkout
              </Button>
            )}
            {visita.status === 'FINALIZADA' && (
              <Button variant="outlined" onClick={() => abrirDialog('corrigir')}>
                Corrigir horários
              </Button>
            )}
            <Button variant="text" color="error" onClick={() => abrirDialog('cancelar')}>
              Cancelar visita
            </Button>
          </Box>
        )}
      </Paper>

      {/* Mapa (esquerda) + jornada e indicadores (direita). */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(320px, 1fr)' },
          gap: 2,
          mb: 3,
        }}
      >
        <Paper variant="outlined" sx={{ ...CARD_SX, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TituloCard
            icone={<MapOutlinedIcon fontSize="small" />}
            titulo="Localização"
            acao={
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {pontoLoja && <Legenda cor={CORES_MAPA_VISITA.loja} rotulo="Loja" />}
                <Legenda cor={CORES_MAPA_VISITA.checkin} rotulo="Check-in" />
                {pontoCheckout && <Legenda cor={CORES_MAPA_VISITA.checkout} rotulo="Check-out" />}
              </Box>
            }
          />
          <Divider />
          <Box sx={{ flexGrow: 1 }}>
            <MapaVisita loja={pontoLoja} checkin={pontoCheckin} checkout={pontoCheckout} raioMetros={raio} altura={400} />
          </Box>
          {(raio != null || !pontoLoja) && (
            <>
              <Divider />
              <Typography variant="caption" color="text.secondary" sx={{ px: 2, py: 1 }}>
                {!pontoLoja
                  ? 'A loja não tem localização cadastrada — só os pontos de check-in/checkout aparecem no mapa.'
                  : `Círculo tracejado = raio de check-in atual da empresa (${Math.round(raio!)} m). Role com Ctrl para dar zoom.`}
              </Typography>
            </>
          )}
        </Paper>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Paper variant="outlined" sx={CARD_SX}>
            <TituloCard icone={<InsightsOutlinedIcon fontSize="small" />} titulo="Jornada" />
            <Jornada visita={visita} raio={raio} />
          </Paper>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
            <Indicador icone={<AssignmentTurnedInOutlinedIcon fontSize="small" />} valor={registrosValidos.length} rotulo="Registros" cor="primary" />
            <Indicador icone={<ImageOutlinedIcon fontSize="small" />} valor={nFotos} rotulo="Fotos" />
            <Indicador
              icone={<InsightsOutlinedIcon fontSize="small" />}
              valor={compliance !== null ? `${compliance}%` : '—'}
              rotulo="Compliance"
              cor={compliance !== null ? 'warning' : undefined}
            />
            <Indicador
              icone={<RemoveShoppingCartOutlinedIcon fontSize="small" />}
              valor={nRupturas}
              rotulo="Rupturas"
              cor={nRupturas > 0 ? 'error' : undefined}
            />
          </Box>
        </Box>
      </Box>

      <FormulariosRespondidos registros={registrosValidos} onAbrir={setRegistroAberto} />

      {/* Registros */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Registros
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={filtro}
          onChange={(_, valor) => valor && setFiltro(valor)}
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5 } }}
        >
          <ToggleButton value="todos">Todos ({registrosValidos.length})</ToggleButton>
          <ToggleButton value="ruptura">Rupturas ({nRupturas})</ToggleButton>
          <ToggleButton value="comentarios">Com comentários ({nComComentarios})</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {registrosFiltrados.length === 0 ? (
        <Paper variant="outlined" sx={{ ...CARD_SX, p: 4, mb: 3, textAlign: 'center', borderStyle: 'dashed' }}>
          <Typography color="text.secondary">Nenhum registro nesse filtro.</Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 1.5, mb: 3 }}>
          {registrosFiltrados.map((registro) => (
            <RegistroCard key={registro.id} registro={registro} onAbrir={() => setRegistroAberto(registro)} />
          ))}
        </Box>
      )}

      {/* Intervenções administrativas — log de auditoria (docs/15). */}
      {intervencoes.length > 0 && (
        <Paper variant="outlined" sx={{ ...CARD_SX, mb: 3 }}>
          <TituloCard
            icone={<EventNoteOutlinedIcon fontSize="small" />}
            titulo="Intervenções administrativas"
            acao={<Chip size="small" label={intervencoes.length} sx={{ height: 20 }} />}
          />
          <Divider />
          {intervencoes.map((i, idx) => (
            <Box key={i.id}>
              {idx > 0 && <Divider />}
              <Box sx={{ px: 2, py: 1.5, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '180px 1fr' }, gap: 1 }}>
                <Box>
                  <Chip size="small" label={ACAO_LABELS[i.acao]} variant="outlined" sx={{ height: 22, mb: 0.5 }} />
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {new Date(i.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                    {' · '}
                    {i.usuario?.nome ?? '—'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2">{i.descricao}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Motivo: {i.motivo}
                  </Typography>
                </Box>
              </Box>
            </Box>
          ))}
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

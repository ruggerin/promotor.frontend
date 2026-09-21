import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
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
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
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
import type { AcaoIntervencaoVisita, StatusVisita, VisitaRegistro } from '../../types/api';

const STATUS_COLORS: Record<StatusVisita, 'warning' | 'success' | 'default'> = {
  ABERTA: 'warning',
  FINALIZADA: 'success',
  CANCELADA: 'default',
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
function ImagemBlob({ url, alt }: { url: string; alt: string }) {
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
    return <Skeleton variant="rectangular" width={160} height={160} sx={{ borderRadius: 1 }} />;
  }

  return <Box component="img" src={blobUrl} alt={alt} sx={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 1 }} />;
}

// Um registro pode ter várias fotos agora — ver docs/21-EVIDENCIA-EM-FOTOS.md. Mostra todas numa
// fileira que quebra linha (flex-wrap) em vez de assumir só 1 imagem por registro.
function RegistroImagens({ registro }: { registro: VisitaRegistro }) {
  if (registro.imagens.length === 0) {
    return null;
  }

  return (
    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', p: 1 }}>
      {registro.imagens.map((imagem) => (
        <ImagemBlob key={imagem.id} url={imagem.url} alt={registro.produto_auditoria?.descricao ?? 'Registro de visita'} />
      ))}
    </Box>
  );
}

type DialogAberto = 'cancelar' | 'forcar' | 'corrigir' | null;

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

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Chip label={visita.status} color={STATUS_COLORS[visita.status]} size="small" />
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

      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Promotor
            </Typography>
            <Typography>{visita.usuario?.nome}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Status
            </Typography>
            <Box>
              <Chip label={visita.status} color={STATUS_COLORS[visita.status]} size="small" />
            </Box>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Typography variant="caption" color="text.secondary">
              Origem
            </Typography>
            <Typography>{visita.ordem_servico ? 'Ordem de serviço' : 'Espontânea'}</Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Check-in
            </Typography>
            <Typography>
              {new Date(visita.inicio_data).toLocaleString('pt-BR')} —{' '}
              {Math.round(visita.inicio_distancia_metros)}m do PDV
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="caption" color="text.secondary">
              Checkout
            </Typography>
            <Typography>
              {visita.fim_data
                ? `${new Date(visita.fim_data).toLocaleString('pt-BR')}${
                    visita.checkout_tipo === 'ADMIN'
                      ? ' — forçado pelo admin (sem GPS)'
                      : ` — ${Math.round(visita.fim_distancia_metros ?? 0)}m do PDV`
                  }`
                : 'Ainda não finalizada'}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

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

      <Typography variant="h6" gutterBottom>
        Registros ({visita.registros?.length ?? 0})
      </Typography>

      {(!visita.registros || visita.registros.length === 0) && (
        <Typography color="text.secondary">Nenhum registro nesta visita.</Typography>
      )}

      <Grid container spacing={2}>
        {visita.registros?.map((registro) => (
          <Grid key={registro.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined">
              <RegistroImagens registro={registro} />
              <CardContent>
                <Chip label={registro.tipo_registro.descricao} size="small" sx={{ mb: 1 }} />
                {registro.ruptura && (
                  <Chip label="Ruptura" color="error" size="small" sx={{ mb: 1, ml: 1 }} />
                )}
                {registro.produto_auditoria && (
                  <Typography variant="body2">{registro.produto_auditoria.descricao}</Typography>
                )}
                {(registro.secao || registro.departamento || registro.marca) && (
                  <Typography variant="body2">
                    {registro.secao?.descricao ?? registro.departamento?.descricao ?? registro.marca?.descricao}
                  </Typography>
                )}
                {registro.observacao && (
                  <Typography variant="body2" color="text.secondary">
                    {registro.observacao}
                  </Typography>
                )}
                {registro.valores_campos && Object.keys(registro.valores_campos).length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {Object.entries(registro.valores_campos).map(([chave, valor]) => (
                      <Typography key={chave} variant="caption" color="text.secondary" component="div">
                        {chave}: {String(valor)}
                      </Typography>
                    ))}
                  </Box>
                )}
                <ComentariosRegistro
                  visitaUuid={visita.id}
                  registroUuid={registro.id}
                  totalInicial={registro.comentarios_count}
                  novosIniciais={registro.comentarios_novos}
                />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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

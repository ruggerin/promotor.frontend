import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import DeleteIcon from '@mui/icons-material/Delete';
import DescriptionIcon from '@mui/icons-material/Description';
import PaidIcon from '@mui/icons-material/Paid';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
  Paper,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { removerContratoMeta } from '../../lib/api/contratoMetas';
import {
  atualizarContrato,
  buscarContrato,
  buscarHistoricoContrato,
  criarContrato,
  desativarContrato,
  uploadArquivoContrato,
} from '../../lib/api/contratos';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarVisitas } from '../../lib/api/visitas';
import { formatarDataSemFuso } from '../../lib/formatarData';
import { useAuth } from '../../lib/auth/AuthContext';
import type { ContratoMeta, StatusApuracaoMeta, StatusVisita, TipoContrato } from '../../types/api';
import { ContratoMetaFormDialog } from './ContratoMetaFormDialog';
import { LancarResultadoDialog } from './LancarResultadoDialog';

const TIPOS: { value: TipoContrato; label: string }[] = [
  { value: 'COMODATO', label: 'Comodato (expositor)' },
  { value: 'PONTO_EXTRA', label: 'Ponto extra' },
];

const STATUS_META_LABELS: Record<StatusApuracaoMeta, string> = {
  AGUARDANDO: 'Aguardando',
  ATINGIDA: 'Atingida',
  NAO_ATINGIDA: 'Não atingida',
};

const STATUS_META_COLORS: Record<StatusApuracaoMeta, 'default' | 'success' | 'error'> = {
  AGUARDANDO: 'default',
  ATINGIDA: 'success',
  NAO_ATINGIDA: 'error',
};

const STATUS_VISITA_LABELS: Record<StatusVisita, string> = {
  ABERTA: 'Aberta',
  FINALIZADA: 'Finalizada',
  CANCELADA: 'Cancelada',
};

const STATUS_VISITA_COLORS: Record<StatusVisita, 'warning' | 'success' | 'default'> = {
  ABERTA: 'warning',
  FINALIZADA: 'success',
  CANCELADA: 'default',
};

function formatarMoeda(valor: number): string {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function paraInputDate(isoDate: string): string {
  return isoDate.slice(0, 10);
}

// empresa_uuid só faz sentido na criação por SUPERADMIN — mantido no schema sempre pra o tipo
// do form não mudar de formato entre os casos, mesmo padrão que já existia no antigo
// ContratoFormDialog.
function buildSchema(modoCriacao: boolean, isSuperadmin: boolean) {
  return z
    .object({
      empresa_uuid: z.string().nullable(),
      ponto_venda_uuid: z.string().min(1, 'Obrigatório'),
      tipo: z.enum(['COMODATO', 'PONTO_EXTRA']),
      descricao: z.string(),
      vigencia_inicio: z.string().min(1, 'Obrigatório'),
      vigencia_fim: z.string().min(1, 'Obrigatório'),
    })
    .refine((data) => data.vigencia_fim >= data.vigencia_inicio, {
      message: 'Deve ser depois do início',
      path: ['vigencia_fim'],
    })
    .refine((data) => !modoCriacao || !isSuperadmin || !!data.empresa_uuid, {
      message: 'Obrigatório escolher a empresa.',
      path: ['empresa_uuid'],
    });
}

type FormData = z.infer<ReturnType<typeof buildSchema>>;

const DEFAULT_VALUES: FormData = {
  empresa_uuid: null,
  ponto_venda_uuid: '',
  tipo: 'COMODATO',
  descricao: '',
  vigencia_inicio: '',
  vigencia_fim: '',
};

/**
 * Página única de cadastro + gestão do contrato — substitui o antigo modal "Novo/Editar
 * contrato" (dados básicos), que ficava pequeno demais uma vez que o contrato passou a reunir
 * também metas, anexo e histórico. Diferente do padrão adotado em PontoVenda/Empresa (onde só a
 * edição virou página, criação continua em modal), aqui a criação também é nesta mesma página —
 * pedido explícito, ver docs/03-ADMIN-WEB.md#6-contratos.
 */
export function ContratoDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { usuario: usuarioLogado } = useAuth();
  const isSuperadmin = usuarioLogado?.user_type === 'SUPERADMIN';
  // Rota /contratos/novo não declara :publicId — é assim que a página sabe que tá criando.
  const modoCriacao = publicId === undefined;

  const [erro, setErro] = useState<string | null>(null);
  const [dialogNovaMetaAberto, setDialogNovaMetaAberto] = useState(false);
  const [metaLancandoResultado, setMetaLancandoResultado] = useState<ContratoMeta | null>(null);
  const [abaHistorico, setAbaHistorico] = useState<'alteracoes' | 'visitas'>('alteracoes');
  const [paginaHistorico, setPaginaHistorico] = useState(1);
  const [paginaVisitas, setPaginaVisitas] = useState(0);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  const contratoQuery = useQuery({
    queryKey: ['contratos', publicId],
    queryFn: () => buscarContrato(publicId as string),
    enabled: !modoCriacao,
  });
  const contrato = contratoQuery.data?.contrato ?? null;

  const schema = useMemo(() => buildSchema(modoCriacao, isSuperadmin), [modoCriacao, isSuperadmin]);

  const {
    control,
    handleSubmit,
    watch,
    reset,
    setError,
    formState: { isSubmitting, isDirty },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  useEffect(() => {
    if (modoCriacao) {
      reset(DEFAULT_VALUES);
      return;
    }
    if (contrato) {
      reset({
        empresa_uuid: contrato.empresa?.id ?? null,
        ponto_venda_uuid: contrato.ponto_venda?.id ?? '',
        tipo: contrato.tipo,
        descricao: contrato.descricao ?? '',
        vigencia_inicio: paraInputDate(contrato.vigencia_inicio),
        vigencia_fim: paraInputDate(contrato.vigencia_fim),
      });
    }
  }, [modoCriacao, contrato, reset]);

  const empresaUuidEscolhida = watch('empresa_uuid');

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: modoCriacao && isSuperadmin,
  });

  // Trocar o PDV de um contrato já existente continua permitido (API sempre aceitou, ver
  // UpdateContratoRequest) — só a empresa do contrato que não muda depois de criado. Pra
  // ADMIN/GESTOR a API já restringe à própria empresa; pra SUPERADMIN, escopa pela empresa
  // escolhida (criando) ou pela empresa fixa do contrato (editando).
  const empresaParaListarPdv = modoCriacao ? empresaUuidEscolhida : (contrato?.empresa?.id ?? null);
  const pontosVendaQuery = useQuery({
    queryKey: ['pontos-venda', 'form-contrato', empresaParaListarPdv],
    queryFn: () => listarPontosVenda({ ativo: true, empresa_uuid: isSuperadmin ? (empresaParaListarPdv ?? undefined) : undefined }),
    enabled: modoCriacao ? (!isSuperadmin || Boolean(empresaParaListarPdv)) : Boolean(contrato),
  });
  const pontosVenda = pontosVendaQuery.data?.pontos_venda ?? [];

  const salvarMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        ponto_venda_uuid: data.ponto_venda_uuid,
        tipo: data.tipo,
        descricao: data.descricao || null,
        vigencia_inicio: data.vigencia_inicio,
        vigencia_fim: data.vigencia_fim,
      };

      if (modoCriacao) {
        return criarContrato({ ...payload, empresa_uuid: isSuperadmin ? (data.empresa_uuid ?? undefined) : undefined });
      }
      return atualizarContrato(contrato!.id, payload);
    },
    onSuccess: ({ contrato: salvo }) => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['contratos'] });
      if (modoCriacao) {
        // Some da tela de criação direto pra tela cheia do contrato recém-criado — é ali que
        // metas/anexo/histórico passam a fazer sentido.
        navigate(`/contratos/${salvo.id}`, { replace: true });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['contratos', publicId] });
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(err) && err.response?.status === 422) {
        const errors = err.response.data.errors;
        if (errors) {
          for (const [campo, mensagens] of Object.entries(errors)) {
            if (campo in DEFAULT_VALUES) {
              setError(campo as keyof FormData, { message: mensagens[0] });
            }
          }
        }
        setErro(errors ? '' : (err.response.data.message ?? 'Não foi possível salvar.'));
        return;
      }
      setErro('Não foi possível conectar à API. Tente novamente.');
    },
  });

  const desativarMutation = useMutation({
    mutationFn: () => desativarContrato(contrato!.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['contratos', publicId] });
      void queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: () => setErro('Não foi possível desativar o contrato.'),
  });

  const reativarMutation = useMutation({
    mutationFn: () => atualizarContrato(contrato!.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['contratos', publicId] });
      void queryClient.invalidateQueries({ queryKey: ['contratos'] });
    },
    onError: () => setErro('Não foi possível reativar o contrato.'),
  });

  function alternarStatus() {
    if (!contrato) return;
    if (contrato.ativo) {
      if (window.confirm(`Desativar o contrato de ${contrato.ponto_venda?.fantasia}?`)) {
        desativarMutation.mutate();
      }
      return;
    }
    reativarMutation.mutate();
  }

  const uploadMutation = useMutation({
    mutationFn: (arquivo: File) => uploadArquivoContrato(contrato!.id, arquivo),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['contratos', publicId] });
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível enviar o arquivo.';
      setErro(mensagem);
    },
  });

  const removerMetaMutation = useMutation({
    mutationFn: (meta: ContratoMeta) => removerContratoMeta(contrato!.id, meta.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['contratos', publicId] });
    },
    onError: () => setErro('Não foi possível remover a meta.'),
  });

  const historicoQuery = useQuery({
    queryKey: ['contratos', publicId, 'historico', paginaHistorico],
    queryFn: () => buscarHistoricoContrato(publicId as string, paginaHistorico),
    enabled: !modoCriacao && abaHistorico === 'alteracoes',
  });

  const visitasQuery = useQuery({
    queryKey: ['visitas', { ponto_venda_uuid: contrato?.ponto_venda?.id, page: paginaVisitas }],
    queryFn: () => listarVisitas({ ponto_venda_uuid: contrato!.ponto_venda!.id, page: paginaVisitas + 1 }),
    enabled: !modoCriacao && abaHistorico === 'visitas' && Boolean(contrato?.ponto_venda),
  });

  function arquivoSelecionado(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (arquivo) {
      uploadMutation.mutate(arquivo);
    }
  }

  function removerMeta(meta: ContratoMeta) {
    const alvo = meta.marca?.descricao ?? 'geral do PDV';
    if (window.confirm(`Remover a meta ${alvo}? Essa ação não pode ser desfeita.`)) {
      removerMetaMutation.mutate(meta);
    }
  }

  if (!modoCriacao && contratoQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!modoCriacao && (contratoQuery.isError || !contrato)) {
    return <Typography color="error">Contrato não encontrado.</Typography>;
  }

  const metas = contrato?.metas ?? [];

  return (
    <Box>
      <input ref={inputArquivoRef} type="file" accept=".pdf,.jpg,.jpeg,.png" hidden onChange={arquivoSelecionado} />

      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/contratos')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <Typography variant="h4" component="h1">
          {modoCriacao ? 'Novo contrato' : (contrato!.ponto_venda?.fantasia ?? 'Contrato')}
        </Typography>
        {!modoCriacao && (
          <Chip label={contrato!.ativo ? 'Ativo' : 'Inativo'} color={contrato!.ativo ? 'success' : 'default'} size="small" />
        )}
        <Box sx={{ flexGrow: 1 }} />
        {!modoCriacao && !isSuperadmin && (
          <Button
            variant="outlined"
            color={contrato!.ativo ? 'error' : 'success'}
            disabled={desativarMutation.isPending || reativarMutation.isPending}
            onClick={alternarStatus}
          >
            {contrato!.ativo ? 'Desativar' : 'Reativar'}
          </Button>
        )}
      </Box>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dados
        </Typography>
        <Box component="form" onSubmit={(e) => void handleSubmit((data) => salvarMutation.mutate(data))(e)} noValidate>
          <Grid container spacing={2}>
            {modoCriacao && isSuperadmin && (
              <Grid size={{ xs: 12, sm: 6 }}>
                <Controller
                  name="empresa_uuid"
                  control={control}
                  render={({ field, fieldState }) => (
                    <Autocomplete
                      options={empresasQuery.data?.empresas ?? []}
                      getOptionLabel={(option) => option.nome_fantasia}
                      loading={empresasQuery.isLoading}
                      value={empresasQuery.data?.empresas.find((e) => e.id === field.value) ?? null}
                      onChange={(_, value) => field.onChange(value?.id ?? null)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Empresa"
                          fullWidth
                          error={!!fieldState.error}
                          helperText={fieldState.error?.message ?? 'Em qual empresa esse contrato vai ser criado'}
                        />
                      )}
                    />
                  )}
                />
              </Grid>
            )}
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="ponto_venda_uuid"
                control={control}
                render={({ field, fieldState }) => (
                  <Autocomplete
                    options={pontosVenda}
                    getOptionLabel={(option) => option.fantasia}
                    loading={pontosVendaQuery.isLoading}
                    disabled={modoCriacao && isSuperadmin && !empresaUuidEscolhida}
                    value={pontosVenda.find((p) => p.id === field.value) ?? null}
                    onChange={(_, value) => field.onChange(value?.id ?? '')}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Ponto de venda"
                        fullWidth
                        autoFocus={modoCriacao && !isSuperadmin}
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="tipo"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField {...field} select label="Tipo de contrato" fullWidth error={!!fieldState.error} helperText={fieldState.error?.message}>
                    {TIPOS.map((tipo) => (
                      <MenuItem key={tipo.value} value={tipo.value}>
                        {tipo.label}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="vigencia_inicio"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Vigência início"
                    type="date"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller
                name="vigencia_fim"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Vigência fim"
                    type="date"
                    fullWidth
                    slotProps={{ inputLabel: { shrink: true } }}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <Controller
                name="descricao"
                control={control}
                render={({ field, fieldState }) => (
                  <TextField
                    {...field}
                    label="Descrição"
                    placeholder="Ex.: freezer 2 portas, ponta de gôndola do corredor 3"
                    fullWidth
                    multiline
                    minRows={2}
                    error={!!fieldState.error}
                    helperText={fieldState.error?.message}
                  />
                )}
              />
            </Grid>
          </Grid>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button type="submit" variant="contained" disabled={isSubmitting || (!modoCriacao && !isDirty)}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {!modoCriacao && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Anexo
          </Typography>
          {contrato!.arquivo_url ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button
                startIcon={<DescriptionIcon />}
                component="a"
                href={contrato!.arquivo_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Ver arquivo assinado
              </Button>
              <Button
                variant="text"
                startIcon={<AttachFileIcon />}
                disabled={uploadMutation.isPending}
                onClick={() => inputArquivoRef.current?.click()}
              >
                {uploadMutation.isPending ? 'Enviando...' : 'Substituir'}
              </Button>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Nenhum arquivo anexado ainda — cadastra o contrato primeiro, anexa o documento
                assinado depois.
              </Typography>
              <Button
                variant="outlined"
                startIcon={<AttachFileIcon />}
                disabled={uploadMutation.isPending}
                onClick={() => inputArquivoRef.current?.click()}
              >
                {uploadMutation.isPending ? 'Enviando...' : 'Anexar arquivo'}
              </Button>
            </Box>
          )}
        </Paper>
      )}

      {!modoCriacao && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Metas de contrapartida</Typography>
            <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={() => setDialogNovaMetaAberto(true)}>
              Nova meta
            </Button>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Marca</TableCell>
                  <TableCell>Período</TableCell>
                  <TableCell align="right">Investido</TableCell>
                  <TableCell align="right">Meta</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Retorno</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      Nenhuma meta negociada ainda.
                    </TableCell>
                  </TableRow>
                )}
                {metas.map((meta) => (
                  <TableRow key={meta.id} hover>
                    <TableCell>{meta.marca?.descricao ?? 'Geral'}</TableCell>
                    <TableCell>
                      {formatarDataSemFuso(meta.periodo_inicio)} – {formatarDataSemFuso(meta.periodo_fim)}
                    </TableCell>
                    <TableCell align="right">{formatarMoeda(Number(meta.valor_investimento))}</TableCell>
                    <TableCell align="right">{formatarMoeda(Number(meta.meta_valor))}</TableCell>
                    <TableCell>
                      <Chip
                        label={STATUS_META_LABELS[meta.resumo.status_apuracao]}
                        color={STATUS_META_COLORS[meta.resumo.status_apuracao]}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {meta.resumo.retorno_sobre_investimento !== null
                        ? `${meta.resumo.retorno_sobre_investimento.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}x`
                        : '—'}
                    </TableCell>
                    <TableCell align="right">
                      {meta.resumo.status_apuracao === 'AGUARDANDO' && (
                        <Tooltip title="Lançar resultado">
                          <IconButton size="small" onClick={() => setMetaLancandoResultado(meta)}>
                            <PaidIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {!isSuperadmin && (
                        <Tooltip title="Remover">
                          <IconButton size="small" onClick={() => removerMeta(meta)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {!modoCriacao && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Histórico
          </Typography>

          <Tabs
            value={abaHistorico}
            onChange={(_, valor: 'alteracoes' | 'visitas') => setAbaHistorico(valor)}
            sx={{ mb: 2 }}
          >
            <Tab label="Alterações" value="alteracoes" />
            <Tab label="Visitas neste PDV" value="visitas" />
          </Tabs>

          {abaHistorico === 'alteracoes' ? (
            <>
              {historicoQuery.isLoading ? (
                <CircularProgress size={20} />
              ) : (historicoQuery.data?.historico.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma alteração registrada ainda.
                </Typography>
              ) : (
                <Box>
                  {historicoQuery.data?.historico.map((evento) => (
                    <Box
                      key={evento.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 2,
                        py: 1.25,
                        borderBottom: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <Box>
                        <Typography variant="body2">{evento.descricao}</Typography>
                        {evento.usuario && (
                          <Typography variant="caption" color="text.secondary">
                            {evento.usuario.nome}
                          </Typography>
                        )}
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                        {new Date(evento.created_at).toLocaleString('pt-BR')}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}
              {(historicoQuery.data?.meta.last_page ?? 1) > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    size="small"
                    count={historicoQuery.data?.meta.last_page ?? 1}
                    page={paginaHistorico}
                    onChange={(_, pagina) => setPaginaHistorico(pagina)}
                  />
                </Box>
              )}
            </>
          ) : (
            <>
              {visitasQuery.isLoading ? (
                <CircularProgress size={20} />
              ) : (visitasQuery.data?.visitas.length ?? 0) === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  Nenhuma visita registrada nesse ponto de venda ainda.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Promotor</TableCell>
                        <TableCell>Início</TableCell>
                        <TableCell>Fim</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Distância no check-in</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visitasQuery.data?.visitas.map((visita) => (
                        <TableRow key={visita.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/visitas/${visita.id}`)}>
                          <TableCell>{visita.usuario?.nome ?? '—'}</TableCell>
                          <TableCell>{new Date(visita.inicio_data).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>{visita.fim_data ? new Date(visita.fim_data).toLocaleString('pt-BR') : '—'}</TableCell>
                          <TableCell>
                            <Chip label={STATUS_VISITA_LABELS[visita.status]} color={STATUS_VISITA_COLORS[visita.status]} size="small" />
                          </TableCell>
                          <TableCell align="right">{Math.round(visita.inicio_distancia_metros)} m</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {(visitasQuery.data?.meta.last_page ?? 1) > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
                  <Pagination
                    size="small"
                    count={visitasQuery.data?.meta.last_page ?? 1}
                    page={paginaVisitas + 1}
                    onChange={(_, pagina) => setPaginaVisitas(pagina - 1)}
                  />
                </Box>
              )}
            </>
          )}
        </Paper>
      )}

      {contrato && (
        <>
          <ContratoMetaFormDialog open={dialogNovaMetaAberto} contrato={contrato} onClose={() => setDialogNovaMetaAberto(false)} />
          <LancarResultadoDialog
            open={metaLancandoResultado !== null}
            contrato={contrato}
            meta={metaLancandoResultado}
            onClose={() => setMetaLancandoResultado(null)}
          />
        </>
      )}
    </Box>
  );
}

import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdiIcon } from '../../components/MdiIcon';
import { listarEmpresasSuperadmin } from '../../lib/api/empresas';
import {
  atualizarTipoRegistro,
  desativarTipoRegistro,
  duplicarTipoRegistro,
  listarTiposRegistro,
  moverTipoRegistro,
} from '../../lib/api/tiposRegistro';
import { useAuth } from '../../lib/auth/AuthContext';
import type { TipoRegistro } from '../../types/api';

export function TiposRegistroListPage() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  // Mesmo raciocínio de CatalogoPage: catálogo/tipos de registro são dado próprio de cada
  // empresa (BelongsToEmpresa) — pro SUPERADMIN, que não pertence a empresa nenhuma, a listagem
  // viria misturando itens de todas as empresas sem filtro nenhum, e a API bloqueia
  // SUPERADMIN de criar/editar/desativar (ver App\Http\Middleware\EnsurePermissao).
  const isSuperadmin = usuario?.user_type === 'SUPERADMIN';
  const [empresaUuid, setEmpresaUuid] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  // '' = todos; 'sim'/'nao' viram o booleano do filtro na API.
  const [espontaneo, setEspontaneo] = useState<'' | 'sim' | 'nao'>('');
  const [status, setStatus] = useState<'' | 'ativos' | 'inativos'>('');
  const filtrando = busca !== '' || espontaneo !== '' || status !== '';

  const empresasQuery = useQuery({
    queryKey: ['empresas', 'superadmin'],
    queryFn: listarEmpresasSuperadmin,
    enabled: isSuperadmin,
  });

  const query = useQuery({
    queryKey: ['tipos-registro', { empresaUuid, busca, espontaneo, status }],
    queryFn: () =>
      listarTiposRegistro({
        empresa_uuid: empresaUuid ?? undefined,
        busca: busca.trim() || undefined,
        disponivel_registro_livre: espontaneo === '' ? undefined : espontaneo === 'sim',
        ativo: status === '' ? undefined : status === 'ativos',
      }),
    placeholderData: keepPreviousData,
  });

  const totalColunas = isSuperadmin ? 9 : 8;

  const rotuloEscopo: Record<NonNullable<TipoRegistro['escopo_acao']>, string> = {
    SEMPRE: 'Sempre',
    CAMPANHA: 'Campanha',
    CONTRATO: 'Contrato ativo',
    LOJA_REDE: 'Lojas/redes',
    LINHA_AUSENTE: 'Linha fora do Mix',
  };

  const reativarMutation = useMutation({
    mutationFn: (t: TipoRegistro) => atualizarTipoRegistro(t.id, { ativo: true }),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
    },
    onError: () => setErro('Não foi possível reativar o tipo.'),
  });

  const desativarMutation = useMutation({
    mutationFn: (t: TipoRegistro) => desativarTipoRegistro(t.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
    },
    onError: () => setErro('Não foi possível desativar o tipo.'),
  });

  const moverMutation = useMutation({
    mutationFn: ({ t, direcao }: { t: TipoRegistro; direcao: 'cima' | 'baixo' }) => moverTipoRegistro(t.id, direcao),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
    },
    onError: () => setErro('Não foi possível mover o tipo.'),
  });

  // Duplicar (decisão 6 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md) — clona um tipo existente
  // como ponto de partida de um formulário novo, ver TipoRegistroController::duplicar.
  const duplicarMutation = useMutation({
    mutationFn: (t: TipoRegistro) => duplicarTipoRegistro(t.id),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
    },
    onError: () => setErro('Não foi possível duplicar o tipo.'),
  });

  function alternarStatus(t: TipoRegistro) {
    if (t.ativo) {
      if (window.confirm(`Desativar "${t.descricao}"? Promotores não vão mais poder escolher esse tipo em novos registros.`)) {
        desativarMutation.mutate(t);
      }
      return;
    }
    reativarMutation.mutate(t);
  }

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Formulários" />);

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Lista própria da empresa — cada uma define os próprios formulários (ex.: "Foto",
        "Ruptura", "Ponto extra"), com campos customizados além da foto (ex.: quantidade, valor).
        É isso que o promotor escolhe no app ao registrar algo numa visita, e o que você vincula
        a uma Ordem de Serviço ou Direcionamento.
      </Typography>

      {isSuperadmin && (
        <Autocomplete
          size="small"
          sx={{ width: 280, mb: 2 }}
          options={empresasQuery.data?.empresas ?? []}
          getOptionLabel={(option) => option.nome_fantasia}
          loading={empresasQuery.isLoading}
          onChange={(_, value) => setEmpresaUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label="Empresa" placeholder="Todas as empresas" />}
        />
      )}

      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <TextField
          size="small"
          label="Buscar"
          placeholder="Nome do formulário"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{ width: 240 }}
        />
        <TextField
          select
          size="small"
          label="Registro espontâneo"
          value={espontaneo}
          onChange={(e) => setEspontaneo(e.target.value as typeof espontaneo)}
          sx={{ width: 200 }}
        >
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="sim">Sim, o promotor abre sozinho</MenuItem>
          <MenuItem value="nao">Não, só quando pedido</MenuItem>
        </TextField>
        <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} sx={{ width: 150 }}>
          <MenuItem value="">Todos</MenuItem>
          <MenuItem value="ativos">Ativos</MenuItem>
          <MenuItem value="inativos">Inativos</MenuItem>
        </TextField>
        {filtrando && (
          <Button
            size="small"
            onClick={() => {
              setBusca('');
              setEspontaneo('');
              setStatus('');
            }}
          >
            Limpar filtros
          </Button>
        )}
      </Box>

      {!isSuperadmin && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/tipos-registro/novo')}>
            Novo formulário
          </Button>
        </Box>
      )}

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <TableContainer component={Paper} sx={{ position: 'relative' }} aria-busy={query.isFetching}>
        {query.isFetching && !query.isLoading && (
          <LinearProgress sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 3 }} />
        )}
        <Table>
          <TableHead>
            <TableRow>
              {isSuperadmin && <TableCell>Empresa</TableCell>}
              <TableCell>Descrição</TableCell>
              <TableCell>Ícone</TableCell>
              <TableCell>Exige foto</TableCell>
              <TableCell>
                <Tooltip title="O promotor pode abrir esse formulário por conta própria na visita, sem estar pedido numa OS ou direcionamento.">
                  <span>Registro espontâneo</span>
                </Tooltip>
              </TableCell>
              <TableCell>Campos extras</TableCell>
              <TableCell>Ação</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody sx={{ opacity: query.isPlaceholderData ? 0.45 : 1, pointerEvents: query.isPlaceholderData ? 'none' : undefined, transition: 'opacity 150ms' }}>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.data?.tipos_registro.length === 0 && (
              <TableRow>
                <TableCell colSpan={totalColunas} align="center">
                  {filtrando ? 'Nenhum formulário com esses filtros.' : 'Nenhum tipo de registro cadastrado.'}
                </TableCell>
              </TableRow>
            )}
            {query.data?.tipos_registro.map((t, indice) => (
              <TableRow key={t.id} hover>
                {isSuperadmin && <TableCell>{t.empresa?.nome_fantasia ?? '—'}</TableCell>}
                <TableCell>{t.descricao}</TableCell>
                <TableCell>
                  <MdiIcon icone={t.icone} size={22} /> {!t.icone && '—'}
                </TableCell>
                <TableCell>{t.exige_foto ? 'Sim' : 'Não'}</TableCell>
                <TableCell>
                  <Chip
                    label={t.disponivel_registro_livre ? 'Sim' : 'Não'}
                    color={t.disponivel_registro_livre ? 'info' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {t.campos.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {t.campos.map((c) => (
                        <Chip key={c.id} label={c.rotulo} size="small" />
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  {t.acao_obrigatoria && t.escopo_acao ? (
                    <Chip label={rotuloEscopo[t.escopo_acao]} color="warning" size="small" />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={t.ativo ? 'Ativo' : 'Inativo'} color={t.ativo ? 'success' : 'default'} size="small" />
                    {t.eh_ruptura && <Chip label="Ruptura" color="secondary" size="small" />}
                    {t.eh_alerta && <Chip label="Alerta" color="error" size="small" />}
                  </Box>
                </TableCell>
                <TableCell align="right">
                  {isSuperadmin ? (
                    '—'
                  ) : (
                    <>
                      <Tooltip title="Mover para cima">
                        <span>
                          <IconButton
                            size="small"
                            disabled={filtrando || indice === 0 || moverMutation.isPending}
                            onClick={() => moverMutation.mutate({ t, direcao: 'cima' })}
                          >
                            <ArrowUpwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Mover para baixo">
                        <span>
                          <IconButton
                            size="small"
                            disabled={filtrando || indice === (query.data?.tipos_registro.length ?? 0) - 1 || moverMutation.isPending}
                            onClick={() => moverMutation.mutate({ t, direcao: 'baixo' })}
                          >
                            <ArrowDownwardIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => navigate(`/tipos-registro/${t.id}`)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t.ativo ? 'Desativar' : 'Reativar'}>
                        <IconButton size="small" onClick={() => alternarStatus(t)}>
                          {t.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Duplicar (ponto de partida pra um formulário novo)">
                        <span>
                          <IconButton size="small" disabled={duplicarMutation.isPending} onClick={() => duplicarMutation.mutate(t)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adicionarCampanhaItem, buscarCampanha, removerCampanhaItem } from '../../lib/api/campanhas';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { listarMarcas } from '../../lib/api/marcas';
import { listarProdutos } from '../../lib/api/produtos';
import { listarSecoes } from '../../lib/api/secoes';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { formatarDataSemFuso } from '../../lib/formatarData';
import { entidadeDoItem, TIPO_ITEM_LABELS } from '../../lib/tipoItemCampanha';
import type { TipoItemCampanha } from '../../types/api';

export function CampanhaDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tipoItem, setTipoItem] = useState<TipoItemCampanha>('PRODUTO');
  const [entidadeUuid, setEntidadeUuid] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const campanhaQuery = useQuery({
    queryKey: ['campanhas', publicId],
    queryFn: () => buscarCampanha(publicId!),
    enabled: !!publicId,
  });

  // Hook sempre chamado, mesmo antes de saber se a campanha carregou — Rules of Hooks não
  // permite pular a chamada num render e chamar no outro.
  const cabecalho = usePageHeader(
    campanhaQuery.data ? (
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        {campanhaQuery.data.campanha.descricao}
      </Typography>
    ) : null,
  );

  // "Formulário desta campanha" (Fase 3, autoria embutida — docs/20-FORMULARIO-DINAMICO-CAMPANHA.md
  // §3) — por baixo é o mesmo TipoRegistro/mesmo endpoint de Tipos de Registro, só filtrado por
  // campanha_auditoria_uuid pra não misturar com o catálogo geral da empresa.
  const formulariosQuery = useQuery({
    queryKey: ['tipos-registro', { campanha_auditoria_uuid: publicId }],
    queryFn: () => listarTiposRegistro({ campanha_auditoria_uuid: publicId! }),
    enabled: !!publicId,
  });

  const produtosQuery = useQuery({ queryKey: ['produtos'], queryFn: () => listarProdutos(), enabled: tipoItem === 'PRODUTO' });
  const secoesQuery = useQuery({ queryKey: ['secoes'], queryFn: () => listarSecoes(), enabled: tipoItem === 'SECAO' });
  const departamentosQuery = useQuery({
    queryKey: ['departamentos'],
    queryFn: () => listarDepartamentos(),
    enabled: tipoItem === 'DEPARTAMENTO',
  });
  const marcasQuery = useQuery({ queryKey: ['marcas'], queryFn: () => listarMarcas(), enabled: tipoItem === 'MARCA' });

  const adicionarMutation = useMutation({
    mutationFn: () => {
      const campo =
        tipoItem === 'PRODUTO'
          ? 'produto_uuid'
          : tipoItem === 'SECAO'
            ? 'secao_uuid'
            : tipoItem === 'DEPARTAMENTO'
              ? 'departamento_uuid'
              : 'marca_uuid';

      return adicionarCampanhaItem(publicId!, { tipo_item: tipoItem, [campo]: entidadeUuid! });
    },
    onSuccess: () => {
      setErro(null);
      setEntidadeUuid(null);
      void queryClient.invalidateQueries({ queryKey: ['campanhas', publicId] });
    },
    onError: (err) => {
      const mensagem =
        axios.isAxiosError<{ message?: string }>(err) && err.response?.data.message
          ? err.response.data.message
          : 'Não foi possível adicionar o item.';
      setErro(mensagem);
    },
  });

  const removerMutation = useMutation({
    mutationFn: (itemUuid: string) => removerCampanhaItem(publicId!, itemUuid),
    onSuccess: () => {
      setErro(null);
      void queryClient.invalidateQueries({ queryKey: ['campanhas', publicId] });
    },
    onError: () => setErro('Não foi possível remover o item.'),
  });

  if (campanhaQuery.isLoading) {
    return <CircularProgress />;
  }

  const campanha = campanhaQuery.data?.campanha;

  if (!campanha) {
    return <Alert severity="error">Campanha não encontrada.</Alert>;
  }

  const opcoes =
    tipoItem === 'PRODUTO'
      ? (produtosQuery.data?.produtos ?? [])
      : tipoItem === 'SECAO'
        ? (secoesQuery.data?.secoes ?? [])
        : tipoItem === 'DEPARTAMENTO'
          ? (departamentosQuery.data?.departamentos ?? [])
          : (marcasQuery.data?.marcas ?? []);
  const carregandoOpcoes = produtosQuery.isLoading || secoesQuery.isLoading || departamentosQuery.isLoading || marcasQuery.isLoading;

  return (
    <Box>
      {cabecalho}
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/campanhas')} sx={{ mb: 2 }}>
        Voltar
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Chip label={campanha.ativo ? 'Ativa' : 'Inativa'} color={campanha.ativo ? 'success' : 'default'} size="small" />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Vigência: {formatarDataSemFuso(campanha.vigencia_inicio)} até {formatarDataSemFuso(campanha.vigencia_fim)}
      </Typography>

      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          select
          label="Tipo"
          size="small"
          sx={{ width: 220 }}
          value={tipoItem}
          onChange={(e) => {
            setTipoItem(e.target.value as TipoItemCampanha);
            setEntidadeUuid(null);
          }}
        >
          {(Object.keys(TIPO_ITEM_LABELS) as TipoItemCampanha[]).map((tipo) => (
            <MenuItem key={tipo} value={tipo}>
              {TIPO_ITEM_LABELS[tipo]}
            </MenuItem>
          ))}
        </TextField>
        <Autocomplete
          size="small"
          sx={{ width: 280 }}
          options={opcoes}
          getOptionLabel={(option) => option.descricao}
          loading={carregandoOpcoes}
          value={opcoes.find((o) => o.id === entidadeUuid) ?? null}
          onChange={(_, value) => setEntidadeUuid(value?.id ?? null)}
          renderInput={(params) => <TextField {...params} label={TIPO_ITEM_LABELS[tipoItem]} />}
        />
        <Button
          variant="contained"
          disabled={!entidadeUuid || adicionarMutation.isPending}
          onClick={() => adicionarMutation.mutate()}
        >
          Adicionar item
        </Button>
      </Paper>

      <TableContainer component={Paper} sx={{ mb: 4 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tipo</TableCell>
              <TableCell>Cobre</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(campanha.itens?.length ?? 0) === 0 && (
              <TableRow>
                <TableCell colSpan={3} align="center">
                  Nenhum item adicionado ainda.
                </TableCell>
              </TableRow>
            )}
            {campanha.itens?.map((item) => (
              <TableRow key={item.id} hover>
                <TableCell>
                  <Chip label={TIPO_ITEM_LABELS[item.tipo_item]} size="small" />
                </TableCell>
                <TableCell>{entidadeDoItem(item)}</TableCell>
                <TableCell align="right">
                  <Tooltip title="Remover">
                    <IconButton size="small" onClick={() => removerMutation.mutate(item.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Formulário desta campanha — Fase 3 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md §3. */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="h6">Formulário desta campanha</Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() =>
            navigate('/tipos-registro/novo', { state: { campanhaContexto: { uuid: campanha.id, descricao: campanha.descricao } } })
          }
        >
          Novo formulário
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        As perguntas que o promotor responde nas visitas desta campanha — por baixo é o mesmo
        motor de "Tipos de Registro" (campos tipados, condicional, sortimento), só que já nasce
        vinculado a esta campanha, sem precisar configurar isso na mão.
      </Typography>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Descrição</TableCell>
              <TableCell>Campos</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {formulariosQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {formulariosQuery.data?.tipos_registro.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Nenhum formulário criado ainda pra esta campanha.
                </TableCell>
              </TableRow>
            )}
            {formulariosQuery.data?.tipos_registro.map((tipo) => (
              <TableRow key={tipo.id} hover>
                <TableCell>{tipo.descricao}</TableCell>
                <TableCell>
                  {tipo.campos.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      —
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {tipo.campos.map((c) => (
                        <Chip key={c.id} label={c.rotulo} size="small" />
                      ))}
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={tipo.ativo ? 'Ativo' : 'Inativo'} color={tipo.ativo ? 'success' : 'default'} size="small" />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton
                      size="small"
                      onClick={() =>
                        navigate(`/tipos-registro/${tipo.id}`, {
                          state: { campanhaContexto: { uuid: campanha.id, descricao: campanha.descricao } },
                        })
                      }
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

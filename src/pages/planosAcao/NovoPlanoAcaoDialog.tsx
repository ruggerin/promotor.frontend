import AddIcon from '@mui/icons-material/Add';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { criarPlanoAcao, listarResponsaveisPlanoAcao } from '../../lib/api/planosAcao';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { EtapaCampos } from './EtapaCampos';
import { etapaParaPayload, etapaVazia, mensagemErro, type EtapaForm } from './etapaForm';

// Contexto do alerta de origem — só pra pré-preencher o título e mostrar ao usuário o que ele
// está tratando. O backend relê tudo a partir do registro_uuid.
export interface AlertaOrigem {
  registroUuid: string;
  tipo: string;
  produto?: string | null;
  pontoVenda?: string | null;
  observacao?: string | null;
}

// Sem moldes ainda (fase 2 do docs/37 §8) — sugere o fluxo mais comum (ruptura, §3.1) como
// ponto de partida editável, pra não abrir o diálogo com uma etapa só e em branco.
const ETAPAS_SUGERIDAS = ['Comunicar o responsável', 'Visita/ação na loja', 'Confirmar resolução na gôndola'];

type Vinculo = 'nenhum' | 'loja' | 'rede';

// Abre um Plano de Ação — a partir de um alerta do Painel de Atividades (`alerta` preenchido,
// loja herdada dele) ou livre, pela tela de Planos de Ação, opcionalmente ligado a uma loja OU
// uma rede (docs/37-PLANOS-DE-ACAO.md §4.2). Ao criar, leva direto pro detalhe do plano.
export function NovoPlanoAcaoDialog({
  open,
  alerta = null,
  onClose,
}: {
  open: boolean;
  alerta?: AlertaOrigem | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {/* Só monta aberto: cada abertura começa com o formulário limpo/pré-preenchido de novo. */}
      {open && <FormularioPlano key={alerta?.registroUuid ?? 'livre'} alerta={alerta} onClose={onClose} />}
    </Dialog>
  );
}

function FormularioPlano({ alerta, onClose }: { alerta: AlertaOrigem | null; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [titulo, setTitulo] = useState(() =>
    alerta ? [alerta.tipo, alerta.produto, alerta.pontoVenda].filter(Boolean).join(' — ') : '',
  );
  const [descricao, setDescricao] = useState(alerta?.observacao ?? '');
  const [prazo, setPrazo] = useState('');
  const [vinculo, setVinculo] = useState<Vinculo>('nenhum');
  const [pontoVendaUuid, setPontoVendaUuid] = useState<string | null>(null);
  const [redeLojaUuid, setRedeLojaUuid] = useState<string | null>(null);
  // Plano de alerta já sugere o fluxo de ruptura; plano livre começa com uma etapa em branco.
  const [etapas, setEtapas] = useState<EtapaForm[]>(() =>
    alerta ? ETAPAS_SUGERIDAS.map((t) => etapaVazia(t)) : [etapaVazia()],
  );
  const [erro, setErro] = useState<string | null>(null);
  const [planoExistente, setPlanoExistente] = useState<string | null>(null);

  const responsaveisQuery = useQuery({ queryKey: ['planos-acao', 'responsaveis'], queryFn: listarResponsaveisPlanoAcao });
  const lojasQuery = useQuery({
    queryKey: ['pontos-venda', 'seletor-plano-acao'],
    queryFn: () => listarPontosVenda({ ativo: true, por_pagina: 200 }),
    enabled: !alerta && vinculo === 'loja',
  });
  const redesQuery = useQuery({
    queryKey: ['redes-lojas', 'seletor-plano-acao'],
    queryFn: () => listarRedesLojas({ ativo: true, por_pagina: 200 }),
    enabled: !alerta && vinculo === 'rede',
  });
  const lojas = lojasQuery.data?.pontos_venda ?? [];
  const redes = redesQuery.data?.redes_lojas ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      criarPlanoAcao({
        ...(alerta
          ? { registro_uuid: alerta.registroUuid }
          : {
              ponto_venda_uuid: vinculo === 'loja' ? pontoVendaUuid : null,
              rede_loja_uuid: vinculo === 'rede' ? redeLojaUuid : null,
            }),
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        prazo: prazo || null,
        etapas: etapas.map(etapaParaPayload),
      }),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['atividades'] });
      void queryClient.invalidateQueries({ queryKey: ['planos-acao'] });
      onClose();
      navigate(`/planos-acao/${data.plano_acao.id}`);
    },
    onError: (err) => {
      // Só um plano ativo por alerta (§5) — a API devolve o existente pra levar o usuário até ele.
      if (axios.isAxiosError<{ plano_acao_id?: string }>(err) && err.response?.data?.plano_acao_id) {
        setPlanoExistente(err.response.data.plano_acao_id);
      }
      setErro(mensagemErro(err, 'Não foi possível abrir o plano de ação.'));
    },
  });

  function moverEtapa(i: number, delta: -1 | 1) {
    setEtapas((atual) => {
      const nova = [...atual];
      [nova[i], nova[i + delta]] = [nova[i + delta], nova[i]];
      return nova;
    });
  }

  // Escolheu "Loja"/"Rede" mas não selecionou nenhuma — não deixa criar como "sem vínculo" por engano.
  const vinculoCompleto =
    !!alerta || vinculo === 'nenhum' || (vinculo === 'loja' ? !!pontoVendaUuid : !!redeLojaUuid);
  const valido =
    titulo.trim() !== '' && vinculoCompleto && etapas.length > 0 && etapas.every((e) => e.titulo.trim() !== '');

  return (
    <>
      <DialogTitle>{alerta ? 'Abrir Plano de Ação' : 'Novo Plano de Ação'}</DialogTitle>
      <DialogContent dividers>
        {alerta ? (
          <Alert severity="warning" icon={false} sx={{ mb: 2 }}>
            <Typography variant="body2">
              <strong>Alerta de origem:</strong> {alerta.tipo}
              {alerta.produto ? ` · ${alerta.produto}` : ''}
              {alerta.pontoVenda ? ` · ${alerta.pontoVenda}` : ''}
            </Typography>
          </Alert>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Vincular a:
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={vinculo}
              onChange={(_, v: Vinculo | null) => v && setVinculo(v)}
            >
              <ToggleButton value="nenhum">Nenhum</ToggleButton>
              <ToggleButton value="loja">Uma loja</ToggleButton>
              <ToggleButton value="rede">Uma rede</ToggleButton>
            </ToggleButtonGroup>
            {vinculo === 'loja' && (
              <Autocomplete
                size="small"
                sx={{ minWidth: 280, flex: 1 }}
                options={lojas}
                loading={lojasQuery.isLoading}
                getOptionLabel={(p) => p.fantasia}
                value={lojas.find((p) => p.id === pontoVendaUuid) ?? null}
                onChange={(_, p) => setPontoVendaUuid(p?.id ?? null)}
                renderInput={(params) => <TextField {...params} label="Loja" required />}
              />
            )}
            {vinculo === 'rede' && (
              <Autocomplete
                size="small"
                sx={{ minWidth: 280, flex: 1 }}
                options={redes}
                loading={redesQuery.isLoading}
                getOptionLabel={(r) => r.descricao}
                value={redes.find((r) => r.id === redeLojaUuid) ?? null}
                onChange={(_, r) => setRedeLojaUuid(r?.id ?? null)}
                renderInput={(params) => <TextField {...params} label="Rede" required />}
              />
            )}
          </Box>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '3fr 1fr' }, gap: 1.5, mb: 1.5 }}>
          <TextField label="Título do plano" required value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          <TextField
            label="Prazo do plano"
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
        <TextField
          label="Descrição (opcional)"
          fullWidth
          multiline
          minRows={2}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          sx={{ mb: 2.5 }}
        />

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Etapas
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {etapas.map((etapa, i) => (
            <Paper key={i} variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', flexGrow: 1 }}>
                  ETAPA {i + 1}
                </Typography>
                <IconButton size="small" disabled={i === 0} onClick={() => moverEtapa(i, -1)} title="Subir">
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={i === etapas.length - 1}
                  onClick={() => moverEtapa(i, 1)}
                  title="Descer"
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  disabled={etapas.length === 1}
                  onClick={() => setEtapas((atual) => atual.filter((_, j) => j !== i))}
                  title="Remover etapa"
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Box>
              <EtapaCampos
                etapa={etapa}
                responsaveis={responsaveisQuery.data ?? []}
                onChange={(nova) => setEtapas((atual) => atual.map((e, j) => (j === i ? nova : e)))}
              />
            </Paper>
          ))}
        </Box>
        <Button startIcon={<AddIcon />} sx={{ mt: 1.5 }} onClick={() => setEtapas((atual) => [...atual, etapaVazia()])}>
          Adicionar etapa
        </Button>

        {erro && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              planoExistente ? (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    onClose();
                    navigate(`/planos-acao/${planoExistente}`);
                  }}
                >
                  Ver plano
                </Button>
              ) : undefined
            }
          >
            {erro}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!valido || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Abrindo...' : 'Abrir plano'}
        </Button>
      </DialogActions>
    </>
  );
}

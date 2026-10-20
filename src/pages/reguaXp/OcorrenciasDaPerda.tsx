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
  Link,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { listarMotivosNaoExecucao } from '../../lib/api/motivosNaoExecucao';
import { classificarOcorrencia, listarOcorrencias, type FiltrosRegua } from '../../lib/api/xp';
import type { OcorrenciaXp } from '../../types/api';
import { NovoPlanoAcaoDialog } from '../planosAcao/NovoPlanoAcaoDialog';
import { ClasseLojaChip } from './ClasseLojaChip';

const RESPONSAVEL: Record<string, string> = { PROMOTOR: 'Promotor', LOJA: 'Loja', EMPRESA: 'Empresa', OUTRO: 'Outro' };

const dataCurta = (dia: string) => dia.split('-').reverse().slice(0, 2).join('/');

/**
 * Ocorrências de uma categoria de perda (docs/88 §8): cada uma aponta pra visita/OS que causou.
 * O gestor classifica (justificada ou não, causa, comentário) e pode gerar um plano de ação pra
 * não repetir. O número nunca é perdoado — a classificação é histórico, append-only.
 */
export function OcorrenciasDaPerda({ filtros, categoria, podeClassificar }: { filtros: FiltrosRegua; categoria: string; podeClassificar: boolean }) {
  const [emClassificacao, setEmClassificacao] = useState<OcorrenciaXp | null>(null);
  const query = useQuery({
    queryKey: ['xp', 'ocorrencias', filtros, categoria],
    queryFn: () => listarOcorrencias({ ...filtros, categoria }),
  });

  if (query.isLoading) return <CircularProgress size={20} sx={{ m: 2 }} />;
  const ocorrencias = query.data ?? [];

  return (
    <Box sx={{ py: 1 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Dia</TableCell>
            <TableCell>Loja</TableCell>
            <TableCell>Promotor</TableCell>
            <TableCell align="right">XP</TableCell>
            <TableCell>Motivo registrado</TableCell>
            <TableCell>Tratamento</TableCell>
            {podeClassificar && <TableCell />}
          </TableRow>
        </TableHead>
        <TableBody>
          {ocorrencias.map((o) => (
            <TableRow key={o.id}>
              <TableCell>{dataCurta(o.dia)}</TableCell>
              <TableCell>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  {o.visita_id ? (
                    <Link component={RouterLink} to={`/visitas/${o.visita_id}`}>
                      {o.loja?.fantasia ?? '—'}
                    </Link>
                  ) : (
                    (o.loja?.fantasia ?? '—')
                  )}
                  <ClasseLojaChip classe={o.classe} />
                </Box>
              </TableCell>
              <TableCell>{o.promotor?.nome ?? '—'}</TableCell>
              <TableCell align="right">{o.xp.toLocaleString('pt-BR')}</TableCell>
              <TableCell>
                {o.motivo_nao_execucao ?? (o.responsavel_nao_execucao ? '' : '—')}
                {o.responsavel_nao_execucao && (
                  <Typography variant="caption" color="text.secondary" component="div">
                    Responsável: {RESPONSAVEL[o.responsavel_nao_execucao] ?? o.responsavel_nao_execucao}
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {o.classificacao ? (
                  <Box>
                    <Chip
                      size="small"
                      label={o.classificacao.justificada ? 'Justificada' : 'Não justificada'}
                      color={o.classificacao.justificada ? 'success' : 'warning'}
                      variant="outlined"
                    />
                    {o.classificacao.causa && (
                      <Typography variant="caption" component="div">
                        {o.classificacao.causa.descricao}
                      </Typography>
                    )}
                    {o.classificacao.plano_acao && (
                      <Link component={RouterLink} to={`/planos-acao/${o.classificacao.plano_acao.id}`} variant="caption">
                        Plano: {o.classificacao.plano_acao.titulo}
                      </Link>
                    )}
                  </Box>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    Não classificada
                  </Typography>
                )}
              </TableCell>
              {podeClassificar && (
                <TableCell align="right">
                  <Button size="small" onClick={() => setEmClassificacao(o)}>
                    {o.classificacao ? 'Reclassificar' : 'Classificar'}
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {emClassificacao && <ClassificarDialog ocorrencia={emClassificacao} onFechar={() => setEmClassificacao(null)} />}
    </Box>
  );
}

function ClassificarDialog({ ocorrencia, onFechar }: { ocorrencia: OcorrenciaXp; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const atual = ocorrencia.classificacao;
  const [justificada, setJustificada] = useState<boolean>(atual?.justificada ?? false);
  const [causa, setCausa] = useState<string>(atual?.causa?.id ?? '');
  const [comentario, setComentario] = useState(atual?.comentario ?? '');
  const [planoAberto, setPlanoAberto] = useState(false);
  const causasQuery = useQuery({ queryKey: ['motivos-nao-execucao', 'ativos'], queryFn: () => listarMotivosNaoExecucao({ ativo: true }) });

  const salvar = useMutation({
    mutationFn: (planoId?: string) =>
      classificarOcorrencia(ocorrencia.id, {
        justificada,
        causa_uuid: causa || null,
        comentario: comentario.trim() || null,
        plano_acao_uuid: planoId ?? atual?.plano_acao?.id ?? null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['xp'] });
      onFechar();
    },
  });

  return (
    <>
      <Dialog open={!planoAberto} onClose={onFechar} fullWidth maxWidth="sm">
        <DialogTitle>
          {ocorrencia.rotulo} · {ocorrencia.loja?.fantasia ?? '—'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <Alert severity="info" variant="outlined">
            {ocorrencia.xp.toLocaleString('pt-BR')} XP ficaram pra trás em {dataCurta(ocorrencia.dia)} e o número não muda. Classificar
            registra o que aconteceu, pra o painel mostrar onde a operação mais perde.
          </Alert>
          {salvar.error && <Alert severity="error">Não foi possível salvar a classificação.</Alert>}
          <ToggleButtonGroup exclusive size="small" value={justificada ? 'sim' : 'nao'} onChange={(_, v) => v && setJustificada(v === 'sim')}>
            <ToggleButton value="nao">Não justificada</ToggleButton>
            <ToggleButton value="sim">Justificada</ToggleButton>
          </ToggleButtonGroup>
          <TextField select size="small" label="Causa" value={causa} onChange={(e) => setCausa(e.target.value)} helperText="Cadastro de motivos de não execução">
            <MenuItem value="">Sem causa definida</MenuItem>
            {(causasQuery.data?.motivos_nao_execucao ?? []).map((m) => (
              <MenuItem key={m.id} value={m.id}>
                {m.descricao}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Comentário" multiline minRows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPlanoAberto(true)} sx={{ mr: 'auto' }}>
            Gerar plano de ação
          </Button>
          <Button onClick={onFechar}>Cancelar</Button>
          <Button variant="contained" disabled={salvar.isPending} onClick={() => salvar.mutate(undefined)}>
            Salvar
          </Button>
        </DialogActions>
      </Dialog>
      <NovoPlanoAcaoDialog
        open={planoAberto}
        sugestao={{
          titulo: `${ocorrencia.rotulo} — ${ocorrencia.loja?.fantasia ?? 'loja'}`,
          descricao: comentario || null,
          pontoVendaUuid: ocorrencia.loja?.id ?? null,
        }}
        onCriado={(planoId) => salvar.mutate(planoId)}
        onClose={() => setPlanoAberto(false)}
      />
    </>
  );
}

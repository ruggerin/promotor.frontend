import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { buscarAcompanhamento, encerrarAcompanhamento, ROTULO_SITUACAO, type RegistroDaLinhaDoTempo } from '../../lib/api/acompanhamentos';
import { AutenticatedImage } from '../fotos/AutenticatedImage';

// Linha do tempo do "ainda está lá?" (docs/83 §3.4): registro original, cada resposta e o que foi
// coletado nela, com as fotos lado a lado pra comparar a evolução. Gestor encerra daqui.

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—');

export function corDaSituacao(situacao: string): 'success' | 'default' | 'warning' | 'info' {
  if (situacao === 'ABERTO') return 'info';
  if (situacao === 'EXPIRADO') return 'warning';
  return 'default';
}

export function AcompanhamentoDialog({ id, onFechar }: { id: string; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['acompanhamento', id], queryFn: () => buscarAcompanhamento(id) });
  const encerrar = useMutation({
    mutationFn: () => encerrarAcompanhamento(id),
    onSuccess: (a) => {
      queryClient.setQueryData(['acompanhamento', id], a);
      void queryClient.invalidateQueries({ queryKey: ['acompanhamentos'] });
    },
  });
  const a = query.data;

  const rotuloResposta = (r: string) =>
    r === 'CONTINUA' ? (a?.rotulo_continua ?? 'Continua') : r === 'ACABOU' ? (a?.rotulo_acabou ?? 'Acabou') : 'Não conseguiu ver';

  return (
    <Dialog open onClose={onFechar} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        Acompanhamento {a?.formulario ? `· ${a.formulario.descricao}` : ''}
        {a && <Chip size="small" label={ROTULO_SITUACAO[a.situacao]} color={corDaSituacao(a.situacao)} />}
      </DialogTitle>
      <DialogContent dividers>
        {query.isLoading && <CircularProgress size={24} />}
        {query.isError && <Alert severity="error">Não foi possível carregar o acompanhamento.</Alert>}
        {a && (
          <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {a.loja?.fantasia} · aberto em {data(a.aberto_em)} · {a.dias_em_aberto} dia{a.dias_em_aberto === 1 ? '' : 's'}
              {a.situacao === 'ABERTO' ? ' em aberto' : ' de duração'}
              {a.situacao === 'ABERTO' && a.proxima_verificacao_em ? ` · próxima conferência ${data(a.proxima_verificacao_em)}` : ''}
              {a.encerrado_por ? ` · encerrado por ${a.encerrado_por}` : ''}
            </Typography>

            <Etapa titulo="Registro original" quando={a.origem?.criado_em ?? null} quem={a.origem?.usuario ?? null} registro={a.origem} destaque />
            {a.respostas.map((r) => (
              <Etapa
                key={r.id}
                titulo={rotuloResposta(r.resposta)}
                quando={r.respondido_em}
                quem={r.usuario}
                registro={r.registro}
                observacao={r.aplicada ? null : 'Chegou depois de já estar encerrado (resposta offline): fica só no histórico.'}
              />
            ))}
            {a.respostas.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                Ninguém conferiu ainda.
              </Typography>
            )}
            {encerrar.isError && (
              <Alert severity="error">
                {axios.isAxiosError<{ message?: string }>(encerrar.error) ? (encerrar.error.response?.data.message ?? 'Não foi possível encerrar.') : 'Não foi possível encerrar.'}
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Fechar</Button>
        {a?.situacao === 'ABERTO' && (
          <Button color="warning" variant="outlined" onClick={() => encerrar.mutate()} disabled={encerrar.isPending}>
            Encerrar acompanhamento
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Etapa({
  titulo,
  quando,
  quem,
  registro,
  destaque = false,
  observacao = null,
}: {
  titulo: string;
  quando: string | null;
  quem: string | null;
  registro: RegistroDaLinhaDoTempo | null;
  destaque?: boolean;
  observacao?: string | null;
}) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: '14px 1fr', gap: 1.5 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: destaque ? 'primary.main' : 'divider', mt: 0.5 }} />
        <Box sx={{ flex: 1, width: 2, bgcolor: 'divider', mt: 0.5 }} />
      </Box>
      <Box sx={{ minWidth: 0, pb: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {data(quando)}
          {quem ? ` · ${quem}` : ''}
          {registro?.formulario && !destaque ? ` · ${registro.formulario}` : ''}
        </Typography>
        {observacao && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block' }}>
            {observacao}
          </Typography>
        )}
        {registro && registro.campos_respondidos.length > 0 && (
          <Box sx={{ mt: 0.5, display: 'grid', gap: 0.25 }}>
            {registro.campos_respondidos
              .filter((c) => c.valor)
              .slice(0, 6)
              .map((c) => (
                <Typography key={c.chave} variant="caption" sx={{ display: 'block' }}>
                  <strong>{c.rotulo}:</strong> {c.valor}
                </Typography>
              ))}
          </Box>
        )}
        {registro && registro.imagens.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {registro.imagens.slice(0, 4).map((url) => (
              <AutenticatedImage key={url} url={url} alt="Foto do registro" sx={{ width: 140, height: 140, objectFit: 'cover', borderRadius: 1.5 }} />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { listarMotivosNaoExecucao } from '../../lib/api/motivosNaoExecucao';
import { atualizarOrdemServico, cancelarOrdensServicoEmLote } from '../../lib/api/ordensServico';
import { mensagemErro } from '../../pages/planosAcao/etapaForm';
import type { OrdemServico, ResponsavelNaoExecucao } from '../../types/api';

const OUTRO = '__outro__';

export const RESPONSAVEL_LABELS: Record<ResponsavelNaoExecucao, string> = {
  PROMOTOR: 'Promotor (faltou / não foi)',
  LOJA: 'Loja (fechada, sem acesso)',
  EMPRESA: 'Empresa (replanejamento, sem rota)',
  OUTRO: 'Outro',
};

// Cancelar visita planejada que não aconteceu (docs/59) — de propósito sem atalho: precisa dizer
// QUEM causou e POR QUÊ, e o cancelamento fica registrado (autor, data, motivo) e aparece nos
// relatórios. Vale pra uma OS ou pra várias com a mesma justificativa.
export function CancelarVisitasDialog({
  alvos,
  onClose,
}: {
  alvos: OrdemServico[];
  onClose: (cancelou: boolean) => void;
}) {
  return (
    <Dialog open={alvos.length > 0} onClose={() => onClose(false)} maxWidth="sm" fullWidth>
      {alvos.length > 0 && <Formulario alvos={alvos} onClose={onClose} />}
    </Dialog>
  );
}

function Formulario({ alvos, onClose }: { alvos: OrdemServico[]; onClose: (cancelou: boolean) => void }) {
  const queryClient = useQueryClient();
  const [responsavel, setResponsavel] = useState<ResponsavelNaoExecucao | ''>('');
  const [motivoUuid, setMotivoUuid] = useState('');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const motivosQuery = useQuery({
    queryKey: ['motivos-nao-execucao', { ativo: true }],
    queryFn: () => listarMotivosNaoExecucao({ ativo: true }),
  });
  const motivos = motivosQuery.data?.motivos_nao_execucao ?? [];

  // Catálogo vazio: já cai em "Outro", sem obrigar a abrir o select pra descobrir que não tem nada.
  useEffect(() => {
    if (!motivosQuery.isLoading && motivos.length === 0 && motivoUuid === '') setMotivoUuid(OUTRO);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motivosQuery.isLoading, motivos.length]);

  const precisaTexto = motivoUuid === OUTRO;
  const valido = responsavel !== '' && motivoUuid !== '' && (!precisaTexto || motivoTexto.trim() !== '');

  const mutation = useMutation({
    mutationFn: async () => {
      const justificativa = {
        responsavel_nao_execucao: responsavel as ResponsavelNaoExecucao,
        motivo_uuid: motivoUuid === OUTRO ? null : motivoUuid,
        motivo_texto: motivoTexto.trim() || null,
      };
      if (alvos.length === 1) {
        await atualizarOrdemServico(alvos[0].id, { status: 'CANCELADA', ...justificativa });
      } else {
        await cancelarOrdensServicoEmLote(alvos.map((a) => a.id), justificativa);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ordens-servico'] });
      void queryClient.invalidateQueries({ queryKey: ['visitas-nao-realizadas'] });
      void queryClient.invalidateQueries({ queryKey: ['operacao-do-dia'] });
      onClose(true);
    },
    onError: (err) => setErro(mensagemErro(err, 'Não foi possível cancelar.')),
  });

  return (
    <>
      <DialogTitle>{alvos.length === 1 ? 'Cancelar visita não realizada' : `Cancelar ${alvos.length} visitas não realizadas`}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {alvos.length === 1
            ? [alvos[0].ponto_venda?.fantasia, alvos[0].usuario?.nome ?? 'Fila aberta'].filter(Boolean).join(' · ')
            : 'A mesma justificativa vale para todas as visitas selecionadas.'}{' '}
          O cancelamento fica registrado (quem, quando e por quê) e aparece nos relatórios.
        </Typography>

        <TextField
          select
          required
          label="Quem causou a visita não acontecer?"
          fullWidth
          value={responsavel}
          onChange={(e) => setResponsavel(e.target.value as ResponsavelNaoExecucao)}
          sx={{ mb: 2 }}
        >
          {(Object.keys(RESPONSAVEL_LABELS) as ResponsavelNaoExecucao[]).map((r) => (
            <MenuItem key={r} value={r}>
              {RESPONSAVEL_LABELS[r]}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          required
          label="Motivo"
          fullWidth
          value={motivoUuid}
          onChange={(e) => setMotivoUuid(e.target.value)}
          disabled={motivosQuery.isLoading}
          sx={{ mb: 2 }}
        >
          {motivos.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.descricao}
            </MenuItem>
          ))}
          <MenuItem value={OUTRO}>Outro (digite abaixo)</MenuItem>
        </TextField>

        <TextField
          label={precisaTexto ? 'Descreva o motivo' : 'Detalhe (opcional)'}
          required={precisaTexto}
          fullWidth
          multiline
          minRows={2}
          value={motivoTexto}
          onChange={(e) => setMotivoTexto(e.target.value)}
        />

        {erro && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {erro}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose(false)}>Voltar</Button>
        <Button variant="contained" color="error" disabled={!valido || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Cancelando...' : 'Confirmar cancelamento'}
        </Button>
      </DialogActions>
    </>
  );
}

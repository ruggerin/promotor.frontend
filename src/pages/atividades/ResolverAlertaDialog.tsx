import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { mensagemErro } from '../planosAcao/etapaForm';
import { resolverAlerta } from '../../lib/api/atividades';
import { listarMotivosResolucaoAlerta } from '../../lib/api/motivosResolucaoAlerta';

const OUTRO = '__outro__';

// Contexto do alerta sendo resolvido — só pra exibir ao usuário o que ele está fechando.
export interface AlvoResolucao {
  visitaUuid: string;
  registroUuid: string;
  tipo?: string;
  produto?: string | null;
  pontoVenda?: string | null;
}

// Fechamento rápido de alerta com motivo (docs/56) — usado tanto no Painel de Atividades quanto
// na tela Registros. Motivo vem de um catálogo cadastrável por empresa (Parâmetros → Motivos de
// resolução) mais um texto livre, que complementa a escolha do catálogo ou a substitui quando
// nenhuma opção serve ("Outro").
export function ResolverAlertaDialog({ open, alvo, onClose }: { open: boolean; alvo: AlvoResolucao | null; onClose: () => void }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      {/* Só monta aberto: cada abertura começa com o formulário limpo. */}
      {open && alvo && <Formulario alvo={alvo} onClose={onClose} />}
    </Dialog>
  );
}

function Formulario({ alvo, onClose }: { alvo: AlvoResolucao; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [motivoUuid, setMotivoUuid] = useState('');
  const [motivoTexto, setMotivoTexto] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const motivosQuery = useQuery({
    queryKey: ['motivos-resolucao-alerta', { ativo: true }],
    queryFn: () => listarMotivosResolucaoAlerta({ ativo: true }),
  });
  const motivos = motivosQuery.data?.motivos_resolucao_alerta ?? [];

  // Catálogo vazio (empresa não cadastrou nenhum ainda) — já cai direto em "Outro", sem
  // obrigar a abrir o select pra descobrir que não tem opção nenhuma.
  useEffect(() => {
    if (!motivosQuery.isLoading && motivos.length === 0 && motivoUuid === '') {
      setMotivoUuid(OUTRO);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motivosQuery.isLoading, motivos.length]);

  const precisaTexto = motivoUuid === OUTRO;
  const valido = motivoUuid !== '' && (!precisaTexto || motivoTexto.trim() !== '');

  const mutation = useMutation({
    mutationFn: () =>
      resolverAlerta(alvo.visitaUuid, alvo.registroUuid, {
        motivo_uuid: motivoUuid === OUTRO ? null : motivoUuid,
        motivo_texto: motivoTexto.trim() || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['atividades'] });
      void queryClient.invalidateQueries({ queryKey: ['atividades-novidades'] });
      void queryClient.invalidateQueries({ queryKey: ['atividades-resumo'] });
      void queryClient.invalidateQueries({ queryKey: ['registros'] });
      onClose();
    },
    onError: (err) => setErro(mensagemErro(err, 'Não foi possível resolver o alerta.')),
  });

  return (
    <>
      <DialogTitle>Resolver alerta</DialogTitle>
      <DialogContent>
        {(alvo.tipo || alvo.produto || alvo.pontoVenda) && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {[alvo.tipo, alvo.produto, alvo.pontoVenda].filter(Boolean).join(' · ')}
          </Typography>
        )}

        <TextField
          select
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
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!valido || mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Resolvendo...' : 'Confirmar resolução'}
        </Button>
      </DialogActions>
    </>
  );
}

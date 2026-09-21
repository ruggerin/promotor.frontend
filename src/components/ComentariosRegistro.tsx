import ChatBubbleOutlinedIcon from '@mui/icons-material/ChatBubbleOutlined';
import SendIcon from '@mui/icons-material/Send';
import { Box, Button, Chip, CircularProgress, Collapse, IconButton, TextField, Typography } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { criarComentario, listarComentarios } from '../lib/api/comentarios';

/**
 * Feed de feedback de um registro de visita (docs/28 §3) — o gestor responde ali mesmo ("pedido
 * chega sexta") e o promotor vê no app. Recolhido por padrão; abrir busca o feed, e buscar já
 * marca como lido (apaga o badge do menu).
 */
export function ComentariosRegistro({
  visitaUuid,
  registroUuid,
  totalInicial = 0,
  novosIniciais = 0,
  abertoInicial = false,
}: {
  visitaUuid: string;
  registroUuid: string;
  /** Contagem que já veio com o registro (`comentarios_count`) — mostrada antes de abrir o feed. */
  totalInicial?: number;
  /** Quantos desses são novos pra quem está olhando (`comentarios_novos`). */
  novosIniciais?: number;
  /** Já nasce com o feed aberto — usado dentro do agrupamento da visita, pros registros com conversa. */
  abertoInicial?: boolean;
}) {
  const queryClient = useQueryClient();
  const [aberto, setAberto] = useState(abertoInicial);
  const [texto, setTexto] = useState('');

  const query = useQuery({
    queryKey: ['comentarios', registroUuid],
    // Buscar o feed já marca como lido no backend — só depois disso o badge do menu pode recarregar.
    queryFn: async () => {
      const comentarios = await listarComentarios(visitaUuid, registroUuid);
      void queryClient.invalidateQueries({ queryKey: ['comentarios-nao-lidos'] });
      return comentarios;
    },
    enabled: aberto,
  });

  const enviar = useMutation({
    mutationFn: () => criarComentario(visitaUuid, registroUuid, texto.trim()),
    onSuccess: () => {
      setTexto('');
      void queryClient.invalidateQueries({ queryKey: ['comentarios', registroUuid] });
      void queryClient.invalidateQueries({ queryKey: ['comentarios-nao-lidos'] });
      // O Painel de Atividades só mostra o indicador "N comentários" — acompanha o que se escreve aqui.
      void queryClient.invalidateQueries({ queryKey: ['atividades'] });
    },
  });

  // Estilo Facebook: fechado, o botão já diz quantos comentários tem (e quantos são novos pra
  // mim), sem abrir o feed — a tela fica limpa até alguém querer ler. Aberto o feed, vale a
  // contagem real dele (e os "novos" somem: buscar o feed já marca como lido).
  const total = query.data?.length ?? totalInicial;
  const novos = query.data ? 0 : novosIniciais;
  const rotulo = aberto ? 'Ocultar comentários' : total === 0 ? 'Comentar' : `${total} ${total === 1 ? 'comentário' : 'comentários'}`;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Button
        size="small"
        startIcon={<ChatBubbleOutlinedIcon fontSize="small" />}
        onClick={() => setAberto((a) => !a)}
      >
        {rotulo}
        {!aberto && novos > 0 && (
          <Chip label={`${novos} ${novos === 1 ? 'novo' : 'novos'}`} color="primary" size="small" sx={{ ml: 1, height: 18, fontSize: 11 }} />
        )}
      </Button>

      <Collapse in={aberto} unmountOnExit>
        <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {query.isLoading && <CircularProgress size={18} />}
          {query.data?.length === 0 && (
            <Typography variant="caption" color="text.secondary">
              Nenhum comentário ainda.
            </Typography>
          )}
          {query.data?.map((c) => (
            <Box
              key={c.id}
              sx={{
                alignSelf: c.meu ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                px: 1.25,
                py: 0.75,
                borderRadius: 2,
                bgcolor: c.meu ? 'primary.main' : 'action.hover',
                color: c.meu ? 'primary.contrastText' : 'text.primary',
              }}
            >
              <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, opacity: 0.85 }}>
                {c.autor.nome} · {new Date(c.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {c.texto}
              </Typography>
            </Box>
          ))}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'flex-end' }}>
            <TextField
              size="small"
              fullWidth
              multiline
              maxRows={4}
              placeholder="Escreva uma resposta…"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
            <IconButton
              color="primary"
              aria-label="Enviar comentário"
              disabled={!texto.trim() || enviar.isPending}
              onClick={() => enviar.mutate()}
            >
              <SendIcon />
            </IconButton>
          </Box>
          {enviar.isError && (
            <Typography variant="caption" color="error">
              Não foi possível enviar. Tente de novo.
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  );
}

import CloseIcon from '@mui/icons-material/Close';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Skeleton, Stack, Typography } from '@mui/material';
import { useEffect, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api/client';
import type { CampoRespondido, VisitaRegistro } from '../../types/api';
import { ComentariosRegistro } from '../ComentariosRegistro';
import { AcompanhamentoDialog } from '../acompanhamentos/AcompanhamentoDialog';
import { listarAcompanhamentos, ROTULO_SITUACAO } from '../../lib/api/acompanhamentos';
import { descricaoDoVinculo } from '../../lib/vinculoRegistro';

// Detalhe de UM registro (fotos, campos respondidos, observação e conversa) — usado na tela da
// visita e na lista de Registros, pra abrir o registro sem sair da tela.

/**
 * A rota de imagem exige Authorization: Bearer — uma <img src> comum não manda esse header,
 * então baixamos via Axios (que já injeta o token pelo interceptor) e criamos uma blob URL.
 */
export function ImagemBlob({ url, alt, tamanho = 160 }: { url: string; alt: string; tamanho?: number }) {
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
    return <Skeleton variant="rectangular" width={tamanho} height={tamanho} sx={{ borderRadius: 1.5, flexShrink: 0 }} />;
  }

  return (
    <Box
      component="img"
      src={blobUrl}
      alt={alt}
      sx={{ width: tamanho, height: tamanho, objectFit: 'cover', borderRadius: 1.5, flexShrink: 0 }}
    />
  );
}

// Rótulo → valor formatado, já resolvido pelo backend (App\Support\FormatadorValoresCampos) —
// SORTIMENTO vem à parte (presentes/ausentes com nome do produto, não uuid cru).
export function CamposRespondidos({ campos }: { campos: CampoRespondido[] }) {
  if (campos.length === 0) return null;

  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, overflow: 'hidden' }}>
      {campos.map((campo, i) => (
        <Box
          key={campo.chave}
          sx={{
            p: 1.25,
            borderTop: i > 0 ? '1px solid' : 'none',
            borderColor: 'divider',
          }}
        >
          {campo.tipo_campo === 'SORTIMENTO' ? (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {campo.rotulo}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {campo.sortimento?.presentes.map((p) => (
                  <Chip
                    key={p.id}
                    // Adicionado pelo promotor de fora do mix da loja (docs/79 decisão 8).
                    label={p.fora_do_mix ? `${p.descricao} · fora do mix` : p.descricao}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={p.fora_do_mix ? { borderStyle: 'dashed' } : undefined}
                  />
                ))}
                {campo.sortimento?.ausentes.map((p) => (
                  <Chip key={p.id} label={p.descricao} size="small" color="error" variant="outlined" />
                ))}
                {(campo.sortimento?.presentes.length ?? 0) === 0 && (campo.sortimento?.ausentes.length ?? 0) === 0 && (
                  <Typography variant="body2" color="text.secondary">Nenhum produto respondido.</Typography>
                )}
              </Box>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">{campo.rotulo}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'right' }}>{campo.valor}</Typography>
            </Box>
          )}
        </Box>
      ))}
    </Box>
  );
}

export function tituloRegistro(registro: VisitaRegistro): string {
  const vinculo = descricaoDoVinculo(registro);
  return registro.produto_auditoria?.descricao ?? vinculo ?? registro.tipo_registro.descricao;
}


export function RegistroDetalheDialog({
  registro,
  visitaUuid,
  onClose,
  acoes,
  statusAlerta,
}: {
  registro: VisitaRegistro | null;
  visitaUuid: string;
  onClose: () => void;
  // Botões do rodapé (ex.: Resolver, Abrir plano) — quem abre o diálogo decide o que oferecer.
  acoes?: ReactNode;
  // Só pra tipo "alerta": mostra se ainda pede ação ou já foi resolvido.
  statusAlerta?: { aberto: boolean; motivo?: string | null } | null;
}) {
  if (!registro) return null;
  const vinculo = descricaoDoVinculo(registro);

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{tituloRegistro(registro)}</Typography>
          {tituloRegistro(registro) !== registro.tipo_registro.descricao && (
            <Typography variant="body2" color="text.secondary">{registro.tipo_registro.descricao}</Typography>
          )}
        </Box>
        <IconButton aria-label="Fechar" onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {registro.imagens.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
              {registro.imagens.map((img) => (
                <ImagemBlob key={img.id} url={img.url} alt={tituloRegistro(registro)} tamanho={220} />
              ))}
            </Box>
          ) : (
            <Box
              sx={{
                height: 140,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
              }}
            >
              <ImageOutlinedIcon sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" color="text.secondary">Sem foto</Typography>
            </Box>
          )}

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {registro.ruptura && <Chip label="Ruptura" color="error" size="small" />}
            {registro.pontuacao !== null && <Chip label={`${registro.pontuacao}% compliance`} color="warning" size="small" variant="outlined" />}
            {statusAlerta && (
              <Chip
                size="small"
                color={statusAlerta.aberto ? 'warning' : 'success'}
                label={statusAlerta.aberto ? 'Pede ação' : `Resolvido${statusAlerta.motivo ? ` — ${statusAlerta.motivo}` : ''}`}
              />
            )}
          </Box>

          {vinculo && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">Vínculo</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{vinculo}</Typography>
            </Box>
          )}

          <AcompanhamentoDoRegistro registroId={registro.id} />

          <CamposRespondidos campos={registro.campos_respondidos} />

          {registro.observacao && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.4 }}>
                Observação
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>{registro.observacao}</Typography>
            </Box>
          )}

          <ComentariosRegistro
            visitaUuid={visitaUuid}
            registroUuid={registro.id}
            totalInicial={registro.comentarios_count}
            novosIniciais={registro.comentarios_novos}
          />
        </Stack>
      </DialogContent>
      {acoes && <DialogActions sx={{ px: 3, py: 1.5, gap: 1, flexWrap: 'wrap' }}>{acoes}</DialogActions>}
    </Dialog>
  );
}

/** Registro que abriu um "ainda está lá?" (docs/83): situação e atalho pra linha do tempo. */
function AcompanhamentoDoRegistro({ registroId }: { registroId: string }) {
  const [aberto, setAberto] = useState(false);
  const query = useQuery({
    queryKey: ['acompanhamentos', { registro_uuid: registroId }],
    queryFn: () => listarAcompanhamentos({ registro_uuid: registroId }),
    retry: false,
  });
  const acompanhamento = query.data?.acompanhamentos[0];
  if (!acompanhamento) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, p: 1.25, borderRadius: 1.5, bgcolor: 'action.hover' }}>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Acompanhamento · {ROTULO_SITUACAO[acompanhamento.situacao]}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {acompanhamento.respostas_count} conferência{acompanhamento.respostas_count === 1 ? '' : 's'} · {acompanhamento.dias_em_aberto} dia
          {acompanhamento.dias_em_aberto === 1 ? '' : 's'}
        </Typography>
      </Box>
      <Button size="small" onClick={() => setAberto(true)}>
        Ver linha do tempo
      </Button>
      {aberto && <AcompanhamentoDialog id={acompanhamento.id} onFechar={() => setAberto(false)} />}
    </Box>
  );
}

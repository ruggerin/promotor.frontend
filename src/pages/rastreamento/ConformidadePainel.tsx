import { Alert, Box, Chip, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import { buscarConformidadeRastreamento } from '../../lib/api/localizacoes';
import { MOTIVO_RASTREAMENTO } from './motivosRastreamento';

// Lista "Rastreamento irregular" do Mapa ao vivo — docs/47-RASTREAMENTO-EXIGENCIA.md §5.4. Só
// aparece com RASTREAMENTO_PAINEL_CONFORMIDADE ligado; fora da jornada ninguém é cobrado.

const EXIGENCIA: Record<string, string> = { OPCIONAL: 'Opcional', AVISO: 'Aviso', OBRIGATORIO: 'Obrigatório' };

function haQuanto(iso: string | null): string {
  if (!iso) return '';
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return horas < 24 ? `há ${horas}h${String(minutos % 60).padStart(2, '0')}` : `há ${Math.floor(horas / 24)}d`;
}

export function ConformidadePainel({
  intervaloMs,
  comPosicao,
  onFocar,
}: {
  intervaloMs: number;
  /** ids de quem tem pino no mapa — só esses são clicáveis. */
  comPosicao: Set<string>;
  onFocar: (id: string) => void;
}) {
  const query = useQuery({
    queryKey: ['localizacoes', 'conformidade'],
    queryFn: buscarConformidadeRastreamento,
    refetchInterval: intervaloMs,
  });
  const dados = query.data;
  if (!dados?.habilitado) return null;

  return (
    <Paper variant="outlined" sx={{ mt: 2 }}>
      <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Rastreamento irregular
        </Typography>
        <Chip size="small" variant="outlined" label={`Exigência: ${EXIGENCIA[dados.exigencia] ?? dados.exigencia}`} />
        {dados.jornada && <Chip size="small" variant="outlined" label={`Jornada ${dados.jornada.inicio}–${dados.jornada.fim}`} />}
        <Chip
          size="small"
          color={dados.irregulares.length > 0 ? 'error' : 'success'}
          label={dados.irregulares.length > 0 ? `${dados.irregulares.length} irregular${dados.irregulares.length === 1 ? '' : 'es'}` : 'Todos em dia'}
        />
      </Box>
      {!dados.dentro_da_jornada ? (
        <Alert severity="info" sx={{ m: 1.5 }}>
          Fora da jornada — ninguém é cobrado agora.
        </Alert>
      ) : dados.irregulares.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 1.5 }}>
          Todos os promotores estão compartilhando a localização.
        </Typography>
      ) : (
        <List dense disablePadding>
          {dados.irregulares.map((p) => (
            <ListItemButton
              key={p.id}
              sx={{ gap: 1.25 }}
              disabled={!comPosicao.has(p.id)}
              onClick={() => onFocar(p.id)}
              title={comPosicao.has(p.id) ? 'Ver a última posição no mapa' : 'Sem posição pra mostrar no mapa'}
            >
              <UsuarioAvatar nome={p.nome} fotoUrl={p.foto_url} size={28} />
              <ListItemText
                primary={p.nome}
                secondary={[
                  MOTIVO_RASTREAMENTO[p.motivo] ?? p.motivo,
                  p.motivo === 'SEM_SINAL'
                    ? p.ultima_localizacao_em
                      ? `última posição ${haQuanto(p.ultima_localizacao_em)}`
                      : 'nunca enviou posição'
                    : haQuanto(p.desde),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            </ListItemButton>
          ))}
        </List>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 1.5, pb: 1.25 }}>
        “Sem sinal” = o app diz que está ativo, mas não chega posição há mais de {dados.tolerancia_sem_sinal_minutos} min
        (economia de bateria do celular ou app fechado à força).
      </Typography>
    </Paper>
  );
}

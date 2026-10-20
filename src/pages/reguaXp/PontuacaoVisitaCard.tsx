import EmojiEventsIcon from '@mui/icons-material/EmojiEventsOutlined';
import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { buscarPontuacaoVisita } from '../../lib/api/xp';
import { ClasseLojaChip } from './ClasseLojaChip';

/**
 * Pontuação da visita na régua de XP (docs/88 §12.2.1), vista pelo gestor: cada parte com o que
 * contou e o motivo do que faltou, a iniciativa e os ajustes. Some quando a visita não é de OS.
 */
export function PontuacaoVisitaCard({ visitaId, cardSx }: { visitaId: string; cardSx: object }) {
  const query = useQuery({ queryKey: ['xp', 'visita', visitaId], queryFn: () => buscarPontuacaoVisita(visitaId) });
  const p = query.data;
  if (!p || p.fora_da_agenda || p.possivel === 0) return null;

  return (
    <Paper variant="outlined" sx={cardSx}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5 }}>
        <EmojiEventsIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flexGrow: 1 }}>
          Régua de XP
        </Typography>
        <ClasseLojaChip classe={p.classe} />
      </Box>
      <Box sx={{ px: 2, pb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {p.total.toLocaleString('pt-BR')} de {p.possivel.toLocaleString('pt-BR')} XP
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {p.faltou > 0 ? `${p.faltou} XP ficaram pra trás.` : 'Visita perfeita.'}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1.5 }}>
          {p.partes.map((parte) => (
            <Box key={parte.parte}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">{parte.rotulo}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {parte.ganho}/{parte.maximo}
                  {parte.pendente > 0 ? ` (+${parte.pendente} em avaliação)` : ''}
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={parte.maximo ? (parte.ganho / parte.maximo) * 100 : 0}
                color={parte.ganho === parte.maximo ? 'success' : 'warning'}
                sx={{ height: 4, borderRadius: 2, my: 0.25 }}
              />
              <Typography variant="caption" color="text.secondary">
                {parte.explicacao}
              </Typography>
            </Box>
          ))}
        </Box>
        {p.iniciativas.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Iniciativa
            </Typography>
            {p.iniciativas.map((i, idx) => (
              <Typography key={idx} variant="caption" component="div">
                {i.descricao}: {i.situacao === 'ok' ? `+${i.pontos} XP` : i.situacao === 'pendente' ? `+${i.pontos} XP aguardando avaliação` : i.situacao === 'reprovado' ? 'reprovado' : i.situacao === 'teto' ? 'passou do teto da visita' : 'repetido no período'}
              </Typography>
            ))}
          </Box>
        )}
        {p.ajustes.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Ajustes
            </Typography>
            {p.ajustes.map((a, idx) => (
              <Typography key={idx} variant="caption" component="div">
                {a.pontos > 0 ? '+' : ''}
                {a.pontos} XP · {a.motivo}
                {a.por ? ` (${a.por})` : ''}
              </Typography>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

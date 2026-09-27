import { Badge, Box, Link as MuiLink, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { UsuarioAvatar } from '../../components/UsuarioAvatar';
import type { ResumoAtividades } from '../../lib/api/atividades';
import { corDaPessoa, formatarHora, haQuanto } from './feedUtil';

// Coluna lateral do Painel de Atividades — "Em loja agora" e "Precisa de você", do protótipo
// "Painel de atividades— revisão de UX.html" (v2). Ver docs/43-REVISAO-UX-PAINEL-ATIVIDADES.md §5 fase 3.

function Bloco({ titulo, contador, children }: { titulo: string; contador?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: '#fff', border: '1px solid #e7e5f0', borderRadius: 1.5, p: 2, display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography sx={{ fontSize: 15, fontWeight: 600 }}>{titulo}</Typography>
        {contador}
      </Box>
      {children}
    </Box>
  );
}

export function ColunaLateral({
  resumo,
  onAbrirAlerta,
}: {
  resumo: ResumoAtividades | undefined;
  onAbrirAlerta: (registroId: string, visitaId: string) => void;
}) {
  const emLoja = resumo?.em_loja ?? [];
  const alertas = resumo?.alertas;
  const respostas = resumo?.respostas_novas ?? 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Bloco
        titulo="Em loja agora"
        contador={
          resumo && (
            <Typography sx={{ fontSize: 13, color: '#15803d', fontWeight: 600 }}>
              {emLoja.length} de {resumo.total_promotores}
            </Typography>
          )
        }
      >
        {emLoja.length === 0 ? (
          <Typography sx={{ fontSize: 13, color: '#5b5873' }}>Ninguém em loja neste momento.</Typography>
        ) : (
          emLoja.map((p) => (
            <MuiLink
              key={p.visita_id}
              component={RouterLink}
              to={`/visitas/${p.visita_id}`}
              underline="none"
              color="inherit"
              sx={{ display: 'flex', gap: 1.25, alignItems: 'center', borderRadius: 1, '&:hover': { bgcolor: '#f7f6fb' } }}
            >
              <Badge
                overlap="circular"
                variant="dot"
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                sx={{ '& .MuiBadge-dot': { bgcolor: '#16a34a', border: '2px solid #fff', width: 12, height: 12, borderRadius: '50%' } }}
              >
                <UsuarioAvatar nome={p.usuario?.nome ?? '?'} fotoUrl={p.usuario?.foto_url} size={38} cor={corDaPessoa(p.usuario?.id)} />
              </Badge>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 14, fontWeight: 500 }} noWrap>
                  {p.usuario?.nome ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#5b5873' }} noWrap>
                  {p.ponto_venda?.fantasia ?? '—'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: '#5b5873', flexShrink: 0 }}>{haQuanto(p.desde)}</Typography>
            </MuiLink>
          ))
        )}
      </Bloco>

      <Bloco
        titulo="Precisa de você"
        contador={
          alertas && alertas.total + respostas > 0 ? (
            <Box component="span" sx={{ fontSize: 12, fontWeight: 700, px: 1, py: 0.25, borderRadius: 99, bgcolor: '#fdeeee', color: '#b91c1c' }}>
              {alertas.total + respostas}
            </Box>
          ) : null
        }
      >
        {alertas && alertas.itens.length === 0 && respostas === 0 && (
          <Typography sx={{ fontSize: 13, color: '#5b5873' }}>Tudo em dia por aqui.</Typography>
        )}
        {alertas?.itens.map((a) => (
          <Box
            key={a.registro_id}
            component="button"
            type="button"
            onClick={() => onAbrirAlerta(a.registro_id, a.visita_id)}
            sx={{
              all: 'unset',
              boxSizing: 'border-box',
              width: '100%',
              cursor: 'pointer',
              display: 'flex',
              gap: 1.25,
              alignItems: 'center',
              px: 1.5,
              py: 1.25,
              borderRadius: 1.25,
              bgcolor: '#fbf7f7',
              '&:hover': { bgcolor: '#f6ecec' },
            }}
          >
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#dc2626', flexShrink: 0 }} />
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600 }} noWrap>
                {a.tipo}
                {a.produto ? ` · ${a.produto}` : ''}
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#5b5873' }} noWrap>
                {a.ponto_venda ?? '—'} · {formatarHora(a.ocorrido_em)}
              </Typography>
            </Box>
          </Box>
        ))}
        {alertas && alertas.total > alertas.itens.length && (
          <Typography sx={{ fontSize: 13, color: '#5b5873' }}>+ {alertas.total - alertas.itens.length} alertas sem tratativa</Typography>
        )}
        {respostas > 0 && (
          <Typography sx={{ fontSize: 13, color: '#5b5873', pt: 0.25 }}>
            + {respostas} {respostas === 1 ? 'resposta nova' : 'respostas novas'} de promotor
          </Typography>
        )}
        <Typography sx={{ fontSize: 11.5, color: '#8a87a3', pt: 0.25 }}>
          Alerta com plano de ação em andamento sai daqui — ele já está em Planos de Ação.
        </Typography>
      </Bloco>
    </Box>
  );
}

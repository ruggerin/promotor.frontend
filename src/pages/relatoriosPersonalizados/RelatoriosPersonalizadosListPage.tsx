import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import QueryStatsIcon from '@mui/icons-material/QueryStatsOutlined';
import { Alert, Box, Button, ButtonBase, Chip, CircularProgress, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { listarRelatoriosPersonalizados, type RelatorioPersonalizado } from '../../lib/api/relatoriosPersonalizados';
import { useAuth } from '../../lib/auth/AuthContext';
import { horus } from '../../theme';
import { FixarNoMenuButton } from './FixarNoMenuButton';
import { ENTIDADE_LABELS, PRESET_LABELS } from './formatacao';

/**
 * Lista do gerador de relatórios (docs/60 §7): padrão do sistema (semeados em todo cliente), os da
 * empresa (compartilhados) e os meus. "Novo relatório" abre o editor (RelatorioEditorPage).
 */
export function RelatoriosPersonalizadosListPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const podeCriar = usuario?.user_type === 'ADMIN' || (usuario?.perfil?.permissoes ?? []).includes('relatorios.personalizados.gerenciar');
  const cabecalho = usePageHeader(
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <TituloComAtualizar titulo="Relatórios" />
      </Box>
      {podeCriar && (
        <Button variant="contained" endIcon={<AddIcon />} onClick={() => navigate('/relatorios-personalizados/novo')}>
          Novo relatório
        </Button>
      )}
    </Box>,
  );

  const query = useQuery({
    queryKey: ['relatorios-personalizados'],
    queryFn: listarRelatoriosPersonalizados,
  });
  const relatorios = query.data ?? [];

  const grupos: { titulo: string; itens: RelatorioPersonalizado[] }[] = [
    { titulo: 'Padrão do sistema', itens: relatorios.filter((r) => r.padrao) },
    {
      titulo: 'Da empresa',
      itens: relatorios.filter((r) => !r.padrao && r.compartilhado && r.criador?.id !== usuario?.id),
    },
    {
      titulo: 'Meus relatórios',
      itens: relatorios.filter((r) => !r.padrao && r.criador?.id === usuario?.id),
    },
  ].filter((g) => g.itens.length > 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {cabecalho}
      {query.isLoading && <CircularProgress size={24} />}
      {query.isError && <Alert severity="error">Não foi possível carregar os relatórios. Tente atualizar a página.</Alert>}
      {query.isSuccess && relatorios.length === 0 && (
        <Alert severity="info">Nenhum relatório disponível ainda. Peça ao suporte para completar os relatórios padrão.</Alert>
      )}

      {grupos.map((grupo) => (
        <Paper key={grupo.titulo} sx={{ p: { xs: 1.75, md: 2.5 } }}>
          <Typography component="h2" sx={{ fontSize: 15, fontWeight: 600, mb: 1.5 }}>
            {grupo.titulo}{' '}
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>
              ({grupo.itens.length})
            </Box>
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            {grupo.itens.map((r, i) => (
              <Box
                key={r.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  borderTop: i === 0 ? 0 : `1px solid ${horus.borda}`,
                }}
              >
                <ButtonBase
                  onClick={() => navigate(`/relatorios-personalizados/${r.id}`)}
                  sx={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    textAlign: 'left',
                    px: 1,
                    py: 1.25,
                    borderRadius: '6px',
                    '&:hover': { bgcolor: horus.subcard },
                  }}
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '6px',
                      bgcolor: horus.indigoClaro,
                      color: horus.indigo,
                      display: 'grid',
                      placeItems: 'center',
                      flex: 'none',
                    }}
                  >
                    <QueryStatsIcon sx={{ fontSize: 18 }} />
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 500 }}>
                      {r.nome}
                    </Typography>
                    <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
                      {[
                        ENTIDADE_LABELS[r.entidade] ?? r.entidade,
                        r.definicao.periodo.preset ? PRESET_LABELS[r.definicao.periodo.preset] : 'Período fixo',
                        r.descricao,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Typography>
                  </Box>
                  {r.padrao && <Chip label="Padrão" size="small" color="primary" />}
                  {!r.padrao && r.compartilhado && <Chip label="Compartilhado" size="small" />}
                  <ChevronRightIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
                </ButtonBase>
                <FixarNoMenuButton relatorio={r} tamanho="small" />
              </Box>
            ))}
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

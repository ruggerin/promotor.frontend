import GavelIcon from '@mui/icons-material/GavelOutlined';
import { Box, Chip, CircularProgress, Link, Paper, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { listarAceitesUsuario, TITULO_DOCUMENTO, urlDocumento, versaoLegivel } from '../../lib/api/documentosLegais';
import type { Usuario } from '../../types/api';

// Bloco "Aceites" do usuário (docs/58 §7): qual versão dos Termos/Política ele aceitou, quando e
// por qual app — a prova pra empresa cliente. Cada linha abre o texto exato daquela versão.
export function AceitesPanel({ usuario }: { usuario: Usuario }) {
  const query = useQuery({
    queryKey: ['usuarios', usuario.id, 'aceites'],
    queryFn: () => listarAceitesUsuario(usuario.id),
  });

  return (
    <Paper sx={{ mt: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            bgcolor: 'primary.light',
            color: 'primary.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <GavelIcon fontSize="small" />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontSize: 15 }}>
            Termos e privacidade
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Versões aceitas pelo usuário
          </Typography>
        </Box>
      </Box>

      <Box sx={{ px: 2.5, py: 2 }}>
        {query.isLoading ? (
          <CircularProgress size={22} />
        ) : query.isError ? (
          <Typography color="error">Não foi possível carregar os aceites.</Typography>
        ) : (query.data ?? []).length === 0 ? (
          <Typography color="text.secondary">
            Ainda não aceitou. Os Termos de Uso e a Política de Privacidade aparecem no próximo acesso ao Horus.
          </Typography>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {query.data!.map((a) => (
              <Box key={`${a.tipo}-${a.versao}`} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
                <Link href={urlDocumento(a.tipo, a.versao)} target="_blank" rel="noopener" underline="hover" sx={{ fontWeight: 500 }}>
                  {TITULO_DOCUMENTO[a.tipo]}
                </Link>
                <Typography variant="body2" color="text.secondary">
                  versão de {versaoLegivel(a.versao)} · aceito em{' '}
                  {new Date(a.aceito_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </Typography>
                {a.app && <Chip size="small" label={a.app === 'MOBILE' ? 'pelo app' : 'pelo admin'} />}
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Paper>
  );
}

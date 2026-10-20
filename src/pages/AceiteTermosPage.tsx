import CloseIcon from '@mui/icons-material/Close';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Drawer,
  FormControlLabel,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { LogoHorus } from '../components/LogoHorus';
import { aceitarDocumentos, buscarTextoDocumento, TITULO_DOCUMENTO, urlDocumento, versaoLegivel } from '../lib/api/documentosLegais';
import { TextoMarkdown } from '../components/TextoMarkdown';
import { useAuth } from '../lib/auth/AuthContext';
import type { DocumentoPendente, TipoDocumentoLegal } from '../types/api';

// Aceite dos Termos de Uso e da Política de Privacidade (docs/58 §7) — o RequireAuth manda pra cá
// enquanto houver versão vigente sem aceite (primeiro acesso ou texto atualizado). Um checkbox só,
// gravando um aceite por documento (§10, decisão 4). Quem não aceita não entra: "Sair".
export function AceiteTermosPage() {
  const { usuario, atualizarUsuario, logout } = useAuth();
  const queryClient = useQueryClient();
  const [concordo, setConcordo] = useState(false);
  const [aberto, setAberto] = useState<DocumentoPendente | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pendentes = usuario?.documentos_pendentes ?? [];

  const aceite = useMutation({
    mutationFn: () => aceitarDocumentos(pendentes),
    onSuccess: ({ usuario: atualizado }) => {
      atualizarUsuario(atualizado);
      void queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: async (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        // Publicaram versão nova com a tela aberta: recarrega as pendências e pede de novo.
        const pendentesAtuais = (err.response.data as { documentos_pendentes?: DocumentoPendente[] }).documentos_pendentes;
        if (usuario && pendentesAtuais) atualizarUsuario({ ...usuario, documentos_pendentes: pendentesAtuais });
        setConcordo(false);
        setErro('Os documentos acabaram de ser atualizados. Leia a versão atual e aceite de novo.');
        return;
      }
      setErro('Não foi possível registrar o aceite. Verifique a conexão e tente de novo.');
    },
  });

  if (pendentes.length === 0) {
    return <Navigate to="/" replace />;
  }

  const titulos = pendentes.map((d) => TITULO_DOCUMENTO[d.tipo]);
  const nomes = titulos.length > 1 ? `${titulos.slice(0, -1).join(', ')} e ${titulos.at(-1)}` : titulos[0];

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
      }}
    >
      <Paper sx={{ width: '100%', maxWidth: 520, p: { xs: 3, sm: 4 }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        <LogoHorus largura={120} />
        <Box>
          <Typography component="h1" variant="h5" sx={{ fontWeight: 600, mb: 0.75 }}>
            {nomes}
          </Typography>
          <Typography color="text.secondary">
            Para continuar usando o Horus, leia e aceite {pendentes.length > 1 ? 'os documentos abaixo' : 'o documento abaixo'}.
            Eles explicam as regras de uso e como tratamos os seus dados.
          </Typography>
        </Box>

        {erro && <Alert severity="warning">{erro}</Alert>}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {pendentes.map((d) => (
            <Button
              key={d.tipo}
              variant="outlined"
              onClick={() => setAberto(d)}
              startIcon={<DescriptionIcon />}
              sx={{ justifyContent: 'flex-start', py: 1.25, textAlign: 'left', height: 'auto', minHeight: 56 }}
            >
              <Box sx={{ flex: 1 }}>
                <Box component="span" sx={{ display: 'block', fontWeight: 500 }}>
                  {TITULO_DOCUMENTO[d.tipo]}
                </Box>
                <Box component="span" sx={{ display: 'block', fontSize: 12, color: 'text.secondary' }}>
                  Atualizado em {versaoLegivel(d.versao)} · toque para ler
                </Box>
              </Box>
            </Button>
          ))}
        </Box>

        <FormControlLabel
          control={<Checkbox checked={concordo} onChange={(e) => setConcordo(e.target.checked)} />}
          label={`Li e concordo com ${pendentes.length > 1 ? 'os' : 'o'} ${nomes}.`}
        />

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'flex-end' }}>
          <Button onClick={() => void logout()} disabled={aceite.isPending}>
            Sair
          </Button>
          <Button
            variant="contained"
            disabled={!concordo || aceite.isPending}
            onClick={() => {
              setErro(null);
              aceite.mutate();
            }}
          >
            {aceite.isPending ? 'Registrando…' : 'Continuar'}
          </Button>
        </Box>
      </Paper>

      <Drawer anchor="right" open={aberto !== null} onClose={() => setAberto(null)} slotProps={{ paper: { sx: { width: { xs: '100%', md: 760 } } } }}>
        {aberto && <LeituraDocumento documento={aberto} onFechar={() => setAberto(null)} />}
      </Drawer>
    </Box>
  );
}

function LeituraDocumento({ documento, onFechar }: { documento: DocumentoPendente; onFechar: () => void }) {
  const url = urlDocumento(documento.tipo as TipoDocumentoLegal, documento.versao);
  const texto = useQuery({
    queryKey: ['documentos-legais', documento.tipo, documento.versao],
    queryFn: () => buscarTextoDocumento(documento.tipo as TipoDocumentoLegal, documento.versao),
    staleTime: Infinity,
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
        <Typography sx={{ fontWeight: 600, flex: 1 }}>{TITULO_DOCUMENTO[documento.tipo]}</Typography>
        <Button size="small" href={url} target="_blank" rel="noopener" endIcon={<OpenInNewIcon fontSize="small" />}>
          Abrir em nova aba
        </Button>
        <IconButton aria-label="Fechar" onClick={onFechar}>
          <CloseIcon />
        </IconButton>
      </Box>
      {/* Texto renderizado aqui mesmo: a página pública não abre em iframe em produção. */}
      <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
        {texto.isLoading && <CircularProgress size={28} />}
        {texto.isError && (
          <Alert severity="warning">
            Não foi possível carregar o texto aqui. Use “Abrir em nova aba” para ler.
          </Alert>
        )}
        {texto.data && <TextoMarkdown conteudo={texto.data.conteudo} />}
      </Box>
    </Box>
  );
}

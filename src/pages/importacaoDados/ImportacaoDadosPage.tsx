import CategoryIcon from '@mui/icons-material/Category';
import LinkIcon from '@mui/icons-material/Link';
import StoreIcon from '@mui/icons-material/Store';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';
import { useState, type ReactNode } from 'react';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { useAuth } from '../../lib/auth/AuthContext';
import type { Permissao, Usuario } from '../../types/api';
import { ImportarDadosDialog } from './ImportarDadosDialog';
import { TIPOS_IMPORTACAO, type TipoImportacao } from './tiposImportacao';

const ICONES: Record<TipoImportacao['chave'], ReactNode> = {
  lojas: <StoreIcon color="primary" />,
  produtos: <CategoryIcon color="primary" />,
  sortimento: <LinkIcon color="primary" />,
};

// ADMIN sempre; GESTOR pela permissão do perfil (mesma regra do EnsurePermissao no backend).
function podeImportar(usuario: Usuario | null, permissao: Permissao): boolean {
  if (usuario?.user_type === 'ADMIN') return true;
  return usuario?.user_type === 'GESTOR' && (usuario.perfil?.permissoes ?? []).includes(permissao);
}

/**
 * Importação de Dados (docs/42-IMPORTACAO-DE-DADOS.md) — um lugar só pra subir planilha em vez de
 * cadastrar um por um: Lojas, Produtos e Vínculo Loja × Produto. Cada tipo aparece conforme a
 * permissão dele (Lojas/Vínculo: pontos_venda.gerenciar; Produtos: catalogo.gerenciar). Ordem
 * sugerida pra empresa nova: lojas e produtos primeiro, vínculo por último (ele usa os códigos dos
 * dois).
 */
export function ImportacaoDadosPage() {
  const { usuario } = useAuth();
  const [aberto, setAberto] = useState<TipoImportacao | null>(null);
  const tipos = TIPOS_IMPORTACAO.filter((t) => podeImportar(usuario, t.permissao));

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Importação de Dados
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Suba uma planilha (CSV) em vez de cadastrar um por um. O arquivo é validado inteiro antes de gravar — você vê o
        que vai ser criado ou atualizado, ou a lista de erros por linha. Empresa nova: importe lojas e produtos primeiro, e
        o vínculo loja × produto por último.
      </Typography>

      {tipos.length === 0 && (
        <Alert severity="info">Seu perfil não tem permissão pra importar lojas, produtos nem vínculos.</Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 2 }}>
        {tipos.map((t) => (
          <Paper key={t.chave} variant="outlined" sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {ICONES[t.chave]}
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {t.titulo}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {t.resumo}
            </Typography>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setAberto(t)} sx={{ alignSelf: 'flex-start' }}>
              Importar
            </Button>
          </Paper>
        ))}
      </Box>

      <ImportarDadosDialog tipo={aberto} onClose={() => setAberto(null)} />
    </Box>
  );
}

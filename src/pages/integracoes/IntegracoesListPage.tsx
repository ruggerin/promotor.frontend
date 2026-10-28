import AddIcon from '@mui/icons-material/Add';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import { listarIntegracoes, type Integracao, type IntegracaoComToken } from '../../lib/api/integracoes';
import { tempoDesde } from '../../lib/formatarData';
import { dataCurta, dataHoraCurta, diasAte, SituacaoChip } from './comum';
import { IntegracaoFormDialog } from './IntegracaoFormDialog';
import { TokenCriadoDialog } from './TokenCriadoDialog';

// docs/96 §8.1 — lista das integrações da empresa. Só ADMIN chega aqui (menu e API).

// Página pública servida pela API (sem login), pra repassar ao dev do ERP/BI do cliente.
const URL_DOCUMENTACAO = `${String(import.meta.env.VITE_API_URL ?? '').replace(/\/api\/?$/, '')}/docs/integracao`;

const MAX_CHIPS = 3;
const DIAS_SEM_USO = 90;

function textoUltimoUso(i: Integracao) {
  if (i.ultimo_uso_em) {
    return (
      <>
        há {tempoDesde(i.ultimo_uso_em)}
        <Typography variant="caption" component="div" color="text.secondary" sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
          {i.ultimo_ip}
        </Typography>
      </>
    );
  }
  const semUsoHaMuito = i.situacao !== 'revogada' && -diasAte(i.created_at) >= DIAS_SEM_USO;
  return (
    <Typography variant="body2" color="text.secondary">
      nunca usada
      {semUsoHaMuito && (
        <Typography variant="caption" component="div">
          criada há {-diasAte(i.created_at)} dias · ainda é usada?
        </Typography>
      )}
    </Typography>
  );
}

export function IntegracoesListPage() {
  const navigate = useNavigate();
  const [formAberto, setFormAberto] = useState(false);
  const [criada, setCriada] = useState<IntegracaoComToken | null>(null);
  const query = useQuery({ queryKey: ['integracoes'], queryFn: listarIntegracoes });
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Integrações" />);

  const vencendo = (query.data ?? []).filter((i) => i.situacao === 'vencendo' || i.situacao === 'vencida');

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'space-between', alignItems: 'flex-end', mb: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 640 }}>
          Tokens para o ERP enviar dados e o BI ler dados do Horus, sem usar a senha de ninguém. Cada token só acessa o que você liberar.
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<MenuBookOutlinedIcon />} href={URL_DOCUMENTACAO} target="_blank" rel="noopener">
            Documentação da API
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setFormAberto(true)}>
            Nova integração
          </Button>
        </Box>
      </Box>

      {vencendo.map((i) => (
        <Alert key={i.uuid} severity="warning" sx={{ mb: 2 }}>
          <strong>{i.nome}</strong>{' '}
          {i.situacao === 'vencida' ? 'está sem token válido.' : `vence em ${diasAte(i.validade!)} dia(s).`} Gere um novo token para a integração não parar.
        </Alert>
      ))}

      <TableContainer component={Paper}>
        <Table sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>Integração</TableCell>
              <TableCell>Permissões</TableCell>
              <TableCell>Último uso</TableCell>
              <TableCell>Validade</TableCell>
              <TableCell>Situação</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.isError && (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  <Typography color="error" variant="body2">
                    Não foi possível carregar as integrações. Só administradores têm acesso a esta tela.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {query.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Nenhuma integração ainda. Crie uma para conectar o BI ou o ERP do cliente.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {query.data?.map((i) => {
              const revogada = i.situacao === 'revogada';
              return (
                <TableRow key={i.uuid} hover sx={revogada ? { '& td': { color: 'text.secondary' } } : undefined}>
                  <TableCell>
                    <Link component={RouterLink} to={`/integracoes/${i.uuid}`} underline="hover" sx={{ fontWeight: 600, ...(revogada ? { textDecoration: 'line-through', color: 'text.secondary' } : {}) }}>
                      {i.nome}
                    </Link>
                    <Typography variant="caption" component="div" color="text.secondary">
                      {revogada ? (
                        <>
                          revogada por {i.revogada_por ?? '—'} em {dataCurta(i.revogada_em)}
                          {i.revogada_motivo ? ` · "${i.revogada_motivo}"` : ''}
                        </>
                      ) : (
                        <>
                          <Box component="span" sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                            {i.tokens[0]?.prefixo ?? 'sem token válido'}
                          </Box>
                          {i.criada_por ? ` · criada por ${i.criada_por}` : ''}
                        </>
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {i.escopos.slice(0, MAX_CHIPS).map((e) => (
                        <Chip key={e} size="small" label={e} color={revogada ? 'default' : 'primary'} variant="outlined" />
                      ))}
                      {i.escopos.length > MAX_CHIPS && <Chip size="small" label={`+${i.escopos.length - MAX_CHIPS}`} />}
                    </Box>
                  </TableCell>
                  <TableCell>{revogada ? dataHoraCurta(i.ultimo_uso_em) : textoUltimoUso(i)}</TableCell>
                  <TableCell sx={i.situacao === 'vencendo' ? { color: 'warning.dark', fontWeight: 500 } : undefined}>
                    {revogada ? '—' : i.validade ? `${dataCurta(i.validade)}${i.situacao === 'vencendo' ? ` · ${diasAte(i.validade)} dias` : ''}` : 'Sem validade'}
                  </TableCell>
                  <TableCell>
                    <SituacaoChip situacao={i.situacao} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>
        Só administradores veem e gerenciam esta tela. Integrações revogadas ficam na lista para auditoria.
      </Typography>

      <IntegracaoFormDialog open={formAberto} integracao={null} onClose={() => setFormAberto(false)} onCriada={setCriada} />
      <TokenCriadoDialog
        open={criada !== null}
        nome={criada?.integracao.nome ?? ''}
        token={criada?.token ?? null}
        onClose={() => {
          const uuid = criada?.integracao.uuid;
          setCriada(null);
          if (uuid) navigate(`/integracoes/${uuid}`);
        }}
      />
    </Box>
  );
}

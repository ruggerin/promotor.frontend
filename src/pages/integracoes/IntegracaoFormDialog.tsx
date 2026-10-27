import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  InputAdornment,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import {
  atualizarIntegracao,
  buscarCatalogoEscopos,
  criarIntegracao,
  type EscopoCatalogo,
  type Integracao,
  type IntegracaoComToken,
} from '../../lib/api/integracoes';
import { mensagemErro, rotuloValidade } from './comum';

// docs/96 §8.2 — criar (ou editar as permissões de) uma integração. Nada vem marcado: o ADMIN
// escolhe um perfil pronto ou marca recurso a recurso. Escopos de escrita aparecem "em breve".

type PerfilPronto = 'bi' | 'erp' | 'personalizado';

interface Props {
  open: boolean;
  /** null = nova integração. */
  integracao: Integracao | null;
  onClose: () => void;
  onCriada?: (resultado: IntegracaoComToken) => void;
}

interface LinhaRecurso {
  recurso: string;
  rotulo: string;
  descricao: string | null;
  ler?: EscopoCatalogo;
  escrever?: EscopoCatalogo;
}

function escoposDoPerfil(perfil: PerfilPronto, catalogo: EscopoCatalogo[]): string[] {
  const disponiveis = catalogo.filter((e) => e.disponivel);
  if (perfil === 'bi') return disponiveis.filter((e) => e.acao === 'ler').map((e) => e.valor);
  // ERP manda os cadastros e os pedidos: todas as escritas disponíveis (escrever não inclui ler).
  if (perfil === 'erp') return disponiveis.filter((e) => e.acao === 'escrever').map((e) => e.valor);
  return [];
}

export function IntegracaoFormDialog({ open, integracao, onClose, onCriada }: Props) {
  const edicao = integracao !== null;
  const queryClient = useQueryClient();
  const catalogoQuery = useQuery({ queryKey: ['integracoes', 'escopos'], queryFn: buscarCatalogoEscopos, staleTime: Infinity });
  const catalogo = useMemo(() => catalogoQuery.data?.escopos ?? [], [catalogoQuery.data]);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [perfil, setPerfil] = useState<PerfilPronto | null>(null);
  const [escopos, setEscopos] = useState<string[]>([]);
  const [validade, setValidade] = useState<number | null>(365);
  const [limite, setLimite] = useState('120');
  const [ips, setIps] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErro(null);
    setNome(integracao?.nome ?? '');
    setDescricao(integracao?.descricao ?? '');
    setEscopos(integracao?.escopos ?? []);
    setPerfil(integracao ? 'personalizado' : null);
    setValidade(365);
    setLimite(String(integracao?.limite_por_minuto ?? catalogoQuery.data?.limite_padrao ?? 120));
    setIps((integracao?.ips_permitidos ?? []).join(', '));
  }, [open, integracao, catalogoQuery.data?.limite_padrao]);

  const linhas = useMemo(() => {
    const porRecurso = new Map<string, LinhaRecurso>();
    for (const e of catalogo) {
      const linha = porRecurso.get(e.recurso) ?? { recurso: e.recurso, rotulo: e.rotulo, descricao: e.descricao };
      linha[e.acao] = e;
      porRecurso.set(e.recurso, linha);
    }
    return [...porRecurso.values()];
  }, [catalogo]);

  // Busca sem acento/maiúscula pelo nome, pela descrição e pelo escopo ("pedidos:escrever").
  const [busca, setBusca] = useState('');
  useEffect(() => {
    if (open) setBusca('');
  }, [open]);
  const linhasVisiveis = useMemo(() => {
    const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const termo = normalizar(busca.trim());
    if (!termo) return linhas;
    return linhas.filter((l) =>
      [l.rotulo, l.descricao ?? '', l.recurso, l.ler?.valor ?? '', l.escrever?.valor ?? ''].some((t) => normalizar(t).includes(termo)),
    );
  }, [linhas, busca]);

  function escolherPerfil(novo: PerfilPronto | null) {
    if (!novo) return;
    setPerfil(novo);
    if (novo !== 'personalizado') setEscopos(escoposDoPerfil(novo, catalogo));
  }

  function alternar(valor: string) {
    setPerfil('personalizado');
    setEscopos((atual) => (atual.includes(valor) ? atual.filter((v) => v !== valor) : [...atual, valor]));
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const comum = {
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        escopos,
        ips_permitidos: ips
          .split(/[\s,;]+/)
          .map((ip) => ip.trim())
          .filter(Boolean),
        limite_por_minuto: Number(limite),
      };
      if (edicao) {
        await atualizarIntegracao(integracao.uuid, comum);
        return null;
      }
      return criarIntegracao({ ...comum, validade_dias: validade });
    },
    onSuccess: (resultado) => {
      void queryClient.invalidateQueries({ queryKey: ['integracoes'] });
      onClose();
      if (resultado) onCriada?.(resultado);
    },
    onError: (err) => setErro(mensagemErro(err, 'Não foi possível salvar a integração.')),
  });

  const podeSalvar = nome.trim() !== '' && escopos.length > 0 && Number(limite) >= 1 && !mutation.isPending;

  function celula(escopo: EscopoCatalogo | undefined, rotuloRecurso: string, acao: string) {
    if (!escopo) {
      return (
        <Typography variant="body2" color="text.secondary" aria-hidden>
          —
        </Typography>
      );
    }
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Checkbox
          size="small"
          checked={escopos.includes(escopo.valor)}
          disabled={!escopo.disponivel}
          onChange={() => alternar(escopo.valor)}
          slotProps={{ input: { 'aria-label': `${rotuloRecurso}: ${acao}${escopo.disponivel ? '' : ' (em breve)'}` } }}
        />
        {!escopo.disponivel && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: -0.75 }}>
            em breve
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{edicao ? `Editar ${integracao.nome}` : 'Nova integração'}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2.5}>
          {erro && (
            <Alert severity="error" onClose={() => setErro(null)}>
              {erro}
            </Alert>
          )}
          <TextField
            label="Nome da integração"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            fullWidth
            slotProps={{ htmlInput: { maxLength: 100 } }}
            helperText='Aparece na auditoria. Use um token por sistema: "ERP Protheus", "Power BI".'
          />
          <TextField
            label="Descrição (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            fullWidth
            multiline
            minRows={2}
            placeholder="Para que serve e quem é o responsável no cliente"
          />

          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Permissões de acesso
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              O token só acessa o que estiver marcado. Nada vem marcado por padrão.
            </Typography>
            <ToggleButtonGroup exclusive size="small" color="primary" value={perfil} onChange={(_, v: PerfilPronto | null) => escolherPerfil(v)} aria-label="Perfil pronto" sx={{ mb: 1.5, flexWrap: 'wrap' }}>
              <ToggleButton value="bi">BI (só leitura)</ToggleButton>
              <ToggleButton value="erp">ERP (cadastros)</ToggleButton>
              <ToggleButton value="personalizado">Personalizado</ToggleButton>
            </ToggleButtonGroup>
            {perfil === 'erp' && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                O ERP grava lojas, produtos, mix, vendedores, promotores e pedidos. Escrever não dá leitura: se o ERP também precisa ler algo de volta, marque a coluna Ler.
              </Alert>
            )}
            <TextField
              size="small"
              fullWidth
              placeholder="Buscar recurso (ex.: pedidos, mix, fotos)"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              sx={{ mb: 1 }}
              slotProps={{
                htmlInput: { 'aria-label': 'Buscar recurso' },
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                },
              }}
            />
            {/* Rola só a grade, não o modal: os campos de baixo (validade, limite) ficam à vista. */}
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 340 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Recurso</TableCell>
                    <TableCell align="center" sx={{ width: 96 }}>
                      Ler
                    </TableCell>
                    <TableCell align="center" sx={{ width: 110 }}>
                      Escrever
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {linhasVisiveis.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Nenhum recurso com "{busca}".
                      </TableCell>
                    </TableRow>
                  )}
                  {linhasVisiveis.map((l) => (
                    <TableRow key={l.recurso}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {l.rotulo}
                        </Typography>
                        {l.descricao && (
                          <Typography variant="caption" color="text.secondary">
                            {l.descricao}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell align="center">{celula(l.ler, l.rotulo, 'ler')}</TableCell>
                      <TableCell align="center">{celula(l.escrever, l.rotulo, 'escrever')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
            {!edicao && (
              <TextField
                select
                label="Validade do token"
                value={validade === null ? 'sem' : String(validade)}
                onChange={(e) => setValidade(e.target.value === 'sem' ? null : Number(e.target.value))}
                helperText="Avisamos na lista 15 dias antes de vencer."
              >
                {(catalogoQuery.data?.validades ?? [30, 90, 180, 365]).map((d) => (
                  <MenuItem key={d} value={String(d)}>
                    {rotuloValidade(d)}
                  </MenuItem>
                ))}
                <MenuItem value="sem">Sem validade</MenuItem>
              </TextField>
            )}
            <TextField
              label="Limite por minuto"
              type="number"
              value={limite}
              onChange={(e) => setLimite(e.target.value)}
              slotProps={{ htmlInput: { min: 1, max: 1000 } }}
              helperText="Requisições por minuto desta integração."
            />
            <TextField
              label="IPs permitidos (opcional)"
              value={ips}
              onChange={(e) => setIps(e.target.value)}
              placeholder="ex.: 200.150.12.4, 52.67.0.0/16"
              helperText="Em branco: aceita de qualquer IP."
              sx={{ gridColumn: '1 / -1' }}
              slotProps={{ htmlInput: { style: { fontFamily: 'IBM Plex Mono, monospace' } } }}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" disabled={!podeSalvar} onClick={() => mutation.mutate()}>
          {edicao ? 'Salvar' : 'Criar e gerar token'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

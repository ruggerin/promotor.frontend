import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Switch,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useState } from 'react';
import { MdiIcon } from '../../components/MdiIcon';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import {
  aceitarSugestoesClasse,
  atualizarClasse,
  criarClasse,
  desativarClasse,
  listarClasses,
  listarSugestoesClasse,
  type DadosClasse,
} from '../../lib/api/xp';
import type { ClasseLoja } from '../../types/api';
import { ClasseLojaChip } from './ClasseLojaChip';

const erroDe = (e: unknown, padrao: string) =>
  axios.isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(e)
    ? (Object.values(e.response?.data.errors ?? {})[0]?.[0] ?? e.response?.data.message ?? padrao)
    : padrao;

const duracaoTexto = (min: number) => (min >= 60 ? `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, '0') : ''}` : `${min} min`);

/**
 * Classes de loja da régua de XP (docs/88 §4): quanto vale uma visita perfeita em cada tipo de loja
 * e quanto tempo ela costuma levar. O sistema sugere pela mediana do tempo real; o gestor decide.
 */
export function ClassesLojaPage() {
  const [aba, setAba] = useState<'classes' | 'sugestoes'>('classes');
  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Classes de loja" />);

  return (
    <Box>
      {cabecalho}
      <Tabs value={aba} onChange={(_, v) => setAba(v)} sx={{ mb: 2 }}>
        <Tab value="classes" label="Classes" />
        <Tab value="sugestoes" label="Sugestões do sistema" />
      </Tabs>
      {aba === 'classes' ? <ListaClasses /> : <Sugestoes />}
    </Box>
  );
}

function ListaClasses() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ClasseLoja | 'nova' | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['classes-loja'], queryFn: () => listarClasses() });

  const alternar = useMutation({
    mutationFn: (c: ClasseLoja) => (c.ativo ? desativarClasse(c.id) : atualizarClasse(c.id, { ativo: true }).then(() => undefined)),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['classes-loja'] }),
    onError: (e) => setErro(erroDe(e, 'Não foi possível alterar a classe.')),
  });

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
          Uma loja grande e trabalhosa vale mais que uma pequena. Calibre pelo esforço: o XP de um "chefão" deve equivaler a
          várias lojas pequenas que levam o mesmo tempo. Loja sem classe usa a marcada como padrão.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setForm('nova')}>
          Nova classe
        </Button>
      </Box>
      {erro && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Classe</TableCell>
              <TableCell align="right">XP da visita perfeita</TableCell>
              <TableCell align="right">Tempo-padrão</TableCell>
              <TableCell align="right">Lojas</TableCell>
              <TableCell>Situação</TableCell>
              <TableCell align="right">Ações</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {query.data?.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Nenhuma classe ainda. Sem classe, as OS não geram XP.
                </TableCell>
              </TableRow>
            )}
            {query.data?.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <MdiIcon icone={c.icone} size={20} sx={{ color: c.cor ?? undefined }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {c.nome}
                    </Typography>
                    {c.eh_padrao && <Chip size="small" label="Padrão" color="primary" variant="outlined" />}
                  </Box>
                </TableCell>
                <TableCell align="right">{c.xp_base.toLocaleString('pt-BR')}</TableCell>
                <TableCell align="right">{duracaoTexto(c.duracao_padrao_minutos)}</TableCell>
                <TableCell align="right">{c.lojas ?? 0}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.ativo ? 'Ativa' : 'Inativa'} color={c.ativo ? 'success' : 'default'} />
                </TableCell>
                <TableCell align="right">
                  <Tooltip title="Editar">
                    <IconButton size="small" onClick={() => setForm(c)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={c.ativo ? (c.eh_padrao ? 'A classe padrão não pode ser desativada' : 'Desativar') : 'Reativar'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={c.ativo && c.eh_padrao}
                        onClick={() => (!c.ativo || window.confirm(`Desativar a classe "${c.nome}"?`)) && alternar.mutate(c)}
                      >
                        {c.ativo ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      {form && <ClasseFormDialog classe={form === 'nova' ? null : form} onFechar={() => setForm(null)} />}
    </>
  );
}

function ClasseFormDialog({ classe, onFechar }: { classe: ClasseLoja | null; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const [nome, setNome] = useState(classe?.nome ?? '');
  const [icone, setIcone] = useState(classe?.icone ?? '');
  const [cor, setCor] = useState(classe?.cor ?? '#6366f1');
  const [xp, setXp] = useState(String(classe?.xp_base ?? ''));
  const [duracao, setDuracao] = useState(String(classe?.duracao_padrao_minutos ?? ''));
  const [padrao, setPadrao] = useState(classe?.eh_padrao ?? false);

  const salvar = useMutation({
    mutationFn: () => {
      const dados: DadosClasse = {
        nome: nome.trim(),
        icone: icone.trim() || null,
        cor: cor || null,
        xp_base: Number(xp),
        duracao_padrao_minutos: Number(duracao),
        eh_padrao: padrao,
      };
      return classe ? atualizarClasse(classe.id, dados) : criarClasse(dados);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['classes-loja'] });
      onFechar();
    },
  });
  const valido = nome.trim() && Number(xp) > 0 && Number(duracao) > 0;

  return (
    <Dialog open onClose={onFechar} fullWidth maxWidth="sm">
      <DialogTitle>{classe ? `Editar classe · ${classe.nome}` : 'Nova classe de loja'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {salvar.error && <Alert severity="error">{erroDe(salvar.error, 'Não foi possível salvar.')}</Alert>}
        <Alert severity="info" variant="outlined">
          Mudar o XP de uma classe vale para as OS criadas daqui pra frente. As que já existem guardam o valor de quando nasceram.
        </Alert>
        <TextField label="Nome" size="small" required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Chefão" />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="XP da visita perfeita"
            size="small"
            required
            type="number"
            fullWidth
            value={xp}
            onChange={(e) => setXp(e.target.value)}
            slotProps={{ input: { endAdornment: <InputAdornment position="end">XP</InputAdornment> } }}
          />
          <TextField
            label="Tempo-padrão"
            size="small"
            required
            type="number"
            fullWidth
            value={duracao}
            onChange={(e) => setDuracao(e.target.value)}
            helperText="Vira a duração prevista da OS"
            slotProps={{ input: { endAdornment: <InputAdornment position="end">min</InputAdornment> } }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="Ícone (Material Design Icons)"
            size="small"
            fullWidth
            value={icone}
            onChange={(e) => setIcone(e.target.value)}
            placeholder="crown, sword-cross, shield-outline"
            slotProps={{ input: { startAdornment: <InputAdornment position="start"><MdiIcon icone={icone || null} size={18} sx={{ color: cor }} /></InputAdornment> } }}
          />
          <TextField label="Cor" size="small" type="color" value={cor} onChange={(e) => setCor(e.target.value)} sx={{ width: 110 }} />
        </Box>
        <FormControlLabel control={<Switch checked={padrao} onChange={(e) => setPadrao(e.target.checked)} />} label="Classe padrão (loja sem classe usa esta)" />
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Cancelar</Button>
        <Button variant="contained" disabled={!valido || salvar.isPending} onClick={() => salvar.mutate()}>
          {classe ? 'Salvar' : 'Cadastrar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Sugestoes() {
  const queryClient = useQueryClient();
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const query = useQuery({ queryKey: ['classes-loja', 'sugestoes'], queryFn: listarSugestoesClasse });
  const aceitar = useMutation({
    mutationFn: () => aceitarSugestoesClasse([...marcadas]),
    onSuccess: () => {
      setMarcadas(new Set());
      void queryClient.invalidateQueries({ queryKey: ['classes-loja'] });
    },
  });
  const lista = query.data ?? [];
  const alternar = (id: string) =>
    setMarcadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 720 }}>
          Sugestão pela mediana do tempo das visitas dos últimos 90 dias (mínimo de 3), atualizada toda segunda. Uma visita
          demorada pode ter sido um problema, por isso o tempo nunca muda a classe sozinho: você decide.
        </Typography>
        <Button variant="contained" disabled={marcadas.size === 0 || aceitar.isPending} onClick={() => aceitar.mutate()}>
          Aceitar {marcadas.size > 0 ? `(${marcadas.size})` : ''}
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={lista.length > 0 && marcadas.size === lista.length}
                  indeterminate={marcadas.size > 0 && marcadas.size < lista.length}
                  onChange={(e) => setMarcadas(e.target.checked ? new Set(lista.map((s) => s.ponto_venda.id)) : new Set())}
                />
              </TableCell>
              <TableCell>Loja</TableCell>
              <TableCell>Classe atual</TableCell>
              <TableCell>Sugerida</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {query.isLoading && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  <CircularProgress size={24} />
                </TableCell>
              </TableRow>
            )}
            {!query.isLoading && lista.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} align="center">
                  Nenhuma sugestão diferente da classe atual.
                </TableCell>
              </TableRow>
            )}
            {lista.map((s) => (
              <TableRow key={s.ponto_venda.id} hover onClick={() => alternar(s.ponto_venda.id)} sx={{ cursor: 'pointer' }}>
                <TableCell padding="checkbox">
                  <Checkbox checked={marcadas.has(s.ponto_venda.id)} />
                </TableCell>
                <TableCell>{s.ponto_venda.fantasia}</TableCell>
                <TableCell>{s.atual ? <ClasseLojaChip classe={s.atual} /> : <Typography variant="body2" color="text.secondary">Padrão</Typography>}</TableCell>
                <TableCell>
                  <ClasseLojaChip classe={s.sugerida} xp={s.sugerida.xp_base} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

import HistoryIcon from '@mui/icons-material/History';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  FormControlLabel,
  InputAdornment,
  Link,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { TituloComAtualizar } from '../../components/RefreshButton';
import {
  buscarCatalogoConfiguracoes,
  salvarConfiguracoesLote,
  type AreaConfiguracao,
  type ItemConfiguracao,
} from '../../lib/api/parametros';
import { useAuth } from '../../lib/auth/AuthContext';
import {
  casaComBusca,
  edicaoDoServidor,
  edicaoPadrao,
  erroDaEdicao,
  estaLigado,
  iguais,
  paraAlteracao,
  textoDoValor,
  type Edicao,
} from './configuracoesLogica';
import { ParametrosListPage } from './ParametrosListPage';
import { HistoricoConfiguracoesDialog, ORIGEM_ROTULO } from './HistoricoConfiguracoesDialog';

const LIGAR_COM = '60';

/**
 * Tela de Configurações (docs/62): os mesmos parâmetros chave/valor, mas agrupados por assunto,
 * com nome legível e o controle do tipo certo. O catálogo vem do servidor (nada de lista
 * duplicada aqui) e as alterações vão num lote só, tudo ou nada. A tabela crua continua em
 * /parametros/avancado — e é a única visão do SUPERADMIN, que não edita parâmetro de empresa.
 */
export function ConfiguracoesPage() {
  const { usuario } = useAuth();
  if (usuario?.user_type === 'SUPERADMIN') return <ParametrosListPage />;
  return <Configuracoes />;
}

function Configuracoes() {
  const queryClient = useQueryClient();
  const [areaAtiva, setAreaAtiva] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [edicoes, setEdicoes] = useState<Record<string, Edicao>>({});
  const [salvo, setSalvo] = useState(false);
  // Histórico de alterações (auditoria): null = fechado; '' = todas; chave = só aquela configuração.
  const [historico, setHistorico] = useState<string | null>(null);

  const cabecalho = usePageHeader(<TituloComAtualizar titulo="Configurações" />);

  const query = useQuery({ queryKey: ['parametros', 'catalogo'], queryFn: buscarCatalogoConfiguracoes });
  const areas = useMemo(() => query.data?.areas ?? [], [query.data]);
  const itens = useMemo(() => areas.flatMap((a) => a.itens), [areas]);
  const itemPorChave = useMemo(() => new Map(itens.map((i) => [i.chave, i])), [itens]);

  const edicaoDe = (item: ItemConfiguracao): Edicao => edicoes[item.chave] ?? edicaoDoServidor(item);
  const pendente = (item: ItemConfiguracao) => item.chave in edicoes && !iguais(edicoes[item.chave], edicaoDoServidor(item));

  const pendentes = itens.filter(pendente);
  const invalidos = pendentes.filter((i) => erroDaEdicao(i, edicaoDe(i)) !== null);

  // Pesos do XP da visita (docs/88 §5.1): os 6 somam 100, contando os que não mudaram.
  const pesosXp = itens.filter((i) => i.grupo === 'composicao_xp');
  const somaPesosXp = pesosXp.reduce((t, i) => t + (Number(edicaoDe(i).valor) || 0), 0);
  const pesosXpErrados = pesosXp.some(pendente) && somaPesosXp !== 100;

  const salvar = useMutation({
    mutationFn: () => salvarConfiguracoesLote(pendentes.map((i) => paraAlteracao(i, edicaoDe(i)))),
    onSuccess: (resposta) => {
      queryClient.setQueryData(['parametros', 'catalogo'], resposta);
      // O mobile e as telas que leem o parâmetro cru precisam do valor novo.
      void queryClient.invalidateQueries({ queryKey: ['parametros'], refetchType: 'all' });
      setEdicoes({});
      setSalvo(true);
    },
  });

  const mensagemErro = (() => {
    if (!salvar.isError) return null;
    if (axios.isAxiosError<{ message?: string }>(salvar.error)) {
      return salvar.error.response?.data.message ?? 'Não foi possível salvar as configurações.';
    }
    return 'Não foi possível salvar as configurações.';
  })();

  function alterar(item: ItemConfiguracao, proxima: Edicao) {
    setSalvo(false);
    setEdicoes((atual) => ({ ...atual, [item.chave]: proxima }));
  }

  const buscando = busca.trim() !== '';
  const area = areas.find((a) => a.chave === areaAtiva) ?? areas[0];
  const visiveis: { area: AreaConfiguracao; item: ItemConfiguracao }[] = buscando
    ? areas.flatMap((a) => a.itens.filter((i) => casaComBusca(i, a.rotulo, busca)).map((i) => ({ area: a, item: i })))
    : (area?.itens ?? []).map((i) => ({ area: area as AreaConfiguracao, item: i }));

  const contagemDaArea = (a: AreaConfiguracao) =>
    a.itens.filter((i) => (i.chave in edicoes ? pendente(i) : i.alterado_do_padrao)).length;

  return (
    <Box>
      {cabecalho}
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Buscar configuração…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{ width: { xs: '100%', sm: 360 } }}
          slotProps={{
            htmlInput: { 'aria-label': 'Buscar configuração' },
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Button size="small" startIcon={<HistoryIcon />} onClick={() => setHistorico('')}>
          Histórico de alterações
        </Button>
        <Button component={RouterLink} to="/parametros/avancado" size="small">
          Avançado (tabela completa)
        </Button>
      </Box>

      {query.isLoading && <CircularProgress size={28} />}
      {query.isError && (
        <Alert severity="error">
          Não foi possível carregar as configurações — você pode não ter permissão para isto, ou houve um problema de conexão.
        </Alert>
      )}

      {query.data && (
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
          <Paper variant="outlined" sx={{ width: { xs: '100%', md: 260 }, flexShrink: 0, overflow: 'hidden' }}>
            <List
              component="nav"
              aria-label="Áreas de configuração"
              sx={{ display: 'flex', flexDirection: { xs: 'row', md: 'column' }, overflowX: { xs: 'auto', md: 'visible' }, p: 0.5 }}
            >
              {areas.map((a) => {
                const n = contagemDaArea(a);
                return (
                  <ListItemButton
                    key={a.chave}
                    selected={!buscando && a.chave === (area?.chave ?? '')}
                    onClick={() => {
                      setBusca('');
                      setAreaAtiva(a.chave);
                    }}
                    sx={{ borderRadius: 1, flexShrink: 0 }}
                  >
                    <ListItemText primary={a.rotulo} slotProps={{ primary: { variant: 'body2', noWrap: true } }} />
                    {n > 0 && <Badge color="primary" badgeContent={n} sx={{ ml: 2, mr: 1 }} aria-label={`${n} alteradas`} />}
                  </ListItemButton>
                );
              })}
            </List>
          </Paper>

          <Box sx={{ flexGrow: 1, minWidth: 0, width: '100%' }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              {buscando ? `Resultados para “${busca.trim()}”` : area?.rotulo}
            </Typography>
            {!buscando && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                {area?.ajuda}
              </Typography>
            )}
            {buscando && visiveis.length === 0 && (
              <Typography color="text.secondary" sx={{ py: 3 }}>
                Nenhuma configuração encontrada para essa busca.
              </Typography>
            )}

            <Paper variant="outlined">
              {visiveis.map(({ area: a, item }, idx) => {
                const edicao = edicaoDe(item);
                const dependencia = item.depende_de ? itemPorChave.get(item.depende_de.chave) : undefined;
                const bloqueio =
                  item.depende_de && dependencia && !estaLigado(dependencia, edicaoDe(dependencia)) ? item.depende_de.motivo : null;
                const raio = itemPorChave.get('CHECKIN_RAIO_METROS');
                const raioEdicao = raio ? edicaoDe(raio) : null;
                const avisoRaio =
                  item.chave === 'RASTREAMENTO_AFASTAMENTO_METROS' &&
                  raioEdicao &&
                  !raioEdicao.semLimite &&
                  Number(raioEdicao.valor) > 0 &&
                  Number(edicao.valor) <= Number(raioEdicao.valor)
                    ? `Igual ou abaixo do raio do check-in (${raioEdicao.valor} m): quem entra na borda do raio já aparece como "saiu da loja".`
                    : item.grupo === 'composicao_xp' && pesosXpErrados
                      ? `Os pesos somam ${somaPesosXp}%; precisam dar 100%.`
                      : null;

                return (
                  <LinhaConfiguracao
                    key={item.chave}
                    item={item}
                    areaRotulo={buscando ? a.rotulo : null}
                    edicao={edicao}
                    pendente={pendente(item)}
                    bloqueio={bloqueio}
                    aviso={avisoRaio}
                    separador={idx > 0}
                    onChange={(e) => alterar(item, e)}
                    onHistorico={() => setHistorico(item.chave)}
                  />
                );
              })}
            </Paper>
          </Box>
        </Box>
      )}

      {pendentes.length > 0 && (
        <Paper
          elevation={8}
          sx={{
            position: 'sticky', bottom: 0, zIndex: (t) => t.zIndex.appBar, mt: 2, px: 3, py: 1.5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
            borderRadius: 0,
          }}
          role="region"
          aria-label="Alterações pendentes"
        >
          <Typography variant="body2" sx={{ flexGrow: 1 }}>
            <strong>{pendentes.length}</strong> {pendentes.length === 1 ? 'configuração alterada' : 'configurações alteradas'}, ainda não{' '}
            {pendentes.length === 1 ? 'salva' : 'salvas'}.
            {invalidos.length > 0 && ' Corrija os campos em vermelho para salvar.'}
            {pesosXpErrados && ` Os pesos do XP da visita somam ${somaPesosXp}%; ajuste para 100%.`}
          </Typography>
          <Button onClick={() => setEdicoes({})} disabled={salvar.isPending}>
            Descartar
          </Button>
          <Button variant="contained" disabled={salvar.isPending || invalidos.length > 0 || pesosXpErrados} onClick={() => salvar.mutate()}>
            {salvar.isPending ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </Paper>
      )}

      {mensagemErro && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => salvar.reset()}>
          {mensagemErro}
        </Alert>
      )}
      <HistoricoConfiguracoesDialog open={historico !== null} onClose={() => setHistorico(null)} itens={itens} chaveInicial={historico || null} />

      {salvo && (
        <Alert severity="success" sx={{ mt: 2 }} onClose={() => setSalvo(false)}>
          Configurações salvas. O aplicativo do promotor aplica na próxima sincronização.
        </Alert>
      )}
    </Box>
  );
}

interface LinhaProps {
  item: ItemConfiguracao;
  areaRotulo: string | null;
  edicao: Edicao;
  pendente: boolean;
  bloqueio: string | null;
  aviso: string | null;
  separador: boolean;
  onChange: (e: Edicao) => void;
  onHistorico: () => void;
}

function LinhaConfiguracao({ item, areaRotulo, edicao, pendente, bloqueio, aviso, separador, onChange, onHistorico }: LinhaProps) {
  const erro = pendente ? erroDaEdicao(item, edicao) : null;
  const igualAoPadrao = iguais(edicao, edicaoPadrao(item));
  const idAjuda = `ajuda-${item.chave}`;

  return (
    <Box
      sx={{
        display: 'flex', gap: 2, p: 2, flexWrap: 'wrap', alignItems: 'flex-start',
        borderTop: separador ? 1 : 0, borderColor: 'divider', opacity: bloqueio ? 0.6 : 1,
      }}
    >
      <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            {item.rotulo}
          </Typography>
          {areaRotulo && <Chip size="small" variant="outlined" label={areaRotulo} />}
          {pendente ? (
            <Chip size="small" color="warning" label="Não salvo" />
          ) : item.alterado_do_padrao ? (
            <Chip size="small" color="primary" variant="outlined" label="Alterado" />
          ) : null}
          {!item.cadastrado && !pendente && <Chip size="small" variant="outlined" label="Padrão do sistema" />}
        </Box>
        <Typography id={idAjuda} variant="body2" color="text.secondary">
          {bloqueio ?? item.ajuda}
        </Typography>
        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace' }}>
          {item.chave}
        </Typography>
        {item.ultima_alteracao && (
          <Typography variant="caption" color="text.secondary" component="div">
            Alterado por {item.ultima_alteracao.por ?? ORIGEM_ROTULO[item.ultima_alteracao.origem] ?? 'sistema'}
            {item.ultima_alteracao.em ? ` em ${new Date(item.ultima_alteracao.em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}` : ''} ·{' '}
            <Link component="button" type="button" variant="caption" onClick={onHistorico} sx={{ verticalAlign: 'baseline' }}>
              histórico
            </Link>
          </Typography>
        )}
        {aviso && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {aviso}
          </Alert>
        )}
      </Box>

      <Box sx={{ flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
        <Controle item={item} edicao={edicao} erro={erro} desabilitado={bloqueio !== null} idAjuda={idAjuda} onChange={onChange} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="caption" color="text.secondary">
            Padrão: {textoDoValor(item, item.padrao)}
          </Typography>
          {!igualAoPadrao && !bloqueio && (
            <Button size="small" onClick={() => onChange(edicaoPadrao(item))} sx={{ py: 0, minWidth: 0 }}>
              Restaurar padrão
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

interface ControleProps {
  item: ItemConfiguracao;
  edicao: Edicao;
  erro: string | null;
  desabilitado: boolean;
  idAjuda: string;
  onChange: (e: Edicao) => void;
}

function Controle({ item, edicao, erro, desabilitado, idAjuda, onChange }: ControleProps) {
  const rotuloAcessivel = item.rotulo;
  const sufixo = item.unidade ? { endAdornment: <InputAdornment position="end">{item.unidade}</InputAdornment> } : undefined;

  switch (item.tipo) {
    case 'bool':
      return (
        <FormControlLabel
          control={
            <Switch
              checked={edicao.valor === 'true'}
              disabled={desabilitado}
              onChange={(e) => onChange({ ...edicao, valor: e.target.checked ? 'true' : 'false' })}
              slotProps={{ input: { 'aria-label': rotuloAcessivel, 'aria-describedby': idAjuda, role: 'switch' } }}
            />
          }
          label={edicao.valor === 'true' ? 'Ligado' : 'Desligado'}
        />
      );

    case 'numero_ou_zero': {
      const ligado = edicao.valor !== '0' && edicao.valor !== '';
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <FormControlLabel
            control={
              <Switch
                checked={ligado}
                disabled={desabilitado}
                onChange={(e) => onChange({ ...edicao, valor: e.target.checked ? LIGAR_COM : '0' })}
                slotProps={{ input: { 'aria-label': rotuloAcessivel, 'aria-describedby': idAjuda, role: 'switch' } }}
              />
            }
            label={ligado ? 'Ligado' : 'Desligado'}
          />
          {ligado && (
            <TextField
              size="small"
              type="number"
              label={rotuloAcessivel}
              value={edicao.valor}
              disabled={desabilitado}
              error={erro !== null}
              helperText={erro}
              onChange={(e) => onChange({ ...edicao, valor: e.target.value })}
              slotProps={{ input: sufixo, htmlInput: { min: item.min ?? 0, max: item.max ?? undefined, 'aria-describedby': idAjuda } }}
              sx={{ width: 180 }}
            />
          )}
        </Box>
      );
    }

    case 'numero_ou_sem_limite':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          <TextField
            size="small"
            type="number"
            label={rotuloAcessivel}
            value={edicao.semLimite ? '' : edicao.valor}
            disabled={desabilitado || edicao.semLimite}
            error={erro !== null}
            helperText={erro}
            onChange={(e) => onChange({ ...edicao, valor: e.target.value })}
            slotProps={{ input: sufixo, htmlInput: { min: item.min ?? 0, max: item.max ?? undefined, 'aria-describedby': idAjuda } }}
            sx={{ width: 180 }}
          />
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={edicao.semLimite}
                disabled={desabilitado}
                onChange={(e) => onChange({ valor: edicao.valor || item.padrao, semLimite: e.target.checked })}
              />
            }
            label="Sem limite"
          />
        </Box>
      );

    case 'lista':
      return (
        <TextField
          select
          size="small"
          label={rotuloAcessivel}
          value={edicao.valor}
          disabled={desabilitado}
          error={erro !== null}
          helperText={erro}
          onChange={(e) => onChange({ ...edicao, valor: e.target.value })}
          slotProps={{ htmlInput: { 'aria-describedby': idAjuda } }}
          sx={{ minWidth: 260, maxWidth: '100%' }}
        >
          {(item.opcoes ?? []).map((o) => (
            <MenuItem key={o.valor} value={o.valor} sx={{ whiteSpace: 'normal' }}>
              {o.rotulo}
            </MenuItem>
          ))}
        </TextField>
      );

    case 'hora':
      return (
        <TextField
          size="small"
          type="time"
          label={rotuloAcessivel}
          value={edicao.valor}
          disabled={desabilitado}
          error={erro !== null}
          helperText={erro}
          onChange={(e) => onChange({ ...edicao, valor: e.target.value })}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-describedby': idAjuda } }}
          sx={{ width: 160 }}
        />
      );

    default:
      return (
        <TextField
          size="small"
          type="number"
          label={rotuloAcessivel}
          value={edicao.valor}
          disabled={desabilitado}
          error={erro !== null}
          helperText={erro}
          onChange={(e) => onChange({ ...edicao, valor: e.target.value })}
          slotProps={{ input: sufixo, htmlInput: { min: item.min ?? 0, max: item.max ?? undefined, 'aria-describedby': idAjuda } }}
          sx={{ width: 180 }}
        />
      );
  }
}

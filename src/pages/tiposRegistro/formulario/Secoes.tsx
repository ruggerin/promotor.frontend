import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import SearchIcon from '@mui/icons-material/Search';
import {
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Popover,
  Switch,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Controller, useFieldArray, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { MdiIcon } from '../../../components/MdiIcon';
import { listarCampanhas } from '../../../lib/api/campanhas';
import { listarPontosVenda } from '../../../lib/api/pontosVenda';
import { listarRedesLojas } from '../../../lib/api/redesLojas';
import { listarSecoes } from '../../../lib/api/secoes';
import { SelecionarPontoVendaDialog } from '../../usuarios/SelecionarPontoVendaDialog';
import {
  camposDoQuandoAparece,
  camposDoSobreOQue,
  quandoAparece,
  sobreOQue,
  type FormData,
  type QuandoAparece,
  type SobreOQue,
} from './modelo';
import { OPCOES_AVANCADAS, OPCOES_QUANDO, OPCOES_SOBRE } from './rotulos';
import { SeletorProdutosDialog } from './SeletorProdutosDialog';
import { horus } from '../../../theme';

// ---------------------------------------------------------------- blocos visuais compartilhados

/** Card "radio" do protótipo: bolinha + título + subtítulo, borda roxa quando escolhido. */
export function OpcaoRadio({
  titulo,
  sub,
  ativo,
  onClick,
  children,
}: {
  titulo: string;
  sub: string;
  ativo: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <Box
      sx={{
        border: 1.5,
        borderColor: ativo ? 'primary.main' : 'divider',
        borderRadius: 2.5,
        bgcolor: (t) => (ativo ? alpha(t.palette.primary.main, 0.04) : t.palette.background.paper),
        overflow: 'hidden',
      }}
    >
      <Box onClick={onClick} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start', px: 2, py: 1.5, cursor: 'pointer' }}>
        <Box
          sx={{
            mt: 0.25,
            width: 18,
            height: 18,
            borderRadius: '50%',
            border: 2,
            borderColor: ativo ? 'primary.main' : 'grey.400',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {ativo && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />}
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {titulo}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {sub}
          </Typography>
        </Box>
      </Box>
      {ativo && children}
    </Box>
  );
}

function Grupo({ children }: { children: ReactNode }) {
  return (
    <Typography variant="caption" sx={{ display: 'block', fontWeight: 700, letterSpacing: 0.6, color: 'text.secondary', mt: 2, mb: 1 }}>
      {children}
    </Typography>
  );
}

// ---------------------------------------------------------------- 1. Identificação

const ICONES = [
  'clipboard-list-outline', 'format-list-checks', 'clipboard-check-outline', 'file-document-outline',
  'cash', 'currency-usd', 'tag-outline', 'sale', 'percent', 'chart-bar',
  'camera', 'image-outline', 'store', 'storefront-outline', 'cart-outline', 'barcode-scan',
  'package-variant', 'package-variant-closed', 'truck-outline', 'dolly', 'bookshelf', 'view-grid-outline',
  'alert-outline', 'alert-circle-outline', 'calendar-clock', 'calendar-check', 'clock-outline', 'thermometer',
  'fridge-outline', 'broom', 'spray-bottle', 'washing-machine', 'food-apple-outline', 'bottle-soda-outline',
  'ice-cream', 'glass-cocktail', 'star-outline', 'thumb-up-outline', 'check-circle-outline', 'close-circle-outline',
  'flag-outline', 'bullhorn-outline', 'sign-text', 'lightbulb-outline', 'handshake-outline', 'account-group-outline',
  'map-marker-outline', 'comment-text-outline',
];

export function SecaoIdentificacao({ control }: { control: Control<FormData> }) {
  return (
    <>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Controller
          name="descricao"
          control={control}
          render={({ field, fieldState }) => (
            <Box sx={{ flex: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                Nome do formulário
              </Typography>
              <TextField {...field} fullWidth size="small" placeholder="Ex.: Pesquisa de Preço" error={!!fieldState.error} helperText={fieldState.error?.message} />
            </Box>
          )}
        />
        <Controller
          name="icone"
          control={control}
          render={({ field }) => (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.75 }}>
                Ícone
              </Typography>
              <SeletorIcone valor={field.value} onChange={field.onChange} />
            </Box>
          )}
        />
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
        O nome e o ícone aparecem assim no app do promotor. O ícone abre uma galeria visual — ninguém precisa digitar código.
      </Typography>
    </>
  );
}

function SeletorIcone({ valor, onChange }: { valor: string | null; onChange: (v: string | null) => void }) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const [codigo, setCodigo] = useState('');
  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        onClick={(e) => {
          setCodigo(valor ?? '');
          setAncora(e.currentTarget);
        }}
        endIcon={<KeyboardArrowDownIcon />}
        sx={{ height: 40, borderColor: 'divider', gap: 0.5 }}
      >
        <Box sx={{ width: 26, height: 26, borderRadius: 1, bgcolor: horus.cinzaSuave, display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 0.5 }}>
          {valor ? <MdiIcon icone={valor} size={18} /> : <Typography variant="caption">?</Typography>}
        </Box>
        {valor ? 'Trocar' : 'Escolher'}
      </Button>
      <Popover open={!!ancora} anchorEl={ancora} onClose={() => setAncora(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Box sx={{ p: 2, width: 380 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
            Escolha um ícone
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 0.5 }}>
            {ICONES.map((i) => (
              <IconButton
                key={i}
                title={i} aria-label={i}
                onClick={() => {
                  onChange(i);
                  setAncora(null);
                }}
                sx={{ borderRadius: 1.5, border: 1.5, borderColor: valor === i ? 'primary.main' : 'transparent' }}
              >
                <MdiIcon icone={i} size={20} />
              </IconButton>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center' }}>
            <TextField
              size="small"
              fullWidth
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Outro: código do ícone (MDI)"
              slotProps={{ input: { startAdornment: codigo ? <InputAdornment position="start"><MdiIcon icone={codigo.replace(/^mdi[-:]/, '')} size={18} /></InputAdornment> : undefined } }}
            />
            <Button
              size="small"
              disabled={!codigo.trim()}
              onClick={() => {
                onChange(codigo.trim().replace(/^mdi[-:]/, '').toLowerCase());
                setAncora(null);
              }}
            >
              Usar
            </Button>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Link href="https://pictogrammers.com/library/mdi/" target="_blank" rel="noreferrer" variant="caption">
              Ver todos os ícones
            </Link>
            {valor && (
              <Link
                component="button"
                variant="caption"
                color="error"
                onClick={() => {
                  onChange(null);
                  setAncora(null);
                }}
              >
                Sem ícone
              </Link>
            )}
          </Box>
        </Box>
      </Popover>
    </>
  );
}

// ---------------------------------------------------------------- 2. Quando o promotor vê



export function SecaoQuandoAparece({ control, setValue }: { control: Control<FormData>; setValue: UseFormSetValue<FormData> }) {
  const acao = useWatch({ control, name: 'acao_obrigatoria' });
  const escopo = useWatch({ control, name: 'escopo_acao' });
  const livre = useWatch({ control, name: 'disponivel_registro_livre' });
  const atual = quandoAparece({ acao_obrigatoria: acao, escopo_acao: escopo, disponivel_registro_livre: livre });

  function escolher(q: QuandoAparece) {
    // "Também no Registro geral": ao virar obrigatório vindo de uma opção opcional, começa desligado.
    const registroLivre = acao ? livre : false;
    const campos = camposDoQuandoAparece(q, registroLivre);
    setValue('acao_obrigatoria', campos.acao_obrigatoria, { shouldDirty: true, shouldValidate: true });
    setValue('escopo_acao', campos.escopo_acao, { shouldDirty: true, shouldValidate: true });
    setValue('disponivel_registro_livre', campos.disponivel_registro_livre, { shouldDirty: true });
  }

  const opcao = (q: QuandoAparece, extra?: ReactNode) => (
    <OpcaoRadio key={q} titulo={OPCOES_QUANDO[q].titulo} sub={OPCOES_QUANDO[q].sub} ativo={atual === q} onClick={() => escolher(q)}>
      {extra}
    </OpcaoRadio>
  );

  return (
    <>
      <Grupo>OPCIONAL</Grupo>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {opcao('LIVRE')}
        {opcao('SO_CAMPANHAS')}
      </Box>
      <Grupo>OBRIGATÓRIO — VIRA PENDÊNCIA NA ABA AÇÕES</Grupo>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {opcao('SEMPRE')}
        {opcao('LOJA_REDE', <EscopoLojaRede control={control} />)}
        {opcao('CAMPANHA', <EscopoCampanha control={control} />)}
        {opcao('CONTRATO')}
      </Box>
      {acao && (
        <Controller
          name="disponivel_registro_livre"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              sx={{ mt: 2, alignItems: 'flex-start', ml: 0 }}
              control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} sx={{ mt: -0.5 }} />}
              label={
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Também deixar no menu "Registro geral"
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Além da pendência, o promotor pode abrir quando quiser, em qualquer loja.
                  </Typography>
                </Box>
              }
            />
          )}
        />
      )}
    </>
  );
}

function PainelEscopo({ children }: { children: ReactNode }) {
  return <Box sx={{ mx: 2, mb: 2, pl: 2, borderLeft: 2, borderColor: 'divider' }}>{children}</Box>;
}

function EscopoCampanha({ control }: { control: Control<FormData> }) {
  const campanhasQuery = useQuery({ queryKey: ['campanhas', { ativo: true }], queryFn: () => listarCampanhas(true) });
  return (
    <PainelEscopo>
      <Controller
        name="campanha_auditoria_uuid"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            select
            size="small"
            fullWidth
            label="Campanha"
            value={field.value ?? ''}
            onChange={(e) => field.onChange(e.target.value || null)}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            disabled={campanhasQuery.isLoading}
            sx={{ bgcolor: 'background.paper' }}
          >
            {(campanhasQuery.data?.campanhas ?? []).map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.descricao}
              </MenuItem>
            ))}
            {campanhasQuery.isSuccess && campanhasQuery.data.campanhas.length === 0 && (
              <MenuItem value="" disabled>
                Nenhuma campanha ativa
              </MenuItem>
            )}
          </TextField>
        )}
      />
    </PainelEscopo>
  );
}

function EscopoLojaRede({ control }: { control: Control<FormData> }) {
  const redesQuery = useQuery({ queryKey: ['redes-lojas', 'escopo-acao'], queryFn: () => listarRedesLojas({ ativo: true, por_pagina: 200 }) });
  const redes = redesQuery.data?.redes_lojas ?? [];
  const redesEscolhidas = useWatch({ control, name: 'redes_lojas_uuids' });
  const lojasEscolhidas = useWatch({ control, name: 'pontos_venda_escopo' });
  const [addRede, setAddRede] = useState<HTMLElement | null>(null);
  const [addLoja, setAddLoja] = useState(false);

  return (
    <PainelEscopo>
      <Typography variant="body2" sx={{ mb: 0.75 }}>
        <b>Redes</b> <Typography component="span" variant="body2" color="text.secondary">— toda loja da rede entra</Typography>
      </Typography>
      <Controller
        name="redes_lojas_uuids"
        control={control}
        render={({ field }) => (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {field.value.map((id) => (
              <Chip
                key={id}
                color="primary"
                variant="outlined"
                label={redes.find((r) => r.id === id)?.descricao ?? '…'}
                onDelete={() => field.onChange(field.value.filter((x) => x !== id))}
                deleteIcon={<CloseIcon />}
              />
            ))}
            <Chip label="+ Adicionar rede" variant="outlined" color="primary" sx={{ borderStyle: 'dashed' }} onClick={(e) => setAddRede(e.currentTarget)} />
            <Popover open={!!addRede} anchorEl={addRede} onClose={() => setAddRede(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
              <Box sx={{ p: 1.5, width: 300 }}>
                <Autocomplete
                  open
                  size="small"
                  options={redes.filter((r) => !field.value.includes(r.id))}
                  getOptionLabel={(r) => r.descricao}
                  onChange={(_, r) => {
                    if (r) field.onChange([...field.value, r.id]);
                    setAddRede(null);
                  }}
                  renderInput={(params) => <TextField {...params} autoFocus placeholder="Buscar rede" />}
                  noOptionsText="Nenhuma rede"
                  slotProps={{ popper: { disablePortal: true } }}
                />
                <Box sx={{ height: 220 }} />
              </Box>
            </Popover>
          </Box>
        )}
      />

      <Typography variant="body2" sx={{ mt: 1.5, mb: 0.75 }}>
        <b>Lojas específicas</b> <Typography component="span" variant="body2" color="text.secondary">— opcional, de qualquer rede</Typography>
      </Typography>
      <Controller
        name="pontos_venda_escopo"
        control={control}
        render={({ field }) => (
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
            {field.value.map((l) => (
              <Chip key={l.id} label={l.fantasia} onDelete={() => field.onChange(field.value.filter((x) => x.id !== l.id))} />
            ))}
            <Chip label="+ Adicionar loja" variant="outlined" color="primary" sx={{ borderStyle: 'dashed' }} onClick={() => setAddLoja(true)} />
            {field.value.length === 0 && (
              <Typography variant="caption" color="text.secondary">
                Nenhuma loja avulsa
              </Typography>
            )}
            <SelecionarPontoVendaDialog
              open={addLoja}
              lojasJaVinculadasIds={new Set(field.value.map((l) => l.id))}
              onClose={() => setAddLoja(false)}
              onSelecionar={(pdv) => {
                field.onChange([...field.value, { id: pdv.id, fantasia: pdv.fantasia }]);
                setAddLoja(false);
              }}
            />
          </Box>
        )}
      />

      <ContagemLojas redes={redesEscolhidas} lojas={lojasEscolhidas} />
    </PainelEscopo>
  );
}

// "Vira pendência em N lojas" — união das lojas das redes escolhidas com as avulsas.
function ContagemLojas({ redes, lojas }: { redes: string[]; lojas: { id: string; fantasia: string }[] }) {
  const [ver, setVer] = useState(false);
  const consultas = useQueries({
    queries: redes.map((rede) => ({
      queryKey: ['pontos-venda', 'da-rede', rede],
      queryFn: () => listarPontosVenda({ ativo: true, rede_loja_uuid: rede, por_pagina: 200 }),
    })),
  });
  const carregando = consultas.some((c) => c.isLoading);
  const truncado = consultas.some((c) => (c.data?.meta.total ?? 0) > (c.data?.pontos_venda.length ?? 0));
  const todas = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const c of consultas) for (const p of c.data?.pontos_venda ?? []) mapa.set(p.id, p.fantasia);
    for (const l of lojas) mapa.set(l.id, l.fantasia);
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consultas.map((c) => c.dataUpdatedAt).join(), lojas]);

  if (redes.length === 0 && lojas.length === 0) {
    return (
      <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: horus.ambarClaro, color: horus.ambarEscuro }}>
        <Typography variant="caption">Nenhuma rede nem loja escolhida — do jeito que está, vira pendência em todas as lojas.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 1, p: 1.25, borderRadius: 2, bgcolor: horus.okClaro, color: horus.ok }}>
      <CheckIcon sx={{ fontSize: 18 }} />
      <Typography variant="caption">
        {carregando ? 'Contando lojas…' : `Vira pendência em ${todas.length}${truncado ? '+' : ''} loja${todas.length === 1 ? '' : 's'}.`}
      </Typography>
      {!carregando && todas.length > 0 && (
        <Link component="button" variant="caption" sx={{ fontWeight: 700, color: horus.ok }} onClick={() => setVer(true)}>
          Ver lojas
        </Link>
      )}
      <Dialog open={ver} onClose={() => setVer(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Lojas com esta pendência ({todas.length})</DialogTitle>
        <DialogContent dividers>
          {todas.map(([id, nome]) => (
            <Typography key={id} variant="body2" sx={{ py: 0.4 }}>
              {nome}
            </Typography>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVer(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ---------------------------------------------------------------- 3. Sobre o que responde



export function SecaoSobreOQue({
  control,
  setValue,
  tipoAtualId,
  nomeFormulario,
}: {
  control: Control<FormData>;
  setValue: UseFormSetValue<FormData>;
  tipoAtualId: string | null;
  nomeFormulario: string;
}) {
  const granularidade = useWatch({ control, name: 'granularidade_padrao' });
  const vincular = useWatch({ control, name: 'permite_vincular_catalogo' });
  const atual = sobreOQue({ granularidade_padrao: granularidade, permite_vincular_catalogo: vincular });

  function escolher(s: SobreOQue) {
    const c = camposDoSobreOQue(s);
    setValue('granularidade_padrao', c.granularidade_padrao, { shouldDirty: true });
    setValue('permite_vincular_catalogo', c.permite_vincular_catalogo, { shouldDirty: true });
  }

  return (
    <>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
        {(['VISITA', 'PRODUTO', 'LINHA', 'PROMOTOR_DECIDE'] as SobreOQue[]).map((s) => (
          <OpcaoRadio key={s} titulo={OPCOES_SOBRE[s].titulo} sub={OPCOES_SOBRE[s].sub} ativo={atual === s} onClick={() => escolher(s)} />
        ))}
      </Box>
      {atual === 'PRODUTO' && <PainelProdutos control={control} tipoAtualId={tipoAtualId} nomeFormulario={nomeFormulario} />}
      {(atual === 'PRODUTO' || atual === 'LINHA') && <ExcecoesPorSecao control={control} />}
    </>
  );
}

function PainelProdutos({ control, tipoAtualId, nomeFormulario }: { control: Control<FormData>; tipoAtualId: string | null; nomeFormulario: string }) {
  const [filtro, setFiltro] = useState('');
  const [seletor, setSeletor] = useState(false);
  return (
    <Controller
      name="produtos_predefinidos"
      control={control}
      render={({ field }) => {
        const visiveis = field.value.filter((p) => p.descricao.toLowerCase().includes(filtro.trim().toLowerCase()));
        return (
          <Box sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.25, bgcolor: horus.subcard, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, flex: 1 }}>
                Produtos <Typography component="span" variant="body2" color="text.secondary">({field.value.length})</Typography>
              </Typography>
              {field.value.length > 6 && (
                <TextField
                  size="small"
                  placeholder="Filtrar na lista"
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  sx={{ width: 200, bgcolor: 'background.paper' }}
                  slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }}
                />
              )}
              <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setSeletor(true)}>
                Adicionar produtos
              </Button>
            </Box>
            {field.value.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2.5 }}>
                Nenhum produto na lista — o promotor escolhe entre os produtos do mix/campanha da loja. Adicione produtos pra
                ele coletar sempre os mesmos, em qualquer loja.
              </Typography>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 3, px: 2, py: 0.5 }}>
                {visiveis.map((p) => (
                  <Box key={p.uuid} sx={{ display: 'flex', alignItems: 'center', py: 0.9, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                      {p.descricao}
                    </Typography>
                    <IconButton size="small" aria-label="Remover produto" onClick={() => field.onChange(field.value.filter((x) => x.uuid !== p.uuid))}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
            {field.value.length > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.25, borderTop: 1, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                  O promotor escolhe só entre estes — esteja o produto no mix da loja ou não.
                </Typography>
                <Link component="button" variant="caption" color="error" onClick={() => field.onChange([])}>
                  Remover todos
                </Link>
              </Box>
            )}
            <SeletorProdutosDialog
              open={seletor}
              subtitulo={`${nomeFormulario || 'Este formulário'} · ${field.value.length} produto(s) no formulário`}
              jaAdicionados={new Set(field.value.map((p) => p.uuid))}
              tipoAtualId={tipoAtualId}
              onClose={() => setSeletor(false)}
              onConfirmar={(novos) => {
                field.onChange([...field.value, ...novos]);
                setSeletor(false);
              }}
            />
          </Box>
        );
      }}
    />
  );
}

function ExcecoesPorSecao({ control }: { control: Control<FormData> }) {
  const { fields, append, remove } = useFieldArray({ control, name: 'excecoes_granularidade' });
  const [aberto, setAberto] = useState(fields.length > 0);
  useEffect(() => {
    if (fields.length > 0) setAberto(true);
  }, [fields.length]);
  const secoesQuery = useQuery({ queryKey: ['secoes', { ativo: true }], queryFn: () => listarSecoes({ ativo: true }), enabled: aberto });

  return (
    <Box sx={{ mt: 2, border: 1, borderColor: 'divider', borderRadius: 2.5 }}>
      <Box onClick={() => setAberto((a) => !a)} sx={{ px: 2, py: 1.25, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {aberto ? '▾' : '▸'} Regra diferente para alguma seção?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          — opcional, {fields.length === 0 ? 'nenhuma definida' : `${fields.length} definida(s)`}
        </Typography>
      </Box>
      {aberto && (
        <Box sx={{ px: 2, pb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            Ex.: no geral a resposta cobre a seção inteira, mas na seção de Pilhas precisa ser produto por produto.
          </Typography>
          {fields.map((f, i) => (
            <Box key={f.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
              <Controller
                name={`excecoes_granularidade.${i}.secao_uuid`}
                control={control}
                render={({ field, fieldState }) => (
                  <TextField select size="small" label="Na seção" fullWidth {...field} error={!!fieldState.error} disabled={secoesQuery.isLoading}>
                    {(secoesQuery.data?.secoes ?? []).map((s) => (
                      <MenuItem key={s.id} value={s.id}>
                        {s.descricao}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
              <Controller
                name={`excecoes_granularidade.${i}.granularidade`}
                control={control}
                render={({ field }) => (
                  <TextField select size="small" label="responde por" sx={{ minWidth: 200 }} {...field}>
                    <MenuItem value="PRODUTO">Cada produto</MenuItem>
                    <MenuItem value="LINHA">Seção / linha inteira</MenuItem>
                  </TextField>
                )}
              />
              <IconButton size="small" aria-label="Remover" onClick={() => remove(i)}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button size="small" startIcon={<AddIcon />} onClick={() => append({ secao_uuid: '', granularidade: 'PRODUTO' })}>
            Adicionar regra por seção
          </Button>
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------- 5. Avançado


export function SecaoAvancado({ control }: { control: Control<FormData> }) {
  return (
    <Box>
      {OPCOES_AVANCADAS.map((o, i) => (
        <Controller
          key={o.nome}
          name={o.nome}
          control={control}
          render={({ field }) => (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.75, borderTop: i === 0 ? 1 : 1, borderColor: 'divider' }}>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {o.titulo}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {o.sub}
                </Typography>
              </Box>
              <Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
            </Box>
          )}
        />
      ))}
    </Box>
  );
}

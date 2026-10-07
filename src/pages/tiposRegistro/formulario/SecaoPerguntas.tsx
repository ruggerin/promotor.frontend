import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined';
import {
  Alert,
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
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Snackbar,
  Switch,
  TextField,
  Typography,
  alpha,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Controller, useFieldArray, useWatch, type Control, type UseFormGetValues, type UseFormSetValue } from 'react-hook-form';
import { listarDepartamentos } from '../../../lib/api/departamentos';
import { listarMarcas } from '../../../lib/api/marcas';
import { listarSecoes } from '../../../lib/api/secoes';
import { listarTiposRegistro } from '../../../lib/api/tiposRegistro';
import type { TipoCampoRegistro } from '../../../types/api';
import {
  campoDaApi,
  campoVazio,
  gerarChave,
  opcoesDoTexto,
  problemaDeOrdem,
  tipoResposta,
  TIPOS_RESPOSTA,
  type CampoForm,
  type FormData,
} from './modelo';
import { SeletorProdutosDialog } from './SeletorProdutosDialog';
import { horus } from '../../../theme';

interface Props {
  control: Control<FormData>;
  setValue: UseFormSetValue<FormData>;
  getValues: UseFormGetValues<FormData>;
  tipoAtualId: string | null;
  erroCampos?: string;
}

/**
 * Seção 4 — Perguntas (protótipo "Formulário — revisão de UX", telas 1 e 2): a foto no topo, cada
 * pergunta num card que abre pra editar (uma por vez), tipo de resposta em blocos, condição "Só
 * aparece se", código interno gerado do texto da pergunta, arrastar pra reordenar. A ordem da
 * lista é a ordem no app (o backend grava `ordem` pelo índice).
 */
export function SecaoPerguntas({ control, setValue, getValues, tipoAtualId, erroCampos }: Props) {
  const { fields, append, remove, move, insert } = useFieldArray({ control, name: 'campos' });
  const [aberta, setAberta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  // "Adicionar pergunta" abre o card novo — o id do field só existe no render seguinte ao append.
  const abrirNova = useRef(false);
  useEffect(() => {
    if (abrirNova.current && fields.length > 0) {
      abrirNova.current = false;
      setAberta(fields[fields.length - 1].id);
    }
  }, [fields]);

  function adicionar() {
    abrirNova.current = true;
    append(campoVazio());
  }

  function duplicar(indice: number) {
    const campos = getValues('campos');
    const original = campos[indice];
    const usadas = new Set(campos.map((c) => c.chave));
    const copia: CampoForm = {
      ...original,
      rotulo: `${original.rotulo} (cópia)`,
      chave: gerarChave(`${original.rotulo} copia`, usadas),
      chaveFixa: false,
    };
    insert(indice + 1, copia);
  }

  function excluir(indice: number) {
    const campos = getValues('campos');
    const chave = campos[indice].chave;
    // Perguntas que dependiam desta passam a aparecer sempre — senão ficariam apontando pro nada.
    const dependentes = campos.map((c, i) => (c.depende_de_chave === chave && chave ? i : -1)).filter((i) => i >= 0);
    for (const i of dependentes) {
      setValue(`campos.${i}.depende_de_chave`, null, { shouldDirty: true });
      setValue(`campos.${i}.depende_de_valor`, null, { shouldDirty: true });
    }
    remove(indice);
    setAviso(dependentes.length ? `${dependentes.length} pergunta(s) que dependiam dela agora aparecem sempre.` : null);
  }

  function aoSoltar(evento: DragEndEvent) {
    const de = fields.findIndex((f) => f.id === evento.active.id);
    const para = fields.findIndex((f) => f.id === evento.over?.id);
    if (de < 0 || para < 0 || de === para) return;
    const campos = [...getValues('campos')];
    const [movido] = campos.splice(de, 1);
    campos.splice(para, 0, movido);
    const problema = problemaDeOrdem(campos);
    if (problema) {
      setAviso(problema);
      return;
    }
    setAviso(null);
    move(de, para);
  }

  return (
    <>
      <LinhaFoto control={control} />

      {aviso && (
        <Alert severity="warning" sx={{ mt: 1.5 }} onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}

      <DndContext sensors={sensors} onDragEnd={aoSoltar}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mt: 1.25 }}>
          {fields.map((f, indice) => (
            <CartaoPergunta
              key={f.id}
              id={f.id}
              indice={indice}
              control={control}
              setValue={setValue}
              getValues={getValues}
              tipoAtualId={tipoAtualId}
              aberta={aberta === f.id}
              onAlternar={() => setAberta(aberta === f.id ? null : f.id)}
              onDuplicar={() => duplicar(indice)}
              onExcluir={() => excluir(indice)}
            />
          ))}
        </Box>
      </DndContext>

      {fields.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Nenhuma pergunta ainda — o promotor só manda a foto (se pedida). Adicione a primeira abaixo.
        </Typography>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, mt: 1.5 }}>
        <Button
          startIcon={<AddIcon />}
          onClick={adicionar}
          sx={{ flex: 1, border: '1.5px dashed', borderColor: 'divider', borderRadius: 2, py: 1.25, fontWeight: 700 }}
        >
          Adicionar pergunta
        </Button>
        <CopiarPerguntasButton control={control} append={append} tipoAtualId={tipoAtualId} />
      </Box>

      {erroCampos && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {erroCampos}
        </Alert>
      )}
    </>
  );
}

function LinhaFoto({ control }: { control: Control<FormData> }) {
  return (
    <Controller
      name="exige_foto"
      control={control}
      render={({ field }) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, border: 1, borderColor: 'divider', borderRadius: 2, px: 1.75, py: 1.25, bgcolor: horus.subcard }}>
          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, border: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhotoCameraOutlinedIcon fontSize="small" />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              Foto
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {field.value ? 'Obrigatória — o promotor tira na hora, pela câmera' : 'Não pede foto'}
            </Typography>
          </Box>
          <FormControlLabel
            labelPlacement="start"
            control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            label={<Typography variant="body2" color="text.secondary">Pedir foto</Typography>}
          />
        </Box>
      )}
    />
  );
}

function Sigla({ tipo }: { tipo: TipoCampoRegistro }) {
  const t = tipoResposta(tipo);
  return (
    <Box
      sx={{
        width: 34,
        height: 34,
        borderRadius: 1.5,
        bgcolor: `${t.cor}14`,
        color: t.cor,
        fontSize: 12,
        fontWeight: 800,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {t.sigla}
    </Box>
  );
}

function CartaoPergunta({
  id,
  indice,
  control,
  setValue,
  getValues,
  tipoAtualId,
  aberta,
  onAlternar,
  onDuplicar,
  onExcluir,
}: {
  id: string;
  indice: number;
  control: Control<FormData>;
  setValue: UseFormSetValue<FormData>;
  getValues: UseFormGetValues<FormData>;
  tipoAtualId: string | null;
  aberta: boolean;
  onAlternar: () => void;
  onDuplicar: () => void;
  onExcluir: () => void;
}) {
  const campo = useWatch({ control, name: `campos.${indice}` });
  const todos = useWatch({ control, name: 'campos' });
  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging } = useDraggable({ id });
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id });
  const [menu, setMenu] = useState<HTMLElement | null>(null);

  if (!campo) return null;
  const condicional = !!campo.depende_de_chave;
  const pai = condicional ? todos.find((c) => c.chave === campo.depende_de_chave) : null;
  const t = tipoResposta(campo.tipo_campo);

  return (
    <Box
      ref={setDropRef}
      sx={{
        ml: condicional ? 4 : 0,
        position: 'relative',
        transform: transform ? `translate3d(0, ${transform.y}px, 0)` : undefined,
        zIndex: isDragging ? 2 : undefined,
        opacity: isDragging ? 0.85 : 1,
      }}
    >
      {condicional && (
        <Box sx={{ position: 'absolute', left: -18, top: -6, width: 14, height: 30, borderLeft: 2, borderBottom: 2, borderColor: 'divider', borderBottomLeftRadius: 6 }} />
      )}
      <Box
        sx={{
          border: 1.5,
          borderColor: aberta ? 'primary.main' : isOver ? 'primary.light' : 'divider',
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho do card (sempre visível) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1.25, cursor: 'pointer' }} onClick={onAlternar}>
          <Box
            ref={setDragRef}
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            sx={{ color: 'text.disabled', cursor: 'grab', display: 'flex' }}
            title="Arraste para reordenar"
          >
            <DragIndicatorIcon fontSize="small" />
          </Box>
          <Sigla tipo={campo.tipo_campo} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {aberta ? (
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Pergunta que o promotor vê
              </Typography>
            ) : (
              <>
                <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                  {campo.rotulo || 'Nova pergunta'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.rotulo} · {campo.obrigatorio ? 'Obrigatória' : 'Opcional'}
                </Typography>
              </>
            )}
          </Box>
          {!aberta && (
            <IconButton
              size="small"
              aria-label="Mais ações da pergunta"
              onClick={(e) => {
                e.stopPropagation();
                setMenu(e.currentTarget);
              }}
            >
              <MoreVertIcon fontSize="small" />
            </IconButton>
          )}
          {aberta ? <ExpandLessIcon color="action" /> : <ExpandMoreIcon color="action" />}
        </Box>
        <Menu anchorEl={menu} open={!!menu} onClose={() => setMenu(null)}>
          <MenuItem
            onClick={() => {
              setMenu(null);
              onDuplicar();
            }}
          >
            Duplicar
          </MenuItem>
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={() => {
              setMenu(null);
              onExcluir();
            }}
          >
            Excluir pergunta
          </MenuItem>
        </Menu>

        {aberta && (
          <Box sx={{ px: 2, pb: 1.5, mt: -0.5 }}>
            <Controller
              name={`campos.${indice}.rotulo`}
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  autoFocus
                  fullWidth
                  size="small"
                  placeholder="Ex.: Preço atual"
                  sx={{ '& input': { fontWeight: 700, fontSize: 16 } }}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  onChange={(e) => {
                    field.onChange(e.target.value);
                    // Código interno acompanha o texto só enquanto a pergunta é nova e não foi
                    // alterado à mão — pergunta salva nunca muda de código sozinha.
                    if (!getValues(`campos.${indice}.chaveFixa`)) {
                      const usadas = new Set(getValues('campos').filter((_, i) => i !== indice).map((c) => c.chave));
                      setValue(`campos.${indice}.chave`, gerarChave(e.target.value, usadas), { shouldDirty: true });
                    }
                  }}
                />
              )}
            />

            <Typography variant="body2" sx={{ fontWeight: 700, mt: 2, mb: 1 }}>
              Tipo de resposta
            </Typography>
            <Controller
              name={`campos.${indice}.tipo_campo`}
              control={control}
              render={({ field }) => (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
                  {TIPOS_RESPOSTA.map((tipo) => {
                    const ativo = field.value === tipo.valor;
                    return (
                      <Box
                        key={tipo.valor}
                        onClick={() => {
                          field.onChange(tipo.valor);
                          if (tipo.valor === 'SORTIMENTO' && !getValues(`campos.${indice}.sortimento_origem`)) {
                            setValue(`campos.${indice}.sortimento_origem`, 'FIXO', { shouldDirty: true });
                          }
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1,
                          px: 1.25,
                          py: 1,
                          borderRadius: 2,
                          border: 1.5,
                          borderColor: ativo ? 'primary.main' : 'divider',
                          bgcolor: (th) => (ativo ? alpha(th.palette.primary.main, 0.06) : th.palette.background.paper),
                          cursor: 'pointer',
                          '&:hover': { borderColor: 'primary.light' },
                        }}
                      >
                        <Box sx={{ fontSize: 11, fontWeight: 800, color: tipo.cor, bgcolor: `${tipo.cor}14`, borderRadius: 1, px: 0.75, py: 0.25 }}>
                          {tipo.sigla}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: ativo ? 700 : 500, lineHeight: 1.2 }}>
                          {tipo.rotulo}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              )}
            />

            <ConfigDoTipo control={control} setValue={setValue} indice={indice} tipo={campo.tipo_campo} tipoAtualId={tipoAtualId} />

            {/* Rodapé: obrigatória · condição · código interno · duplicar/excluir */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2, pt: 1.5, borderTop: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
              <Controller
                name={`campos.${indice}.obrigatorio`}
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    sx={{ mr: 0 }}
                    control={<Switch size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                    label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Obrigatória</Typography>}
                  />
                )}
              />
              <Box sx={{ height: 20, borderLeft: 1, borderColor: 'divider' }} />
              <Condicao control={control} setValue={setValue} indice={indice} />
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
              <CodigoInterno control={control} setValue={setValue} indice={indice} />
              <Box sx={{ flex: 1 }} />
              <Button size="small" color="inherit" onClick={onDuplicar}>
                Duplicar
              </Button>
              <Button size="small" color="error" onClick={onExcluir}>
                Excluir pergunta
              </Button>
            </Box>
          </Box>
        )}

        {!aberta && condicional && (
          <Box sx={{ px: 2, py: 0.75, bgcolor: horus.subcard, borderTop: 1, borderColor: 'divider' }}>
            <Typography variant="caption" color="primary">
              Só aparece se "{pai?.rotulo || campo.depende_de_chave}" for {rotuloValorCondicao(pai, campo.depende_de_valor)}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}

function rotuloValorCondicao(pai: CampoForm | null | undefined, valor: string | null): string {
  if (!valor) return '…';
  if (pai?.tipo_campo === 'BOOLEANO') return valor === '1' ? 'Sim' : 'Não';
  return `"${valor}"`;
}

function ConfigDoTipo({
  control,
  setValue,
  indice,
  tipo,
  tipoAtualId,
}: {
  control: Control<FormData>;
  setValue: UseFormSetValue<FormData>;
  indice: number;
  tipo: TipoCampoRegistro;
  tipoAtualId: string | null;
}) {
  if (tipo === 'MULTIPLA_ESCOLHA') return <OpcoesMultipla control={control} indice={indice} />;
  if (tipo === 'DATA') {
    return (
      <Controller
        name={`campos.${indice}.limiteDiasRetroativosTexto`}
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Aceita datas até quantos dias atrás?"
            placeholder="Vazio = sem limite"
            type="number"
            size="small"
            sx={{ mt: 2, maxWidth: 320 }}
            slotProps={{ htmlInput: { min: 0 } }}
            error={!!fieldState.error}
            helperText={fieldState.error?.message ?? 'Vazio = qualquer data (ex.: validade de produto já vencido).'}
          />
        )}
      />
    );
  }
  if (tipo === 'SORTIMENTO') return <ConfigChecklist control={control} setValue={setValue} indice={indice} tipoAtualId={tipoAtualId} />;
  return null;
}

function OpcoesMultipla({ control, indice }: { control: Control<FormData>; indice: number }) {
  const [nova, setNova] = useState('');
  return (
    <Controller
      name={`campos.${indice}.opcoesTexto`}
      control={control}
      render={({ field }) => {
        const opcoes = opcoesDoTexto(field.value);
        const salvar = (lista: string[]) => field.onChange(lista.join(', '));
        const adicionar = () => {
          const v = nova.trim().replace(/,/g, ' ');
          if (v && !opcoes.includes(v)) salvar([...opcoes, v]);
          setNova('');
        };
        return (
          <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: horus.subcard, border: 1, borderColor: 'divider' }}>
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
              Opções de resposta
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
              {opcoes.map((o) => (
                <Chip key={o} label={o} onDelete={() => salvar(opcoes.filter((x) => x !== o))} sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }} />
              ))}
              {opcoes.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  Nenhuma opção ainda.
                </Typography>
              )}
            </Box>
            <TextField
              size="small"
              value={nova}
              onChange={(e) => setNova(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  adicionar();
                }
              }}
              placeholder="Nova opção e Enter (ex.: Boa)"
              sx={{ bgcolor: 'background.paper' }}
            />
          </Box>
        );
      }}
    />
  );
}

function ConfigChecklist({
  control,
  setValue,
  indice,
  tipoAtualId,
}: {
  control: Control<FormData>;
  setValue: UseFormSetValue<FormData>;
  indice: number;
  tipoAtualId: string | null;
}) {
  const origem = useWatch({ control, name: `campos.${indice}.sortimento_origem` });
  const recorte = useWatch({ control, name: `campos.${indice}.sortimento_tipo_vinculo` });
  const [seletor, setSeletor] = useState(false);

  const secoesQuery = useQuery({ queryKey: ['secoes', { ativo: true }], queryFn: () => listarSecoes({ ativo: true }), enabled: recorte === 'SECAO' });
  const departamentosQuery = useQuery({
    queryKey: ['departamentos', { ativo: true }],
    queryFn: () => listarDepartamentos({ ativo: true }),
    enabled: recorte === 'DEPARTAMENTO',
  });
  const marcasQuery = useQuery({ queryKey: ['marcas', { ativo: true }], queryFn: () => listarMarcas({ ativo: true }), enabled: recorte === 'MARCA' });

  const opcaoOrigem = (valor: 'FIXO' | 'DINAMICO', titulo: string, sub: string) => (
    <Box
      onClick={() => {
        setValue(`campos.${indice}.sortimento_origem`, valor, { shouldDirty: true });
        setValue(`campos.${indice}.sortimento_tipo_vinculo`, valor === 'DINAMICO' ? 'SECAO' : null, { shouldDirty: true });
      }}
      sx={{
        flex: 1,
        display: 'flex',
        gap: 1,
        p: 1.25,
        borderRadius: 2,
        cursor: 'pointer',
        border: 1.5,
        borderColor: origem === valor ? 'primary.main' : 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box component="input" type="radio" readOnly checked={origem === valor} sx={{ mt: 0.4 }} />
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {titulo}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {sub}
        </Typography>
      </Box>
    </Box>
  );

  const itensRecorte =
    recorte === 'SECAO'
      ? secoesQuery.data?.secoes ?? []
      : recorte === 'DEPARTAMENTO'
        ? departamentosQuery.data?.departamentos ?? []
        : marcasQuery.data?.marcas ?? [];
  const campoRecorte =
    recorte === 'SECAO'
      ? (`campos.${indice}.sortimento_secao_uuid` as const)
      : recorte === 'DEPARTAMENTO'
        ? (`campos.${indice}.sortimento_departamento_uuid` as const)
        : (`campos.${indice}.sortimento_marca_uuid` as const);

  return (
    <Box sx={{ mt: 2, p: 1.75, borderRadius: 2, bgcolor: horus.subcard, border: 1, borderColor: 'divider' }}>
      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
        Quais produtos o promotor confere?
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {opcaoOrigem('FIXO', 'Uma lista que eu escolho', 'Sempre os mesmos, em toda loja.')}
        {opcaoOrigem('DINAMICO', 'O mix real de cada loja', 'Filtrado por seção, departamento ou marca.')}
      </Box>

      {origem === 'FIXO' && (
        <Controller
          name={`campos.${indice}.sortimento_produtos`}
          control={control}
          render={({ field }) => (
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
              {field.value.map((p) => (
                <Chip
                  key={p.uuid}
                  label={p.descricao}
                  onDelete={() => field.onChange(field.value.filter((x) => x.uuid !== p.uuid))}
                  sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}
                />
              ))}
              <Chip
                label="+ Adicionar produtos"
                onClick={() => setSeletor(true)}
                variant="outlined"
                color="primary"
                sx={{ borderStyle: 'dashed' }}
              />
              <SeletorProdutosDialog
                open={seletor}
                subtitulo="Produtos que o promotor confere neste checklist"
                jaAdicionados={new Set(field.value.map((p) => p.uuid))}
                tipoAtualId={tipoAtualId}
                onClose={() => setSeletor(false)}
                onConfirmar={(novos) => {
                  field.onChange([...field.value, ...novos]);
                  setSeletor(false);
                }}
              />
            </Box>
          )}
        />
      )}

      {origem === 'DINAMICO' && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            Só os produtos do mix da loja que forem da
          </Typography>
          <Controller
            name={`campos.${indice}.sortimento_tipo_vinculo`}
            control={control}
            render={({ field }) => (
              <TextField
                select
                size="small"
                value={field.value ?? ''}
                onChange={(e) => {
                  field.onChange(e.target.value || null);
                  setValue(`campos.${indice}.sortimento_secao_uuid`, null);
                  setValue(`campos.${indice}.sortimento_departamento_uuid`, null);
                  setValue(`campos.${indice}.sortimento_marca_uuid`, null);
                }}
                sx={{ bgcolor: 'background.paper', minWidth: 150 }}
              >
                <MenuItem value="SECAO">seção</MenuItem>
                <MenuItem value="DEPARTAMENTO">departamento</MenuItem>
                <MenuItem value="MARCA">marca</MenuItem>
              </TextField>
            )}
          />
          {recorte && (
            <Controller
              name={campoRecorte}
              control={control}
              render={({ field }) => (
                <Autocomplete
                  size="small"
                  sx={{ minWidth: 240, bgcolor: 'background.paper' }}
                  options={itensRecorte}
                  getOptionLabel={(o) => o.descricao}
                  value={itensRecorte.find((o) => o.id === field.value) ?? null}
                  onChange={(_, v) => field.onChange(v?.id ?? null)}
                  renderInput={(params) => <TextField {...params} placeholder="Escolha" />}
                />
              )}
            />
          )}
        </Box>
      )}

      <Controller
        name={`campos.${indice}.confirmar_ruptura_ausentes`}
        control={control}
        render={({ field }) => (
          <FormControlLabel
            sx={{ mt: 1, alignItems: 'flex-start' }}
            control={<Checkbox size="small" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            label={
              <Box sx={{ pt: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Produto que faltar conta como ruptura
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  O promotor confirma a lista de faltantes no fim do formulário.
                </Typography>
              </Box>
            }
          />
        )}
      />
    </Box>
  );
}

function Condicao({ control, setValue, indice }: { control: Control<FormData>; setValue: UseFormSetValue<FormData>; indice: number }) {
  const todos = useWatch({ control, name: 'campos' });
  const dependeDe = useWatch({ control, name: `campos.${indice}.depende_de_chave` });
  const valor = useWatch({ control, name: `campos.${indice}.depende_de_valor` });
  // Só perguntas ANTERIORES, com código e de um tipo que dá pra comparar.
  const candidatas = todos.slice(0, indice).filter((c) => c.chave && c.tipo_campo !== 'SORTIMENTO');

  if (!dependeDe) {
    return (
      <>
        <Typography variant="body2" color="text.secondary">
          Aparece sempre
        </Typography>
        <Button
          size="small"
          disabled={candidatas.length === 0}
          title={candidatas.length === 0 ? 'Precisa de uma pergunta antes desta' : undefined}
          onClick={() => {
            setValue(`campos.${indice}.depende_de_chave`, candidatas[candidatas.length - 1].chave, { shouldDirty: true });
            setValue(`campos.${indice}.depende_de_valor`, null, { shouldDirty: true });
          }}
        >
          + Mostrar só em certos casos
        </Button>
      </>
    );
  }

  const pai = candidatas.find((c) => c.chave === dependeDe);
  const opcoesPai = pai?.tipo_campo === 'MULTIPLA_ESCOLHA' ? opcoesDoTexto(pai.opcoesTexto) : null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
      <Typography variant="body2" color="primary" sx={{ fontWeight: 600 }}>
        Só aparece se
      </Typography>
      <TextField
        select
        size="small"
        value={pai ? dependeDe : ''}
        onChange={(e) => {
          setValue(`campos.${indice}.depende_de_chave`, e.target.value, { shouldDirty: true });
          setValue(`campos.${indice}.depende_de_valor`, null, { shouldDirty: true });
        }}
        sx={{ minWidth: 180 }}
      >
        {candidatas.map((c) => (
          <MenuItem key={c.chave} value={c.chave}>
            {c.rotulo || c.chave}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="body2" color="text.secondary">
        for
      </Typography>
      {pai?.tipo_campo === 'BOOLEANO' || opcoesPai ? (
        <TextField
          select
          size="small"
          value={valor ?? ''}
          onChange={(e) => setValue(`campos.${indice}.depende_de_valor`, e.target.value, { shouldDirty: true })}
          sx={{ minWidth: 110 }}
          error={!valor}
        >
          {pai?.tipo_campo === 'BOOLEANO'
            ? [
                <MenuItem key="1" value="1">
                  Sim
                </MenuItem>,
                <MenuItem key="0" value="0">
                  Não
                </MenuItem>,
              ]
            : opcoesPai!.map((o) => (
                <MenuItem key={o} value={o}>
                  {o}
                </MenuItem>
              ))}
        </TextField>
      ) : (
        <TextField
          size="small"
          value={valor ?? ''}
          onChange={(e) => setValue(`campos.${indice}.depende_de_valor`, e.target.value || null, { shouldDirty: true })}
          placeholder="valor"
          sx={{ width: 120 }}
          error={!valor}
        />
      )}
      <IconButton
        size="small"
        title="Aparecer sempre" aria-label="Aparecer sempre"
        onClick={() => {
          setValue(`campos.${indice}.depende_de_chave`, null, { shouldDirty: true });
          setValue(`campos.${indice}.depende_de_valor`, null, { shouldDirty: true });
        }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function CodigoInterno({ control, setValue, indice }: { control: Control<FormData>; setValue: UseFormSetValue<FormData>; indice: number }) {
  const [editando, setEditando] = useState(false);
  return (
    <Controller
      name={`campos.${indice}.chave`}
      control={control}
      render={({ field, fieldState }) =>
        editando ? (
          <TextField
            {...field}
            size="small"
            autoFocus
            label="Código interno"
            error={!!fieldState.error}
            helperText={fieldState.error?.message ?? 'minúsculas, números e _ — usado nos relatórios e exportações'}
            onChange={(e) => {
              field.onChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
              setValue(`campos.${indice}.chaveFixa`, true);
            }}
            onBlur={() => {
              field.onBlur();
              setEditando(false);
            }}
            sx={{ width: 280 }}
          />
        ) : (
          <Typography variant="caption" color={fieldState.error ? 'error' : 'text.secondary'}>
            Código interno: <Box component="code" sx={{ fontWeight: 700, color: 'text.primary' }}>{field.value || '—'}</Box>{' '}
            <Box component="span" onClick={() => setEditando(true)} sx={{ color: 'primary.main', cursor: 'pointer', ml: 0.5 }}>
              alterar
            </Box>
            {fieldState.error && ` — ${fieldState.error.message}`}
          </Typography>
        )
      }
    />
  );
}

// "Copiar de outro formulário" — traz perguntas prontas de outro formulário (cópia, não vínculo).
function CopiarPerguntasButton({
  control,
  append,
  tipoAtualId,
}: {
  control: Control<FormData>;
  append: (campo: CampoForm) => void;
  tipoAtualId: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [origemId, setOrigemId] = useState<string | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);
  const atuais = useWatch({ control, name: 'campos' });
  const chavesAtuais = useMemo(() => new Set(atuais.map((c) => c.chave)), [atuais]);

  const query = useQuery({
    queryKey: ['tipos-registro', 'copiar-perguntas'],
    queryFn: () => listarTiposRegistro({ por_pagina: 200 }),
    enabled: aberto,
  });
  const formularios = (query.data?.tipos_registro ?? []).filter((t) => t.id !== tipoAtualId && t.campos.length > 0);
  const origem = formularios.find((t) => t.id === origemId) ?? null;

  function confirmar() {
    if (!origem) return;
    let ignoradas = 0;
    for (const c of origem.campos) {
      if (!marcadas.has(c.chave)) continue;
      if (chavesAtuais.has(c.chave)) {
        ignoradas++;
        continue;
      }
      append(campoDaApi(c, false));
    }
    setAberto(false);
    setAviso(ignoradas ? `${ignoradas} pergunta(s) ignorada(s): este formulário já tem uma com o mesmo código interno.` : null);
  }

  return (
    <>
      <Button
        variant="outlined"
        color="inherit"
        sx={{ whiteSpace: 'nowrap', flexShrink: 0, borderRadius: 2, px: 2.5, fontWeight: 600, borderColor: 'divider' }}
        onClick={() => {
          setOrigemId(null);
          setMarcadas(new Set());
          setAberto(true);
        }}
      >
        Copiar de outro formulário
      </Button>
      <Snackbar open={!!aviso} autoHideDuration={6000} onClose={() => setAviso(null)}>
        <Alert severity="warning" onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      </Snackbar>
      <Dialog open={aberto} onClose={() => setAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Copiar perguntas de outro formulário</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={formularios}
            getOptionLabel={(t) => t.descricao}
            getOptionKey={(t) => t.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            loading={query.isLoading}
            value={origem}
            onChange={(_, v) => {
              setOrigemId(v?.id ?? null);
              setMarcadas(new Set());
            }}
            renderInput={(params) => <TextField {...params} label="Formulário de origem" size="small" margin="normal" />}
            noOptionsText="Nenhum outro formulário com perguntas"
          />
          {origem && (
            <List dense>
              {origem.campos.map((c) => {
                const ja = chavesAtuais.has(c.chave);
                return (
                  <ListItemButton
                    key={c.id}
                    disabled={ja}
                    onClick={() =>
                      setMarcadas((m) => {
                        const n = new Set(m);
                        if (n.has(c.chave)) n.delete(c.chave);
                        else n.add(c.chave);
                        return n;
                      })
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox edge="start" checked={marcadas.has(c.chave)} tabIndex={-1} disableRipple />
                    </ListItemIcon>
                    <ListItemText primary={c.rotulo} secondary={ja ? 'Já existe uma igual neste formulário' : tipoResposta(c.tipo_campo).rotulo} />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAberto(false)}>Cancelar</Button>
          <Button variant="contained" disabled={marcadas.size === 0} onClick={confirmar}>
            Copiar {marcadas.size > 0 ? `(${marcadas.size})` : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

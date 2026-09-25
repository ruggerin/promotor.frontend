import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { MdiIcon } from '../../components/MdiIcon';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { listarCampanhas } from '../../lib/api/campanhas';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { listarMarcas } from '../../lib/api/marcas';
import { ProdutoBuscaDialog } from '../../components/ProdutoBuscaDialog';
import { listarSecoes } from '../../lib/api/secoes';
import {
  atualizarTipoRegistro,
  buscarTipoRegistro,
  criarTipoRegistro,
  listarTiposRegistro,
} from '../../lib/api/tiposRegistro';
import type { CampoTipoRegistro, GranularidadeResposta, TipoCampoRegistro } from '../../types/api';

const TIPOS_VINCULO_SORTIMENTO: { value: 'SECAO' | 'DEPARTAMENTO' | 'MARCA'; label: string }[] = [
  { value: 'SECAO', label: 'Seção' },
  { value: 'DEPARTAMENTO', label: 'Departamento' },
  { value: 'MARCA', label: 'Marca' },
];

const GRANULARIDADES: { value: GranularidadeResposta; label: string }[] = [
  { value: 'LINHA', label: 'Linha/seção inteira' },
  { value: 'PRODUTO', label: 'Produto individual' },
];

const ESCOPOS_ACAO: { value: 'SEMPRE' | 'CAMPANHA' | 'CONTRATO'; label: string; ajuda: string }[] = [
  { value: 'SEMPRE', label: 'Sempre (toda visita)', ajuda: 'Vira pendência em toda visita de qualquer PDV.' },
  { value: 'CAMPANHA', label: 'Campanha específica', ajuda: 'Só nas visitas vinculadas à campanha escolhida abaixo.' },
  {
    value: 'CONTRATO',
    label: 'PDV com contrato ativo',
    ajuda: 'Só quando o ponto de venda tem um contrato (comodato de expositor, ponto extra) ativo.',
  },
];

const TIPOS_CAMPO: { value: TipoCampoRegistro; label: string }[] = [
  { value: 'TEXTO', label: 'Texto' },
  { value: 'NUMERO', label: 'Número' },
  { value: 'MOEDA', label: 'Valor (R$)' },
  { value: 'MULTIPLA_ESCOLHA', label: 'Múltipla escolha' },
  { value: 'BOOLEANO', label: 'Sim/Não' },
  { value: 'DATA', label: 'Data' },
  { value: 'SORTIMENTO', label: 'Mix (checklist de produtos)' },
];

const campoSchema = z.object({
  chave: z
    .string()
    .min(1, 'Obrigatório')
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Só minúsculas, números e underscore (ex.: quantidade).'),
  rotulo: z.string().min(1, 'Obrigatório').max(255),
  tipo_campo: z.enum(['NUMERO', 'TEXTO', 'MOEDA', 'MULTIPLA_ESCOLHA', 'BOOLEANO', 'DATA', 'SORTIMENTO']),
  // Opções de MULTIPLA_ESCOLHA como texto separado por vírgula — convertido pra array só no
  // envio (payload.campos[].opcoes), mais simples que uma mini-lista editável dentro do array.
  opcoesTexto: z.string(),
  obrigatorio: z.boolean(),
  // Só tem efeito quando tipo_campo = DATA (docs/35-LIMITE-RETROATIVO-CAMPO-DATA.md) — string
  // vazia = sem limite, mesmo padrão de "numero_checkouts" (PontoVendaFormDialog): convertido
  // pra número (ou null) só no payload de envio.
  limiteDiasRetroativosTexto: z
    .string()
    .refine((v) => v === '' || (!Number.isNaN(Number(v)) && Number.isInteger(Number(v)) && Number(v) >= 0), 'Deve ser um número inteiro positivo'),
  // Campo condicional (docs/20-FORMULARIO-DINAMICO-CAMPANHA.md decisão 7) — `depende_de_chave`
  // referencia a `chave` de outro campo deste MESMO array (não um uuid, o campo pai pode ser
  // novo, ainda sem id). `null` = sempre aparece, sem condição.
  depende_de_chave: z.string().nullable(),
  depende_de_valor: z.string().nullable(),
  // Campo SORTIMENTO (decisão 3) — só usado quando tipo_campo = SORTIMENTO.
  sortimento_origem: z.enum(['DINAMICO', 'FIXO']).nullable(),
  sortimento_tipo_vinculo: z.enum(['SECAO', 'DEPARTAMENTO', 'MARCA']).nullable(),
  sortimento_secao_uuid: z.string().nullable(),
  sortimento_departamento_uuid: z.string().nullable(),
  sortimento_marca_uuid: z.string().nullable(),
  sortimento_produtos: z.array(z.object({ uuid: z.string(), descricao: z.string() })),
  confirmar_ruptura_ausentes: z.boolean(),
});

const excecaoGranularidadeSchema = z.object({
  secao_uuid: z.string().min(1, 'Escolha a seção'),
  granularidade: z.enum(['LINHA', 'PRODUTO']),
});

const schema = z
  .object({
    descricao: z.string().min(1, 'Obrigatório').max(255),
    // Slug do Material Design Icons — validação de formato fica a cargo do backend (aceita com
    // ou sem prefixo "mdi-"/"mdi:", normaliza); aqui só garante que não veio vazio disfarçado.
    icone: z.string().nullable(),
    exige_foto: z.boolean(),
    permite_vincular_catalogo: z.boolean(),
    ativo: z.boolean(),
    acao_obrigatoria: z.boolean(),
    escopo_acao: z.enum(['SEMPRE', 'CAMPANHA', 'CONTRATO']).nullable(),
    campanha_auditoria_uuid: z.string().nullable(),
    granularidade_padrao: z.enum(['LINHA', 'PRODUTO']).nullable(),
    excecoes_granularidade: z.array(excecaoGranularidadeSchema),
    eh_ruptura: z.boolean(),
    eh_alerta: z.boolean(),
    usa_pontuacao: z.boolean(),
    disponivel_registro_livre: z.boolean(),
    campos: z.array(campoSchema),
  })
  .refine((data) => !data.acao_obrigatoria || data.escopo_acao !== null, {
    message: 'Escolha quando essa ação aparece.',
    path: ['escopo_acao'],
  })
  .refine((data) => data.escopo_acao !== 'CAMPANHA' || !!data.campanha_auditoria_uuid, {
    message: 'Escolha a campanha.',
    path: ['campanha_auditoria_uuid'],
  })
  // Campo condicional (decisão 7) — só pode depender de um campo ANTERIOR neste mesmo array
  // (a cadeia sempre desce), mesma regra que o backend valida em StoreTipoRegistroRequest.
  .refine(
    (data) =>
      data.campos.every(
        (c, i) => !c.depende_de_chave || data.campos.slice(0, i).some((anterior) => anterior.chave === c.depende_de_chave),
      ),
    { message: 'Um campo condicional só pode depender de um campo anterior no formulário.', path: ['campos'] },
  )
  .refine((data) => data.campos.every((c) => !c.depende_de_chave || !!c.depende_de_valor), {
    message: 'Escolha o valor que libera a pergunta condicional.',
    path: ['campos'],
  })
  // Campo SORTIMENTO (decisão 3) — origem obrigatória; dinâmico exige o recorte (tipo +
  // seção/departamento/marca correspondente); fixo exige pelo menos 1 produto na lista curada.
  .refine((data) => data.campos.every((c) => c.tipo_campo !== 'SORTIMENTO' || !!c.sortimento_origem), {
    message: 'Escolha a origem da lista de produtos (dinâmica ou fixa).',
    path: ['campos'],
  })
  .refine(
    (data) => data.campos.every((c) => c.sortimento_origem !== 'DINAMICO' || !!c.sortimento_tipo_vinculo),
    { message: 'Escolha o recorte do catálogo (seção, departamento ou marca).', path: ['campos'] },
  )
  .refine(
    (data) =>
      data.campos.every((c) => {
        if (c.sortimento_origem !== 'DINAMICO') return true;
        if (c.sortimento_tipo_vinculo === 'SECAO') return !!c.sortimento_secao_uuid;
        if (c.sortimento_tipo_vinculo === 'DEPARTAMENTO') return !!c.sortimento_departamento_uuid;
        if (c.sortimento_tipo_vinculo === 'MARCA') return !!c.sortimento_marca_uuid;
        return true;
      }),
    { message: 'Escolha a seção/departamento/marca do recorte.', path: ['campos'] },
  )
  .refine((data) => data.campos.every((c) => c.sortimento_origem !== 'FIXO' || c.sortimento_produtos.length > 0), {
    message: 'Escolha pelo menos um produto pra lista curada do campo fixo.',
    path: ['campos'],
  });

type FormData = z.infer<typeof schema>;

const DEFAULT_VALUES: FormData = {
  descricao: '',
  icone: null,
  exige_foto: false,
  permite_vincular_catalogo: false,
  ativo: true,
  acao_obrigatoria: false,
  escopo_acao: null,
  campanha_auditoria_uuid: null,
  granularidade_padrao: null,
  excecoes_granularidade: [],
  eh_ruptura: false,
  eh_alerta: false,
  usa_pontuacao: false,
  disponivel_registro_livre: true,
  campos: [],
};

interface CampanhaContexto {
  uuid: string;
  descricao: string;
}

/**
 * Autoria embutida na Campanha (Fase 3, §3 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md) — quando
 * a página abre a partir da tela de Campanha (via `location.state.campanhaContexto`, não da lista
 * genérica de Formulários), o tipo novo já nasce com `escopo_acao=CAMPANHA` + a campanha em
 * questão + `acao_obrigatoria=true` + `disponivel_registro_livre=false` (não polui o dropdown de
 * registro livre do promotor) — o gestor pode reverter qualquer um desses defaults no próprio
 * formulário, é só um ponto de partida mais direto. Por baixo continua sendo o mesmo
 * TipoRegistro/mesmo endpoint de sempre.
 */
function valoresIniciais(campanhaContexto: CampanhaContexto | null): FormData {
  if (!campanhaContexto) return DEFAULT_VALUES;

  return {
    ...DEFAULT_VALUES,
    acao_obrigatoria: true,
    escopo_acao: 'CAMPANHA',
    campanha_auditoria_uuid: campanhaContexto.uuid,
    disponivel_registro_livre: false,
  };
}

function campoVazio(): FormData['campos'][number] {
  return {
    chave: '',
    rotulo: '',
    tipo_campo: 'TEXTO',
    opcoesTexto: '',
    obrigatorio: false,
    limiteDiasRetroativosTexto: '',
    depende_de_chave: null,
    depende_de_valor: null,
    sortimento_origem: null,
    sortimento_tipo_vinculo: null,
    sortimento_secao_uuid: null,
    sortimento_departamento_uuid: null,
    sortimento_marca_uuid: null,
    sortimento_produtos: [],
    confirmar_ruptura_ausentes: false,
  };
}

function excecaoVazia(): FormData['excecoes_granularidade'][number] {
  return { secao_uuid: '', granularidade: 'PRODUTO' };
}

/**
 * Traz um campo já cadastrado em OUTRO tipo de registro pra dentro deste formulário — cópia
 * pontual (mesmo raciocínio de "Duplicar", decisão 6 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md:
 * clonar, não um modelo vivo/sincronizado entre os dois tipos daqui em diante).
 * `depende_de_chave` nunca é trazido: ele referencia a chave de um campo ANTERIOR no array de
 * ORIGEM, que pode nem existir neste formulário (ou existir em outra ordem) — importar sem o
 * vínculo é a única opção sempre segura; o usuário reconstrói a condição aqui se quiser.
 */
function mapearCampoParaImportar(campo: CampoTipoRegistro): FormData['campos'][number] {
  return {
    chave: campo.chave,
    rotulo: campo.rotulo,
    tipo_campo: campo.tipo_campo,
    opcoesTexto: campo.opcoes?.join(', ') ?? '',
    obrigatorio: campo.obrigatorio,
    limiteDiasRetroativosTexto: campo.limite_dias_retroativos === null ? '' : String(campo.limite_dias_retroativos),
    depende_de_chave: null,
    depende_de_valor: null,
    sortimento_origem: campo.sortimento_origem,
    sortimento_tipo_vinculo: campo.sortimento_tipo_vinculo,
    sortimento_secao_uuid: campo.sortimento_secao?.id ?? null,
    sortimento_departamento_uuid: campo.sortimento_departamento?.id ?? null,
    sortimento_marca_uuid: campo.sortimento_marca?.id ?? null,
    sortimento_produtos: campo.sortimento_produtos.map((p) => ({ uuid: p.id, descricao: p.descricao })),
    confirmar_ruptura_ausentes: campo.confirmar_ruptura_ausentes,
  };
}

/**
 * Página única de cadastro + edição de Formulário (TipoRegistro) — substitui o antigo modal
 * `TipoRegistroFormDialog`. Decisão do usuário: um formulário tem campos e regras demais pra
 * caber num diálogo pequeno, e a edição merece o mesmo tratamento de tela cheia que Contrato já
 * tem (ver ContratoDetailPage). Rota `/tipos-registro/novo` (sem :publicId) cria, `/tipos-registro/:publicId`
 * edita — mesma convenção.
 *
 * Contexto de Campanha (criar/editar um formulário a partir da tela de uma Campanha) chega via
 * `location.state.campanhaContexto` em vez de prop — não tem outra forma de carregar estado ao
 * navegar de uma página pra outra. Ausente = fluxo genérico da lista de Formulários.
 */
export function TipoRegistroFormPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const modoCriacao = publicId === undefined;
  const campanhaContexto = (location.state as { campanhaContexto?: CampanhaContexto } | null)?.campanhaContexto ?? null;
  const voltarPara = campanhaContexto ? `/campanhas/${campanhaContexto.uuid}` : '/tipos-registro';

  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const tipoQuery = useQuery({
    queryKey: ['tipos-registro', publicId],
    queryFn: () => buscarTipoRegistro(publicId as string),
    enabled: !modoCriacao,
  });
  const tipo = tipoQuery.data?.tipo_registro ?? null;

  const cabecalho = usePageHeader(
    modoCriacao || tipo ? (
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        {modoCriacao ? (campanhaContexto ? `Novo formulário — ${campanhaContexto.descricao}` : 'Novo formulário') : tipo!.descricao}
      </Typography>
    ) : null,
  );

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, isDirty, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: valoresIniciais(campanhaContexto) });

  const { fields, append, remove } = useFieldArray({ control, name: 'campos' });
  const {
    fields: excecoesFields,
    append: appendExcecao,
    remove: removeExcecao,
  } = useFieldArray({ control, name: 'excecoes_granularidade' });

  useEffect(() => {
    if (modoCriacao) {
      reset(valoresIniciais(campanhaContexto));
      return;
    }
    if (tipo) {
      reset({
        descricao: tipo.descricao,
        icone: tipo.icone,
        exige_foto: tipo.exige_foto,
        permite_vincular_catalogo: tipo.permite_vincular_catalogo,
        ativo: tipo.ativo,
        acao_obrigatoria: tipo.acao_obrigatoria,
        escopo_acao: tipo.escopo_acao,
        campanha_auditoria_uuid: tipo.campanha_auditoria_uuid,
        granularidade_padrao: tipo.granularidade_padrao,
        excecoes_granularidade: tipo.excecoes_granularidade.map((e) => ({
          secao_uuid: e.secao_uuid,
          granularidade: e.granularidade,
        })),
        eh_ruptura: tipo.eh_ruptura,
        eh_alerta: tipo.eh_alerta,
        usa_pontuacao: tipo.usa_pontuacao,
        disponivel_registro_livre: tipo.disponivel_registro_livre,
        campos: tipo.campos.map((c) => ({
          chave: c.chave,
          rotulo: c.rotulo,
          tipo_campo: c.tipo_campo,
          opcoesTexto: c.opcoes?.join(', ') ?? '',
          obrigatorio: c.obrigatorio,
          limiteDiasRetroativosTexto: c.limite_dias_retroativos === null ? '' : String(c.limite_dias_retroativos),
          depende_de_chave: c.depende_de_chave,
          depende_de_valor: c.depende_de_valor,
          sortimento_origem: c.sortimento_origem,
          sortimento_tipo_vinculo: c.sortimento_tipo_vinculo,
          sortimento_secao_uuid: c.sortimento_secao?.id ?? null,
          sortimento_departamento_uuid: c.sortimento_departamento?.id ?? null,
          sortimento_marca_uuid: c.sortimento_marca?.id ?? null,
          sortimento_produtos: c.sortimento_produtos.map((p) => ({ uuid: p.id, descricao: p.descricao })),
          confirmar_ruptura_ausentes: c.confirmar_ruptura_ausentes,
        })),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoCriacao, tipo, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        descricao: data.descricao,
        icone: data.icone,
        exige_foto: data.exige_foto,
        permite_vincular_catalogo: data.permite_vincular_catalogo,
        acao_obrigatoria: data.acao_obrigatoria,
        escopo_acao: data.acao_obrigatoria ? data.escopo_acao : null,
        campanha_auditoria_uuid: data.escopo_acao === 'CAMPANHA' ? data.campanha_auditoria_uuid : null,
        granularidade_padrao: data.granularidade_padrao,
        excecoes_granularidade: data.excecoes_granularidade,
        eh_ruptura: data.eh_ruptura,
        eh_alerta: data.eh_alerta,
        usa_pontuacao: data.usa_pontuacao,
        disponivel_registro_livre: data.disponivel_registro_livre,
        campos: data.campos.map((c) => ({
          chave: c.chave,
          rotulo: c.rotulo,
          tipo_campo: c.tipo_campo,
          obrigatorio: c.obrigatorio,
          limite_dias_retroativos:
            c.tipo_campo === 'DATA' && c.limiteDiasRetroativosTexto !== '' ? Number(c.limiteDiasRetroativosTexto) : null,
          opcoes:
            c.tipo_campo === 'MULTIPLA_ESCOLHA'
              ? c.opcoesTexto
                  .split(',')
                  .map((o) => o.trim())
                  .filter(Boolean)
              : undefined,
          depende_de_chave: c.depende_de_chave,
          depende_de_valor: c.depende_de_chave ? c.depende_de_valor : null,
          sortimento_origem: c.tipo_campo === 'SORTIMENTO' ? c.sortimento_origem : null,
          sortimento_tipo_vinculo: c.sortimento_origem === 'DINAMICO' ? c.sortimento_tipo_vinculo : null,
          sortimento_secao_uuid: c.sortimento_tipo_vinculo === 'SECAO' ? c.sortimento_secao_uuid : null,
          sortimento_departamento_uuid: c.sortimento_tipo_vinculo === 'DEPARTAMENTO' ? c.sortimento_departamento_uuid : null,
          sortimento_marca_uuid: c.sortimento_tipo_vinculo === 'MARCA' ? c.sortimento_marca_uuid : null,
          sortimento_produtos_uuids: c.sortimento_origem === 'FIXO' ? c.sortimento_produtos.map((p) => p.uuid) : undefined,
          confirmar_ruptura_ausentes: c.tipo_campo === 'SORTIMENTO' ? c.confirmar_ruptura_ausentes : false,
        })),
      };

      if (!modoCriacao) {
        return atualizarTipoRegistro(tipo!.id, { ...payload, ativo: data.ativo });
      }
      return criarTipoRegistro(payload);
    },
    onSuccess: () => {
      setErroGeral(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
      if (modoCriacao) {
        // Formulário criado a partir de uma Campanha volta pra ela (é lá que a lista de
        // formulários daquela campanha aparece); o fluxo genérico volta pra lista de Formulários
        // — diferente de Contrato, aqui não há mais nada nesta página depois de criar.
        navigate(voltarPara);
        return;
      }
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro', publicId] });
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string }>(err) && err.response?.status === 422) {
        setErroGeral(err.response.data.message ?? 'Não foi possível salvar — confira os campos abaixo.');
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  if (!modoCriacao && tipoQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!modoCriacao && (tipoQuery.isError || !tipo)) {
    return <Typography color="error">Formulário não encontrado.</Typography>;
  }

  return (
    <Box>
      {cabecalho}

      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(voltarPara)} sx={{ mb: 2 }}>
        Voltar
      </Button>

      {erroGeral && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {erroGeral}
        </Alert>
      )}

      <Paper sx={{ p: 3 }}>
        <Box component="form" onSubmit={(e) => void handleSubmit((data) => mutation.mutate(data))(e)} noValidate>
          <Controller
            name="descricao"
            control={control}
            render={({ field, fieldState }) => (
              <TextField
                {...field}
                label="Nome do tipo"
                placeholder="Ex.: Ponto extra, Ação da concorrência"
                fullWidth
                margin="normal"
                error={!!fieldState.error}
                helperText={fieldState.error?.message}
                autoFocus
              />
            )}
          />

          <Controller
            name="icone"
            control={control}
            render={({ field, fieldState }) => (
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  label="Ícone"
                  placeholder="Ex.: camera, alert, arrow-right"
                  fullWidth
                  margin="normal"
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message ?? 'Código do Material Design Icons, com ou sem o prefixo "mdi-".'}
                />
                <Box sx={{ display: 'flex', alignItems: 'center', height: 56, mt: 2 }}>
                  <MdiIcon icone={field.value} size={32} />
                </Box>
              </Box>
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1, mb: 1 }}>
            Aparece no admin e no app do promotor.{' '}
            <Link href="https://pictogrammers.com/library/mdi/" target="_blank" rel="noreferrer">
              Ver códigos disponíveis
            </Link>
            .
          </Typography>

          <Controller
            name="exige_foto"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Exige foto"
              />
            )}
          />
          <Controller
            name="permite_vincular_catalogo"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ display: 'block' }}
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Permite vincular a produto/seção/departamento/marca"
              />
            )}
          />
          {!modoCriacao && (
            <Controller
              name="ativo"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  sx={{ display: 'block' }}
                  control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                  label="Ativo"
                />
              )}
            />
          )}

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Ação
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Uma ação obrigatória aparece como pendência na aba "Ações" da visita, no app do
            promotor — diferente de um tipo comum, que só fica disponível como opção no Registro
            geral.
          </Typography>
          <Controller
            name="acao_obrigatoria"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ display: 'block' }}
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="É uma ação obrigatória"
              />
            )}
          />
          <CamposDeEscopoAcao control={control} />

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Granularidade da resposta
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Se essa pergunta precisa de uma resposta por produto individual, ou se uma resposta
            só já cobre a linha/seção inteira. "Sem regra" mantém o comportamento livre de hoje —
            o promotor escolhe o vínculo. Ver docs/16-GRANULARIDADE-CHECKLIST-AUDITORIA.md.
          </Typography>
          <Controller
            name="granularidade_padrao"
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value || null)}
                select
                label="Padrão desta pergunta"
                fullWidth
                margin="normal"
              >
                <MenuItem value="">Sem regra (promotor escolhe)</MenuItem>
                {GRANULARIDADES.map((g) => (
                  <MenuItem key={g.value} value={g.value}>
                    {g.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
            Exceções por seção (opcional) — sobrepõe o padrão acima só pra essa seção. Ex.: padrão
            "Linha inteira", mas uma seção com subcategorias reais (tipo Pilhas) exige "Produto
            individual".
          </Typography>
          {excecoesFields.map((excecaoField, indice) => (
            <ExcecaoGranularidadeRow
              key={excecaoField.id}
              control={control}
              indice={indice}
              onRemover={() => removeExcecao(indice)}
            />
          ))}
          <Button startIcon={<AddIcon />} onClick={() => appendExcecao(excecaoVazia())} sx={{ mt: 1 }}>
            Adicionar exceção por seção
          </Button>

          <Controller
            name="eh_ruptura"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ display: 'block', mt: 2 }}
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label='Esta é a pergunta "Ruptura" da grade de coleta'
              />
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
            Sempre a primeira coluna da grade (Fase 2) — marcar um produto em ruptura tira ele das
            demais colunas da mesma linha. Toda empresa já nasce com o tipo "Ruptura" marcado.
          </Typography>

          <Controller
            name="eh_alerta"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ display: 'block', mt: 1 }}
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Gera alerta no Painel de Atividades"
              />
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
            Todo registro deste tipo aparece destacado na timeline de Atividades (ver menu
            "Atividades"), pra pedir ação imediata — ex.: Ruptura, Avaria, Vencimento próximo,
            Ação da concorrência.
          </Typography>

          <Controller
            name="disponivel_registro_livre"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ display: 'block', mt: 1 }}
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Aparece solto no Registro geral do promotor"
              />
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
            Desligado, esse tipo só aparece via Ação obrigatória ou formulário de campanha — evita
            duplicar a mesma pendência no dropdown geral (decisão 8 de
            docs/20-FORMULARIO-DINAMICO-CAMPANHA.md).
          </Typography>

          <Controller
            name="usa_pontuacao"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                sx={{ display: 'block', mt: 1 }}
                control={<Switch checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                label="Calcula % de compliance deste formulário"
              />
            )}
          />
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
            % de campos "Sim/Não" e "Mix" que passaram (Sim / mix 100% presente), sobre o
            total do formulário — sem peso por pergunta ainda.
          </Typography>

          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" gutterBottom>
            Campos extras do formulário
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Além da foto, o promotor preenche esses campos no app ao registrar esse tipo. Ex.:
            "Quantidade" (número) e "Valor" (R$) pra um Ponto extra.
          </Typography>

          {fields.map((campoField, indice) => (
            <Box
              key={campoField.id}
              sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1, p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}
            >
              <Box sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Controller
                    name={`campos.${indice}.rotulo`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Rótulo"
                        placeholder="Ex.: Quantidade"
                        size="small"
                        fullWidth
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                      />
                    )}
                  />
                  <Controller
                    name={`campos.${indice}.chave`}
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        label="Chave"
                        placeholder="Ex.: quantidade"
                        size="small"
                        fullWidth
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message ?? 'minúsculas/números/_'}
                      />
                    )}
                  />
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1 }}>
                  <Controller
                    name={`campos.${indice}.tipo_campo`}
                    control={control}
                    render={({ field }) => (
                      <TextField {...field} select label="Tipo" size="small" sx={{ minWidth: 160 }}>
                        {TIPOS_CAMPO.map((t) => (
                          <MenuItem key={t.value} value={t.value}>
                            {t.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                  <Controller
                    name={`campos.${indice}.obrigatorio`}
                    control={control}
                    render={({ field }) => (
                      <FormControlLabel
                        control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                        label="Obrigatório"
                      />
                    )}
                  />
                </Box>
                <FieldTipoCampoWatcher control={control} indice={indice} />
                <CampoSortimentoFields control={control} indice={indice} setValue={setValue} />
                <CampoCondicionalFields control={control} indice={indice} setValue={setValue} />
              </Box>
              <IconButton size="small" onClick={() => remove(indice)} sx={{ mt: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
            <Button startIcon={<AddIcon />} onClick={() => append(campoVazio())}>
              Adicionar campo
            </Button>
            <ImportarCamposButton control={control} append={append} tipoAtualId={tipo?.id ?? null} />
          </Box>
          {errors.campos?.message && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.campos.message}
            </Alert>
          )}

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
            <Button type="submit" variant="contained" disabled={isSubmitting || (!modoCriacao && !isDirty)}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

// "Importar campos de outro tipo" — reaproveita campos já cadastrados noutro TipoRegistro sem
// reconfigurar tudo de novo (ver mapearCampoParaImportar). Não é um modelo vivo/sincronizado
// (mesma decisão 6 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md que rejeitou isso pra "Duplicar")
// — é só um atalho que preenche o array `campos` deste formulário a partir de outro; o usuário
// ainda ajusta/remove o que quiser antes de salvar.
function ImportarCamposButton({
  control,
  append,
  tipoAtualId,
}: {
  control: Control<FormData>;
  append: (campo: FormData['campos'][number]) => void;
  tipoAtualId: string | null;
}) {
  const [aberto, setAberto] = useState(false);
  const [tipoOrigemId, setTipoOrigemId] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [aviso, setAviso] = useState<string | null>(null);

  const camposAtuais = useWatch({ control, name: 'campos' });
  const chavesAtuais = useMemo(() => new Set(camposAtuais.map((c) => c.chave)), [camposAtuais]);

  const tiposQuery = useQuery({
    queryKey: ['tipos-registro', 'importar-campos'],
    queryFn: () => listarTiposRegistro(),
    enabled: aberto,
  });

  // Nunca a si mesmo (editar um tipo importando dele mesmo não faz sentido) e só quem tem campo.
  const tiposComCampos = (tiposQuery.data?.tipos_registro ?? []).filter(
    (t) => t.id !== tipoAtualId && t.campos.length > 0,
  );
  const tipoOrigem = tiposComCampos.find((t) => t.id === tipoOrigemId) ?? null;

  function abrir() {
    setTipoOrigemId(null);
    setSelecionadas(new Set());
    setAviso(null);
    setAberto(true);
  }

  function alternar(chave: string) {
    setSelecionadas((atual) => {
      const novo = new Set(atual);
      if (novo.has(chave)) novo.delete(chave);
      else novo.add(chave);
      return novo;
    });
  }

  function confirmar() {
    if (!tipoOrigem) return;
    let ignorados = 0;
    for (const campo of tipoOrigem.campos) {
      if (!selecionadas.has(campo.chave)) continue;
      // Chave duplicada quebraria a validação de unicidade do formulário atual — em vez de
      // deixar o usuário descobrir isso só depois de salvar, já ignora aqui e avisa.
      if (chavesAtuais.has(campo.chave)) {
        ignorados += 1;
        continue;
      }
      append(mapearCampoParaImportar(campo));
    }
    setAberto(false);
    setAviso(ignorados > 0 ? `${ignorados} campo(s) ignorado(s) por já existir uma chave igual neste formulário.` : null);
  }

  return (
    <>
      <Button startIcon={<LibraryAddIcon />} onClick={abrir}>
        Importar campos de outro tipo
      </Button>
      {aviso && (
        <Alert severity="warning" sx={{ width: '100%', mt: 1 }} onClose={() => setAviso(null)}>
          {aviso}
        </Alert>
      )}

      <Dialog open={aberto} onClose={() => setAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Importar campos de outro tipo</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={tiposComCampos}
            getOptionLabel={(t) => t.descricao}
            getOptionKey={(t) => t.id}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            loading={tiposQuery.isLoading}
            value={tipoOrigem}
            onChange={(_, valor) => {
              setTipoOrigemId(valor?.id ?? null);
              setSelecionadas(new Set());
            }}
            renderInput={(params) => <TextField {...params} label="Tipo de origem" size="small" margin="normal" />}
            noOptionsText="Nenhum outro tipo com campos cadastrados"
          />

          {tipoOrigem && (
            <List dense sx={{ mt: 1 }}>
              {tipoOrigem.campos.map((campo) => {
                const jaExiste = chavesAtuais.has(campo.chave);
                return (
                  <ListItemButton key={campo.id} onClick={() => !jaExiste && alternar(campo.chave)} disabled={jaExiste}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <Checkbox edge="start" checked={selecionadas.has(campo.chave)} tabIndex={-1} disableRipple />
                    </ListItemIcon>
                    <ListItemText
                      primary={campo.rotulo}
                      secondary={jaExiste ? `${campo.chave} — já existe neste formulário` : campo.chave}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAberto(false)}>Cancelar</Button>
          <Button variant="contained" disabled={selecionadas.size === 0} onClick={confirmar}>
            Importar {selecionadas.size > 0 ? `(${selecionadas.size})` : ''}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// Mesmo raciocínio de FieldTipoCampoWatcher abaixo: isolado pra usar `watch` só nos campos de
// escopo, sem re-render do formulário inteiro a cada tecla digitada em outro lugar.
function CamposDeEscopoAcao({ control }: { control: Control<FormData> }) {
  const acaoObrigatoria = useWatch({ control, name: 'acao_obrigatoria' });
  const escopoAcao = useWatch({ control, name: 'escopo_acao' });

  const campanhasQuery = useQuery({
    queryKey: ['campanhas', { ativo: true }],
    queryFn: () => listarCampanhas(true),
    enabled: acaoObrigatoria && escopoAcao === 'CAMPANHA',
  });

  if (!acaoObrigatoria) return null;

  return (
    <Box sx={{ pl: 1, borderLeft: '2px solid', borderColor: 'divider', ml: 1, mt: 1 }}>
      <Controller
        name="escopo_acao"
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            select
            label="Quando essa ação aparece"
            fullWidth
            margin="normal"
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          >
            {ESCOPOS_ACAO.map((e) => (
              <MenuItem key={e.value} value={e.value}>
                {e.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      {escopoAcao && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1, mb: 1 }}>
          {ESCOPOS_ACAO.find((e) => e.value === escopoAcao)?.ajuda}
        </Typography>
      )}

      {escopoAcao === 'CAMPANHA' && (
        <Controller
          name="campanha_auditoria_uuid"
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              select
              label="Campanha"
              fullWidth
              margin="normal"
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
              disabled={campanhasQuery.isLoading}
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
      )}
    </Box>
  );
}

// Uma linha da lista de exceções de granularidade — seção + granularidade + remover. Busca a
// lista de seções uma vez (cache compartilhado entre as linhas, mesma queryKey).
function ExcecaoGranularidadeRow({
  control,
  indice,
  onRemover,
}: {
  control: Control<FormData>;
  indice: number;
  onRemover: () => void;
}) {
  const secoesQuery = useQuery({
    queryKey: ['secoes', { ativo: true }],
    queryFn: () => listarSecoes({ ativo: true }),
  });

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 1 }}>
      <Controller
        name={`excecoes_granularidade.${indice}.secao_uuid`}
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            select
            label="Seção"
            size="small"
            fullWidth
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
            disabled={secoesQuery.isLoading}
          >
            {(secoesQuery.data?.secoes ?? []).map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.descricao}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <Controller
        name={`excecoes_granularidade.${indice}.granularidade`}
        control={control}
        render={({ field }) => (
          <TextField {...field} select label="Granularidade" size="small" sx={{ minWidth: 180 }}>
            {GRANULARIDADES.map((g) => (
              <MenuItem key={g.value} value={g.value}>
                {g.label}
              </MenuItem>
            ))}
          </TextField>
        )}
      />
      <IconButton size="small" onClick={onRemover} sx={{ mt: 0.5 }}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

// Só mostra o campo de opções quando o tipo escolhido pra esse campo é MULTIPLA_ESCOLHA —
// isolado num componente próprio pra poder usar `watch` só neste campo do array, sem re-render
// do formulário inteiro a cada tecla digitada em outro lugar.
function FieldTipoCampoWatcher({ control, indice }: { control: Control<FormData>; indice: number }) {
  const tipoCampo = useWatch({ control, name: `campos.${indice}.tipo_campo` });

  if (tipoCampo === 'MULTIPLA_ESCOLHA') {
    return (
      <Controller
        name={`campos.${indice}.opcoesTexto`}
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Opções (separadas por vírgula)"
            placeholder="Ex.: Boa, Regular, Ruim"
            size="small"
            fullWidth
            sx={{ mt: 1 }}
            error={!!fieldState.error}
            helperText={fieldState.error?.message}
          />
        )}
      />
    );
  }

  if (tipoCampo === 'DATA') {
    return (
      <Controller
        name={`campos.${indice}.limiteDiasRetroativosTexto`}
        control={control}
        render={({ field, fieldState }) => (
          <TextField
            {...field}
            label="Limite de dias no passado"
            placeholder="Deixe vazio para sem limite"
            type="number"
            size="small"
            sx={{ mt: 1, maxWidth: 260 }}
            slotProps={{ htmlInput: { min: 0 } }}
            error={!!fieldState.error}
            helperText={fieldState.error?.message ?? 'Datas mais antigas que isso não são aceitas. Deixe vazio para sem limite (ex.: campo de validade de produto vencido).'}
          />
        )}
      />
    );
  }

  return null;
}

// Campo SORTIMENTO (docs/20-FORMULARIO-DINAMICO-CAMPANHA.md decisão 3) — origem (dinâmica/fixa),
// recorte do catálogo quando dinâmica, lista curada quando fixa, switch de ruptura confirmada.
// Isolado num componente próprio (mesmo raciocínio de FieldTipoCampoWatcher) pra usar `watch` só
// aqui, sem re-render do formulário inteiro.
function CampoSortimentoFields({
  control,
  indice,
  setValue,
}: {
  control: Control<FormData>;
  indice: number;
  setValue: UseFormSetValue<FormData>;
}) {
  const tipoCampo = useWatch({ control, name: `campos.${indice}.tipo_campo` });
  const origem = useWatch({ control, name: `campos.${indice}.sortimento_origem` });
  const tipoVinculo = useWatch({ control, name: `campos.${indice}.sortimento_tipo_vinculo` });
  const [buscaProdutoAberta, setBuscaProdutoAberta] = useState(false);

  const secoesQuery = useQuery({
    queryKey: ['secoes', { ativo: true }],
    queryFn: () => listarSecoes({ ativo: true }),
    enabled: tipoVinculo === 'SECAO',
  });
  const departamentosQuery = useQuery({
    queryKey: ['departamentos', { ativo: true }],
    queryFn: () => listarDepartamentos({ ativo: true }),
    enabled: tipoVinculo === 'DEPARTAMENTO',
  });
  const marcasQuery = useQuery({
    queryKey: ['marcas', { ativo: true }],
    queryFn: () => listarMarcas({ ativo: true }),
    enabled: tipoVinculo === 'MARCA',
  });
  if (tipoCampo !== 'SORTIMENTO') return null;

  return (
    <Box sx={{ mt: 1, p: 1.5, border: '1px dashed', borderColor: 'divider', borderRadius: 1 }}>
      <Controller
        name={`campos.${indice}.sortimento_origem`}
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            onChange={(e) => {
              field.onChange(e.target.value || null);
              setValue(`campos.${indice}.sortimento_tipo_vinculo`, null);
              setValue(`campos.${indice}.sortimento_secao_uuid`, null);
              setValue(`campos.${indice}.sortimento_departamento_uuid`, null);
              setValue(`campos.${indice}.sortimento_marca_uuid`, null);
              setValue(`campos.${indice}.sortimento_produtos`, []);
            }}
            select
            label="Origem da lista de produtos"
            size="small"
            fullWidth
          >
            <MenuItem value="DINAMICO">Dinâmica — mix real do PDV, dentro de um recorte</MenuItem>
            <MenuItem value="FIXO">Fixa — lista curada aqui, sempre a mesma</MenuItem>
          </TextField>
        )}
      />

      {origem === 'DINAMICO' && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          <Controller
            name={`campos.${indice}.sortimento_tipo_vinculo`}
            control={control}
            render={({ field }) => (
              <TextField
                {...field}
                value={field.value ?? ''}
                onChange={(e) => {
                  field.onChange(e.target.value || null);
                  setValue(`campos.${indice}.sortimento_secao_uuid`, null);
                  setValue(`campos.${indice}.sortimento_departamento_uuid`, null);
                  setValue(`campos.${indice}.sortimento_marca_uuid`, null);
                }}
                select
                label="Recorte"
                size="small"
                sx={{ minWidth: 160 }}
              >
                {TIPOS_VINCULO_SORTIMENTO.map((t) => (
                  <MenuItem key={t.value} value={t.value}>
                    {t.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
          />

          {tipoVinculo === 'SECAO' && (
            <Controller
              name={`campos.${indice}.sortimento_secao_uuid`}
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  select
                  label="Seção"
                  size="small"
                  sx={{ minWidth: 200 }}
                  error={!!fieldState.error}
                  disabled={secoesQuery.isLoading}
                >
                  {(secoesQuery.data?.secoes ?? []).map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.descricao}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}

          {tipoVinculo === 'DEPARTAMENTO' && (
            <Controller
              name={`campos.${indice}.sortimento_departamento_uuid`}
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  select
                  label="Departamento"
                  size="small"
                  sx={{ minWidth: 200 }}
                  error={!!fieldState.error}
                  disabled={departamentosQuery.isLoading}
                >
                  {(departamentosQuery.data?.departamentos ?? []).map((d) => (
                    <MenuItem key={d.id} value={d.id}>
                      {d.descricao}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}

          {tipoVinculo === 'MARCA' && (
            <Controller
              name={`campos.${indice}.sortimento_marca_uuid`}
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  select
                  label="Marca"
                  size="small"
                  sx={{ minWidth: 200 }}
                  error={!!fieldState.error}
                  disabled={marcasQuery.isLoading}
                >
                  {(marcasQuery.data?.marcas ?? []).map((m) => (
                    <MenuItem key={m.id} value={m.id}>
                      {m.descricao}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />
          )}
        </Box>
      )}

      {origem === 'FIXO' && (
        <Controller
          name={`campos.${indice}.sortimento_produtos`}
          control={control}
          render={({ field, fieldState }) => (
            <Box sx={{ mt: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Produtos da lista curada ({field.value.length})
                </Typography>
                <Button size="small" startIcon={<SearchIcon />} onClick={() => setBuscaProdutoAberta(true)}>
                  Buscar produtos
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                {field.value.map((p) => (
                  <Chip
                    key={p.uuid}
                    size="small"
                    label={p.descricao}
                    onDelete={() => field.onChange(field.value.filter((x) => x.uuid !== p.uuid))}
                  />
                ))}
              </Box>
              {fieldState.error && (
                <Typography variant="caption" color="error">
                  {fieldState.error.message}
                </Typography>
              )}
              <ProdutoBuscaDialog
                open={buscaProdutoAberta}
                titulo="Produtos da lista curada"
                jaAdicionados={new Set(field.value.map((p) => p.uuid))}
                onClose={() => setBuscaProdutoAberta(false)}
                onConfirmar={(produtos) => {
                  const atuais = new Set(field.value.map((p) => p.uuid));
                  field.onChange([...field.value, ...produtos.filter((p) => !atuais.has(p.id)).map((p) => ({ uuid: p.id, descricao: p.descricao }))]);
                  setBuscaProdutoAberta(false);
                }}
              />
            </Box>
          )}
        />
      )}

      <Controller
        name={`campos.${indice}.confirmar_ruptura_ausentes`}
        control={control}
        render={({ field }) => (
          <FormControlLabel
            sx={{ display: 'block', mt: 1 }}
            control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
            label="Ausência vira ruptura (com confirmação do promotor no fim do formulário)"
          />
        )}
      />
    </Box>
  );
}

// Campo condicional (docs/20-FORMULARIO-DINAMICO-CAMPANHA.md decisão 7) — "Só aparece se" (a
// chave de um campo ANTERIOR neste mesmo array) + "for igual a" (o valor que libera). O segundo
// campo muda de formato conforme o tipo do campo pai escolhido: select Sim/Não pro BOOLEANO,
// select das opções cadastradas pro MULTIPLA_ESCOLHA, texto livre pros demais tipos. Isolado
// num componente próprio (mesmo raciocínio de FieldTipoCampoWatcher) pra usar `watch` só aqui.
function CampoCondicionalFields({
  control,
  indice,
  setValue,
}: {
  control: Control<FormData>;
  indice: number;
  setValue: UseFormSetValue<FormData>;
}) {
  const todosCampos = useWatch({ control, name: 'campos' });
  const dependeDeChave = useWatch({ control, name: `campos.${indice}.depende_de_chave` });

  const candidatos = todosCampos.slice(0, indice).filter((c) => c.chave.trim() !== '');
  if (candidatos.length === 0) return null;

  const campoPai = candidatos.find((c) => c.chave === dependeDeChave);
  const opcoesPai = campoPai?.opcoesTexto
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1 }}>
      <Controller
        name={`campos.${indice}.depende_de_chave`}
        control={control}
        render={({ field }) => (
          <TextField
            {...field}
            value={field.value ?? ''}
            onChange={(e) => {
              field.onChange(e.target.value || null);
              setValue(`campos.${indice}.depende_de_valor`, null);
            }}
            select
            label="Só aparece se"
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">Sempre (sem condição)</MenuItem>
            {candidatos.map((c) => (
              <MenuItem key={c.chave} value={c.chave}>
                {c.rotulo || c.chave}
              </MenuItem>
            ))}
          </TextField>
        )}
      />

      {campoPai && campoPai.tipo_campo === 'BOOLEANO' && (
        <Controller
          name={`campos.${indice}.depende_de_valor`}
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
              select
              label="for igual a"
              size="small"
              sx={{ minWidth: 140 }}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            >
              <MenuItem value="1">Sim</MenuItem>
              <MenuItem value="0">Não</MenuItem>
            </TextField>
          )}
        />
      )}

      {campoPai && campoPai.tipo_campo === 'MULTIPLA_ESCOLHA' && (
        <Controller
          name={`campos.${indice}.depende_de_valor`}
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value)}
              select
              label="for igual a"
              size="small"
              sx={{ minWidth: 160 }}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            >
              {(opcoesPai ?? []).map((op) => (
                <MenuItem key={op} value={op}>
                  {op}
                </MenuItem>
              ))}
            </TextField>
          )}
        />
      )}

      {campoPai && campoPai.tipo_campo !== 'BOOLEANO' && campoPai.tipo_campo !== 'MULTIPLA_ESCOLHA' && (
        <Controller
          name={`campos.${indice}.depende_de_valor`}
          control={control}
          render={({ field, fieldState }) => (
            <TextField
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(e.target.value || null)}
              label="for igual a"
              placeholder={campoPai.tipo_campo === 'DATA' ? 'dd/mm/aaaa' : undefined}
              size="small"
              sx={{ minWidth: 160 }}
              error={!!fieldState.error}
              helperText={fieldState.error?.message}
            />
          )}
        />
      )}
    </Box>
  );
}

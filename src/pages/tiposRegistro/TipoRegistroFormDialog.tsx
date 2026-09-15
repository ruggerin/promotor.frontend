import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  Link,
  MenuItem,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch, type Control, type UseFormSetValue } from 'react-hook-form';
import { z } from 'zod';
import { MdiIcon } from '../../components/MdiIcon';
import { listarCampanhas } from '../../lib/api/campanhas';
import { listarSecoes } from '../../lib/api/secoes';
import { atualizarTipoRegistro, criarTipoRegistro } from '../../lib/api/tiposRegistro';
import type { GranularidadeResposta, TipoCampoRegistro, TipoRegistro } from '../../types/api';

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
];

const campoSchema = z.object({
  chave: z
    .string()
    .min(1, 'Obrigatório')
    .max(50)
    .regex(/^[a-z0-9_]+$/, 'Só minúsculas, números e underscore (ex.: quantidade).'),
  rotulo: z.string().min(1, 'Obrigatório').max(255),
  tipo_campo: z.enum(['NUMERO', 'TEXTO', 'MOEDA', 'MULTIPLA_ESCOLHA', 'BOOLEANO', 'DATA']),
  // Opções de MULTIPLA_ESCOLHA como texto separado por vírgula — convertido pra array só no
  // envio (payload.campos[].opcoes), mais simples que uma mini-lista editável dentro do array.
  opcoesTexto: z.string(),
  obrigatorio: z.boolean(),
  // Campo condicional (docs/20-FORMULARIO-DINAMICO-CAMPANHA.md decisão 7) — `depende_de_chave`
  // referencia a `chave` de outro campo deste MESMO array (não um uuid, o campo pai pode ser
  // novo, ainda sem id). `null` = sempre aparece, sem condição.
  depende_de_chave: z.string().nullable(),
  depende_de_valor: z.string().nullable(),
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
  campos: [],
};

function campoVazio(): FormData['campos'][number] {
  return {
    chave: '',
    rotulo: '',
    tipo_campo: 'TEXTO',
    opcoesTexto: '',
    obrigatorio: false,
    depende_de_chave: null,
    depende_de_valor: null,
  };
}

function excecaoVazia(): FormData['excecoes_granularidade'][number] {
  return { secao_uuid: '', granularidade: 'PRODUTO' };
}

interface TipoRegistroFormDialogProps {
  open: boolean;
  tipo: TipoRegistro | null;
  onClose: () => void;
}

export function TipoRegistroFormDialog({ open, tipo, onClose }: TipoRegistroFormDialogProps) {
  const modoEdicao = tipo !== null;
  const queryClient = useQueryClient();
  const [erroGeral, setErroGeral] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { isSubmitting, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: DEFAULT_VALUES });

  const { fields, append, remove } = useFieldArray({ control, name: 'campos' });
  const {
    fields: excecoesFields,
    append: appendExcecao,
    remove: removeExcecao,
  } = useFieldArray({ control, name: 'excecoes_granularidade' });

  useEffect(() => {
    if (open) {
      setErroGeral(null);
      reset(
        tipo
          ? {
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
              campos: tipo.campos.map((c) => ({
                chave: c.chave,
                rotulo: c.rotulo,
                tipo_campo: c.tipo_campo,
                opcoesTexto: c.opcoes?.join(', ') ?? '',
                obrigatorio: c.obrigatorio,
                depende_de_chave: c.depende_de_chave,
                depende_de_valor: c.depende_de_valor,
              })),
            }
          : DEFAULT_VALUES,
      );
    }
  }, [open, tipo, reset]);

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
        campos: data.campos.map((c) => ({
          chave: c.chave,
          rotulo: c.rotulo,
          tipo_campo: c.tipo_campo,
          obrigatorio: c.obrigatorio,
          opcoes:
            c.tipo_campo === 'MULTIPLA_ESCOLHA'
              ? c.opcoesTexto
                  .split(',')
                  .map((o) => o.trim())
                  .filter(Boolean)
              : undefined,
          depende_de_chave: c.depende_de_chave,
          depende_de_valor: c.depende_de_chave ? c.depende_de_valor : null,
        })),
      };

      if (modoEdicao) {
        return atualizarTipoRegistro(tipo!.id, { ...payload, ativo: data.ativo });
      }
      return criarTipoRegistro(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
      onClose();
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string }>(err) && err.response?.status === 422) {
        setErroGeral(err.response.data.message ?? 'Não foi possível salvar — confira os campos abaixo.');
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{modoEdicao ? 'Editar tipo de registro' : 'Novo tipo de registro'}</DialogTitle>
      <Box
        component="form"
        onSubmit={(e) =>
          void handleSubmit((data) => {
            setErroGeral(null);
            mutation.mutate(data);
          })(e)
        }
        noValidate
      >
        <DialogContent>
          {erroGeral && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {erroGeral}
            </Alert>
          )}

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
          {modoEdicao && (
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
                <CampoCondicionalFields control={control} indice={indice} setValue={setValue} />
              </Box>
              <IconButton size="small" onClick={() => remove(indice)} sx={{ mt: 0.5 }}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}

          <Button startIcon={<AddIcon />} onClick={() => append(campoVazio())} sx={{ mt: 1 }}>
            Adicionar campo
          </Button>
          {errors.campos?.message && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {errors.campos.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose}>Cancelar</Button>
          <Button type="submit" variant="contained" disabled={isSubmitting}>
            {isSubmitting ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
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

  if (tipoCampo !== 'MULTIPLA_ESCOLHA') return null;

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


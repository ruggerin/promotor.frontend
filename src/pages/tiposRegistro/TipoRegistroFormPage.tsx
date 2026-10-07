import { zodResolver } from '@hookform/resolvers/zod';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import { Alert, Box, Button, Chip, CircularProgress, FormControlLabel, Link, Paper, Switch, ThemeProvider, Typography, createTheme, type Theme } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch, type Control, type FieldErrors } from 'react-hook-form';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { MdiIcon } from '../../components/MdiIcon';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import { atualizarTipoRegistro, buscarTipoRegistro, criarTipoRegistro } from '../../lib/api/tiposRegistro';
import { Lateral } from './formulario/Lateral';
import {
  formDoTipo,
  payloadDoForm,
  quandoAparece,
  schema,
  sobreOQue,
  valoresIniciais,
  type CampanhaContexto,
  type FormData,
} from './formulario/modelo';
import { SecaoPerguntas } from './formulario/SecaoPerguntas';
import { OPCOES_AVANCADAS, rotuloQuando, rotuloSobre } from './formulario/rotulos';
import {
  SecaoAvancado,
  SecaoIdentificacao,
  SecaoQuandoAparece,
  SecaoSobreOQue,
} from './formulario/Secoes';
import { horus } from '../../theme';

type NumeroSecao = 1 | 2 | 3 | 4 | 5;

const SECOES: { n: NumeroSecao; aba: string; titulo: string; sub?: string }[] = [
  { n: 1, aba: 'Identificação', titulo: 'Identificação' },
  { n: 2, aba: 'Quando aparece', titulo: 'Quando o promotor vê este formulário?', sub: 'Escolha uma opção.' },
  { n: 3, aba: 'Produtos', titulo: 'Sobre o que o promotor responde?', sub: 'Define se cada resposta é da loja, de um produto ou de uma seção.' },
  { n: 4, aba: 'Perguntas', titulo: 'Perguntas', sub: 'O que o promotor preenche, na ordem em que aparece no app. Arraste para reordenar.' },
  { n: 5, aba: 'Avançado', titulo: 'Opções avançadas' },
];

/**
 * Cadastro/edição de Formulário (TipoRegistro) — layout do protótipo "Formulário — revisão de UX"
 * (docs/Formulário — revisão de UX.html): cabeçalho com status de salvamento, 5 seções numeradas
 * (identificação, quando aparece, sobre o que responde, perguntas, avançado) com linguagem de
 * gente em vez dos nomes internos, e uma lateral com resumo + prévia do app. Clicar numa aba entra
 * no "modo foco" (só aquela seção aberta, as outras viram resumo com "Editar").
 *
 * As traduções entre as opções da tela e os campos reais do TipoRegistro ficam em
 * formulario/modelo.ts — nenhum campo novo no backend. Rota `/tipos-registro/novo` cria,
 * `/tipos-registro/:publicId` edita; contexto de Campanha chega por `location.state`.
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
  const [foco, setFoco] = useState<NumeroSecao | null>(null);
  const [avancadoAberto, setAvancadoAberto] = useState(false);
  const refs = useRef<Record<number, HTMLDivElement | null>>({});

  const tipoQuery = useQuery({
    queryKey: ['tipos-registro', publicId],
    queryFn: () => buscarTipoRegistro(publicId as string),
    enabled: !modoCriacao,
  });
  const tipo = tipoQuery.data?.tipo_registro ?? null;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { isDirty, errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: valoresIniciais(campanhaContexto) });

  useEffect(() => {
    if (modoCriacao) {
      reset(valoresIniciais(campanhaContexto));
      return;
    }
    if (tipo) {
      reset(formDoTipo(tipo));
      setAvancadoAberto(tipo.eh_ruptura || tipo.eh_alerta || tipo.usa_pontuacao);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoCriacao, tipo, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = payloadDoForm(data);
      if (!modoCriacao) return atualizarTipoRegistro(tipo!.id, { ...payload, ativo: data.ativo });
      return criarTipoRegistro(payload);
    },
    onSuccess: () => {
      setErroGeral(null);
      void queryClient.invalidateQueries({ queryKey: ['tipos-registro'] });
      if (modoCriacao) navigate(voltarPara);
    },
    onError: (err) => {
      if (axios.isAxiosError<{ message?: string }>(err) && err.response?.status === 422) {
        setErroGeral(err.response.data.message ?? 'Não foi possível salvar — confira os campos.');
        return;
      }
      setErroGeral('Não foi possível conectar à API. Tente novamente.');
    },
  });

  function salvar() {
    void handleSubmit(
      (data) => mutation.mutate(data),
      (erros) => {
        // Erro em seção recolhida ficaria escondido — mostra tudo e lista o que falta.
        setFoco(null);
        setErroGeral(mensagensDeErro(erros).slice(0, 4).join(' · ') || 'Confira os campos destacados.');
      },
    )();
  }

  function irPara(n: NumeroSecao) {
    const novoFoco = foco === n ? null : n;
    setFoco(novoFoco);
    if (n === 5) setAvancadoAberto(true);
    setTimeout(() => refs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  const cabecalhoApp = usePageHeader(
    <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
      Formulários
    </Typography>,
  );

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

  const secao = (n: NumeroSecao, conteudo: ReactNode, opcoes: { acao?: ReactNode; recolhivel?: boolean } = {}) => {
    const def = SECOES[n - 1];
    const recolhidaPorFoco = foco !== null && foco !== n;
    const recolhidaAvancado = n === 5 && !avancadoAberto;
    const aberta = !recolhidaPorFoco && !recolhidaAvancado;
    return (
      <Paper
        key={n}
        ref={(el: HTMLDivElement | null) => {
          refs.current[n] = el;
        }}
        variant="outlined"
        sx={{ borderRadius: 3, borderColor: foco === n ? 'primary.main' : 'divider', borderWidth: foco === n ? 1.5 : 1, scrollMarginTop: 16 }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 3, py: aberta ? 2.5 : 1.75 }}>
          <Box
            sx={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              bgcolor: foco === n ? 'primary.main' : '#1f1d2e',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              mt: 0.25,
            }}
          >
            {n}
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
              {aberta ? def.titulo : def.aba === 'Produtos' ? 'Sobre o que responde' : def.aba === 'Avançado' ? 'Opções avançadas' : def.aba}
            </Typography>
            {aberta ? (
              def.sub && (
                <Typography variant="body2" color="text.secondary">
                  {def.sub}
                </Typography>
              )
            ) : (
              <ResumoSecao control={control} n={n} />
            )}
          </Box>
          {!aberta && n === 1 && <IconePendente control={control} />}
          {opcoes.acao}
          {!aberta && (
            <Button
              variant="outlined"
              color="inherit"
              size="small"
              sx={{ borderColor: 'divider' }}
              onClick={() => (n === 5 && foco === null ? setAvancadoAberto(true) : irPara(n))}
            >
              {n === 5 && foco === null ? 'Abrir' : 'Editar'}
            </Button>
          )}
        </Box>
        {aberta && <Box sx={{ px: 3, pb: 3 }}>{conteudo}</Box>}
      </Paper>
    );
  };

  return (
    <ThemeProvider theme={temaDoEditor}>
    <Box sx={{ mx: -3, mt: -3 }}>
      {cabecalhoApp}

      {/* Cabeçalho da página: caminho, título, status e ações */}
      <Box sx={{ bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider', px: 4, pt: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <ChevronLeftIcon fontSize="small" color="primary" />
          <Link component="button" variant="body2" onClick={() => navigate(voltarPara)}>
            {campanhaContexto ? campanhaContexto.descricao : 'Formulários'}
          </Link>
          <span>/</span>
          <TituloAtual control={control} fallback={modoCriacao ? 'Novo formulário' : ''} />
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1.5 }}>
          <IconeCabecalho control={control} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }} noWrap>
              <TituloAtual control={control} fallback="Novo formulário" />
            </Typography>
            <SubtituloCabecalho control={control} />
          </Box>
          {!modoCriacao && <AtivoSwitch control={control} />}
          <Typography variant="body2" sx={{ color: isDirty ? '#c2410c' : 'text.secondary', display: 'flex', alignItems: 'center', gap: 0.75 }}>
            {isDirty && <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#ea580c' }} />}
            {isDirty ? 'Alterações não salvas' : modoCriacao ? 'Ainda não salvo' : 'Tudo salvo'}
          </Typography>
          {isDirty && !modoCriacao && (
            <Button variant="outlined" color="inherit" sx={{ borderColor: 'divider' }} onClick={() => tipo && reset(formDoTipo(tipo))}>
              Descartar
            </Button>
          )}
          <Button variant="contained" onClick={salvar} disabled={mutation.isPending || (!modoCriacao && !isDirty)}>
            {mutation.isPending ? 'Salvando…' : modoCriacao ? 'Criar formulário' : 'Salvar'}
          </Button>
        </Box>

        {/* Abas: navegam até a seção (modo foco) */}
        <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
          {SECOES.map((s) => {
            const ativa = foco === s.n;
            return (
              <Box
                key={s.n}
                onClick={() => irPara(s.n)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  pb: 1.25,
                  cursor: 'pointer',
                  borderBottom: 2.5,
                  borderColor: ativa ? 'primary.main' : 'transparent',
                  color: ativa ? 'text.primary' : 'text.secondary',
                  fontWeight: ativa ? 700 : 500,
                }}
              >
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: ativa ? 'primary.main' : horus.borda,
                    color: ativa ? '#fff' : 'text.secondary',
                  }}
                >
                  {s.n}
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
                  {s.aba}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 330px' }, gap: 3, px: 4, py: 3, bgcolor: horus.hover, minHeight: '100%' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {erroGeral && (
            <Alert severity="error" onClose={() => setErroGeral(null)}>
              {erroGeral}
            </Alert>
          )}
          {secao(1, <SecaoIdentificacao control={control} />)}
          {secao(2, <SecaoQuandoAparece control={control} setValue={setValue} />)}
          {secao(3, <SecaoSobreOQue control={control} setValue={setValue} tipoAtualId={tipo?.id ?? null} nomeFormulario={getValues('descricao')} />)}
          {secao(
            4,
            <SecaoPerguntas
              control={control}
              setValue={setValue}
              getValues={getValues}
              tipoAtualId={tipo?.id ?? null}
              erroCampos={errors.campos?.message ?? errors.campos?.root?.message}
            />,
          )}
          {secao(5, <SecaoAvancado control={control} />, {
            acao:
              avancadoAberto && foco === null ? (
                <Button size="small" onClick={() => setAvancadoAberto(false)}>
                  Recolher
                </Button>
              ) : undefined,
          })}
        </Box>
        <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
          <Lateral control={control} />
        </Box>
      </Box>
    </Box>
    </ThemeProvider>
  );
}

// Botões em texto normal (não CAIXA ALTA do tema geral), como no protótipo — só nesta tela; vale
// também pros diálogos abertos daqui (o ThemeProvider alcança os portais).
function temaDoEditor(externo: Theme): Theme {
  return createTheme(externo, { components: { MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } } } });
}

// ------------------------------------------------ peças isoladas (useWatch só onde precisa)

function TituloAtual({ control, fallback }: { control: Control<FormData>; fallback: string }) {
  const descricao = useWatch({ control, name: 'descricao' });
  return <>{descricao || fallback}</>;
}

function IconeCabecalho({ control }: { control: Control<FormData> }) {
  const icone = useWatch({ control, name: 'icone' });
  return (
    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: horus.indigoClaro, color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {icone ? <MdiIcon icone={icone} size={24} /> : <DescriptionOutlinedIcon />}
    </Box>
  );
}

function AtivoSwitch({ control }: { control: Control<FormData> }) {
  return (
    <Controller
      name="ativo"
      control={control}
      render={({ field }) => (
        <FormControlLabel
          sx={{ border: 1, borderColor: 'divider', borderRadius: 5, pl: 0.5, pr: 1.75, mr: 0 }}
          control={<Switch size="small" color="success" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
          label={<Typography variant="body2" sx={{ fontWeight: 600 }}>{field.value ? 'Ativo' : 'Inativo'}</Typography>}
        />
      )}
    />
  );
}

function SubtituloCabecalho({ control }: { control: Control<FormData> }) {
  const d = useWatch({ control }) as FormData;
  const quando = quandoAparece(d);
  const obrigatorio = d.acao_obrigatoria;
  const partes = [
    obrigatorio ? `Obrigatório: ${rotuloQuando(quando).titulo.toLowerCase()}` : rotuloQuando(quando).titulo,
    sobreOQue(d) === 'PRODUTO' && (d.produtos_predefinidos?.length ?? 0) > 0
      ? `${d.produtos_predefinidos.length} produtos`
      : rotuloSobre(sobreOQue(d)).titulo.toLowerCase(),
    `${d.campos?.length ?? 0} pergunta${(d.campos?.length ?? 0) === 1 ? '' : 's'}`,
  ];
  return (
    <Typography variant="body2" color="text.secondary" noWrap>
      {partes.join(' · ')}
    </Typography>
  );
}

function IconePendente({ control }: { control: Control<FormData> }) {
  const icone = useWatch({ control, name: 'icone' });
  if (icone) return null;
  return <Chip size="small" label="Escolha um ícone" sx={{ bgcolor: horus.ambarClaro, color: horus.ambarEscuro, fontWeight: 700 }} />;
}

function ResumoSecao({ control, n }: { control: Control<FormData>; n: NumeroSecao }) {
  const d = useWatch({ control }) as FormData;
  let texto = '';
  if (n === 1) texto = `${d.descricao || 'Sem nome'} · ${d.icone ? 'com ícone' : 'sem ícone'}`;
  if (n === 2) {
    const q = rotuloQuando(quandoAparece(d));
    texto = `${q.titulo} — ${q.sub.replace(/\.$/, '')}`;
  }
  if (n === 3) {
    const s = sobreOQue(d);
    texto = `${rotuloSobre(s).titulo}${s === 'PRODUTO' ? ` — ${d.produtos_predefinidos?.length ? `${d.produtos_predefinidos.length} produtos na lista` : 'produtos do mix da loja'}` : ` — ${rotuloSobre(s).sub}`}`;
  }
  if (n === 4) {
    const total = d.campos?.length ?? 0;
    const obrig = (d.campos ?? []).filter((c) => c.obrigatorio).length;
    texto = `${total} pergunta${total === 1 ? '' : 's'}${total ? ` · ${obrig} obrigatória${obrig === 1 ? '' : 's'}` : ''} · ${d.exige_foto ? 'pede foto' : 'sem foto'}`;
  }
  if (n === 5) {
    const ligadas = OPCOES_AVANCADAS.filter((o) => d[o.nome]).map((o) => o.curto);
    texto = ligadas.length ? `Ligado: ${ligadas.join(', ')}` : 'Nenhuma ligada. A maioria dos formulários não precisa mexer aqui.';
  }
  return (
    <Typography variant="body2" color="text.secondary" noWrap>
      {texto}
    </Typography>
  );
}

function mensagensDeErro(erros: FieldErrors<FormData>): string[] {
  const msgs: string[] = [];
  const visitar = (e: unknown) => {
    if (!e || typeof e !== 'object') return;
    const obj = e as { message?: unknown };
    if (typeof obj.message === 'string' && obj.message) msgs.push(obj.message);
    for (const [k, v] of Object.entries(e)) if (k !== 'ref' && k !== 'message' && k !== 'type') visitar(v);
  };
  visitar(erros);
  return [...new Set(msgs)];
}

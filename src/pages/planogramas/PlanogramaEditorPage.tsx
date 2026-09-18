import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toBlob } from 'html-to-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../../lib/api/client';
import {
  atualizarPrateleira,
  buscarPlanograma,
  criarBlocos,
  criarPrateleira,
  enviarFotoCapa,
  removerBloco,
  removerPrateleira,
  type BlocoPosicao,
  type ReducaoBlocosPendente,
} from '../../lib/api/planogramas';
import { listarProdutos } from '../../lib/api/produtos';
import type { PlanogramaBloco, PlanogramaPrateleira } from '../../types/api';
import { PlanogramaFormDialog } from './PlanogramaFormDialog';
import { VisualizacaoProporcional } from './VisualizacaoProporcional';

// "Aplicar aos selecionados" cria 1 bloco de largura 1 POR posição — cada célula mantém sua
// própria imagem repetida (frentes), em vez de mesclar o intervalo num bloco só esticado. Ver
// docs/22-PLANOGRAMA.md, decisão 6 — largura > 1 continua existindo pro caso de produto
// fisicamente maior, mas não é o resultado automático de selecionar várias células.
function paraBlocosIndividuais(posicoes: number[]): BlocoPosicao[] {
  return [...posicoes].sort((a, b) => a - b).map((posicao) => ({ posicao_inicio: posicao, largura: 1 }));
}

function ProdutoArrastavel({ id, descricao, imagemUrl }: { id: string; descricao: string; imagemUrl: string | null }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `produto:${id}` });

  return (
    <ListItemButton
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      sx={{
        gap: 1,
        opacity: isDragging ? 0.4 : 1,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        cursor: 'grab',
      }}
    >
      <Box
        component="img"
        src={imagemUrl ?? undefined}
        sx={{ width: 32, height: 32, objectFit: 'contain', bgcolor: 'action.hover', borderRadius: 0.5, flexShrink: 0 }}
      />
      <Typography variant="body2" noWrap>
        {descricao}
      </Typography>
    </ListItemButton>
  );
}

interface CelulaVaziaProps {
  prateleiraId: string;
  posicao: number;
  selecionada: boolean;
  onClick: (e: React.MouseEvent) => void;
}

function CelulaVazia({ prateleiraId, posicao, selecionada, onClick }: CelulaVaziaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `celula:${prateleiraId}:${posicao}` });

  return (
    <Box
      ref={setNodeRef}
      onClick={onClick}
      sx={{
        gridColumn: 'span 1',
        // Altura fixa (não ligada à largura via aspect-ratio) — a coluna estica pra preencher o
        // card inteiro (parecer uma prateleira de verdade, sem sobrar vão vazio), mas a altura
        // continua compacta independente de quão larga a célula fica.
        height: 44,
        border: '1px dashed',
        borderColor: selecionada ? 'primary.main' : isOver ? 'primary.light' : 'divider',
        bgcolor: selecionada ? 'primary.50' : isOver ? 'action.hover' : 'background.paper',
        borderRadius: 0.5,
        cursor: 'pointer',
      }}
    />
  );
}

interface BlocoPreenchidoProps {
  bloco: PlanogramaBloco;
  onRemover: () => void;
}

function BlocoPreenchido({ bloco, onRemover }: BlocoPreenchidoProps) {
  return (
    <Tooltip title={bloco.produto_auditoria?.descricao ?? ''}>
      <Box
        sx={{
          gridColumn: `span ${bloco.largura}`,
          height: 44,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 0.5,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: 'background.paper',
          '&:hover .remover-bloco': { opacity: 1 },
        }}
      >
        <Box
          component="img"
          src={bloco.produto_auditoria?.imagem_url ?? undefined}
          sx={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }}
        />
        <IconButton
          className="remover-bloco"
          size="small"
          onClick={onRemover}
          sx={{
            position: 'absolute',
            top: -8,
            right: -8,
            opacity: 0,
            transition: 'opacity .15s',
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            '&:hover': { bgcolor: 'error.light' },
          }}
        >
          <CloseIcon fontSize="inherit" />
        </IconButton>
      </Box>
    </Tooltip>
  );
}

export function PlanogramaEditorPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [erro, setErro] = useState<string | null>(null);
  // Toggle "Editor / Visualização" (Fase 3, docs/22-PLANOGRAMA.md §9.4) — mesmo `planograma` já
  // carregado, só troca o corpo da página; a Visualização é só leitura, decisão 18.
  const [modo, setModo] = useState<'editor' | 'visualizacao'>('editor');
  const [editarDescricaoAberto, setEditarDescricaoAberto] = useState(false);
  const [novaPrateleiraAberto, setNovaPrateleiraAberto] = useState(false);
  const [novaPrateleiraDescricao, setNovaPrateleiraDescricao] = useState('');
  const [novaPrateleiraQuantidade, setNovaPrateleiraQuantidade] = useState(9);
  // Criar N andares de uma vez (ex.: 4 andares, 9 blocos cada) — evita repetir "+ Novo andar"
  // uma vez por andar. Ver docs/22-PLANOGRAMA.md.
  const [variosAndaresAberto, setVariosAndaresAberto] = useState(false);
  const [variosAndaresQuantidadeAndares, setVariosAndaresQuantidadeAndares] = useState(4);
  const [variosAndaresBlocosPorAndar, setVariosAndaresBlocosPorAndar] = useState(9);
  const [criandoVariosAndares, setCriandoVariosAndares] = useState(false);
  const [editarQuantidade, setEditarQuantidade] = useState<{ prateleira: PlanogramaPrateleira; valor: number } | null>(null);
  const [confirmacaoReducao, setConfirmacaoReducao] = useState<{
    prateleira: PlanogramaPrateleira;
    valor: number;
    pendente: ReducaoBlocosPendente;
  } | null>(null);

  const [buscaProduto, setBuscaProduto] = useState('');
  const [produtoAtivoUuid, setProdutoAtivoUuid] = useState<string | null>(null);
  // Seleção múltipla de células vazias por prateleira — clique/shift+clique/ctrl+clique. Ver
  // docs/22-PLANOGRAMA.md §4.
  const [selecao, setSelecao] = useState<Record<string, Set<number>>>({});
  const [ultimoClique, setUltimoClique] = useState<Record<string, number>>({});

  // Distância mínima antes de considerar arrasto — sem isso, o produto é ao mesmo tempo
  // arrastável e clicável (pra "ativar" na paleta) e o sensor padrão do dnd-kit engole o clique
  // simples tratando qualquer toque como um possível início de arrasto.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const gradeRef = useRef<HTMLDivElement>(null);
  const [capaBlobUrl, setCapaBlobUrl] = useState<string | null>(null);
  const [capaAmpliadaAberta, setCapaAmpliadaAberta] = useState(false);
  const [gerandoCapa, setGerandoCapa] = useState(false);

  const planogramaQuery = useQuery({
    queryKey: ['planogramas', publicId],
    queryFn: () => buscarPlanograma(publicId!),
    enabled: !!publicId,
  });

  const produtosQuery = useQuery({
    queryKey: ['produtos', 'planograma-palette', buscaProduto],
    queryFn: () => listarProdutos({ ativo: true, busca: buscaProduto || undefined }),
  });

  const planograma = planogramaQuery.data?.planograma;

  // Hook sempre chamado, mesmo antes de saber se o planograma carregou — Rules of Hooks não
  // permite pular a chamada num render e chamar no outro.
  const cabecalho = usePageHeader(
    planograma ? (
      <Typography variant="h6" noWrap sx={{ fontWeight: 700 }}>
        {planograma.descricao}
      </Typography>
    ) : null,
  );

  // foto_capa_url exige Authorization: Bearer (não é um <img src> comum) — mesma técnica de
  // AtividadesPage::AutenticatedImage/UsuarioAvatar: baixa via Axios e vira blob URL.
  useEffect(() => {
    setCapaBlobUrl(null);
    const url = planograma?.foto_capa_url;
    if (!url) return;

    let objectUrl: string | null = null;
    let cancelado = false;
    apiClient
      .get<Blob>(url, { responseType: 'blob' })
      .then((response) => {
        if (cancelado) return;
        objectUrl = URL.createObjectURL(response.data);
        setCapaBlobUrl(objectUrl);
      })
      .catch(() => {});

    return () => {
      cancelado = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [planograma?.foto_capa_url]);

  function invalidarPlanograma() {
    void queryClient.invalidateQueries({ queryKey: ['planogramas', publicId] });
  }

  const criarPrateleiraMutation = useMutation({
    mutationFn: () => criarPrateleira(publicId!, { descricao: novaPrateleiraDescricao || null, quantidade_blocos: novaPrateleiraQuantidade }),
    onSuccess: () => {
      invalidarPlanograma();
      setNovaPrateleiraAberto(false);
      setNovaPrateleiraDescricao('');
      setNovaPrateleiraQuantidade(9);
    },
    onError: () => setErro('Não foi possível criar o andar.'),
  });

  async function criarVariosAndares() {
    setCriandoVariosAndares(true);
    setErro(null);
    try {
      // Sequencial, não Promise.all — o backend calcula a próxima `ordem` como
      // max(ordem)+1 na hora de criar; em paralelo, duas criações poderiam ler o mesmo max
      // antes de qualquer uma commitar e os andares saírem com `ordem` duplicada.
      for (let i = 0; i < variosAndaresQuantidadeAndares; i++) {
        await criarPrateleira(publicId!, { quantidade_blocos: variosAndaresBlocosPorAndar });
      }
      invalidarPlanograma();
      setVariosAndaresAberto(false);
    } catch {
      setErro('Não foi possível criar os andares.');
    } finally {
      setCriandoVariosAndares(false);
    }
  }

  const removerPrateleiraMutation = useMutation({
    mutationFn: (prateleiraId: string) => removerPrateleira(publicId!, prateleiraId),
    onSuccess: invalidarPlanograma,
    onError: () => setErro('Não foi possível remover o andar.'),
  });

  const atualizarQuantidadeMutation = useMutation({
    mutationFn: ({ prateleiraId, quantidade, force }: { prateleiraId: string; quantidade: number; force?: boolean }) =>
      atualizarPrateleira(publicId!, prateleiraId, { quantidade_blocos: quantidade, force }),
    onSuccess: () => {
      invalidarPlanograma();
      setEditarQuantidade(null);
      setConfirmacaoReducao(null);
    },
    onError: (err, variaveis) => {
      if (axios.isAxiosError<ReducaoBlocosPendente>(err) && err.response?.status === 422 && err.response.data.blocos_removidos) {
        const prateleira = planograma?.prateleiras.find((p) => p.id === variaveis.prateleiraId);
        if (prateleira) {
          setConfirmacaoReducao({ prateleira, valor: variaveis.quantidade, pendente: err.response.data });
        }
        return;
      }
      setErro('Não foi possível atualizar a quantidade de blocos.');
    },
  });

  const criarBlocosMutation = useMutation({
    mutationFn: ({ prateleiraId, blocos }: { prateleiraId: string; blocos: BlocoPosicao[] }) =>
      criarBlocos(publicId!, prateleiraId, produtoAtivoUuid!, blocos),
    onSuccess: (_data, variaveis) => {
      invalidarPlanograma();
      setSelecao((atual) => ({ ...atual, [variaveis.prateleiraId]: new Set() }));
    },
    onError: () => setErro('Não foi possível posicionar o produto — confira se a seleção não sobrepõe outro bloco.'),
  });

  const removerBlocoMutation = useMutation({
    mutationFn: ({ prateleiraId, blocoId }: { prateleiraId: string; blocoId: string }) => removerBloco(publicId!, prateleiraId, blocoId),
    onSuccess: invalidarPlanograma,
    onError: () => setErro('Não foi possível remover o bloco.'),
  });

  const enviarFotoCapaMutation = useMutation({
    mutationFn: (foto: File | Blob) => enviarFotoCapa(publicId!, foto),
    onSuccess: invalidarPlanograma,
    onError: () => setErro('Não foi possível salvar a foto capa.'),
  });

  function handleArquivoCapaSelecionado(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0];
    evento.target.value = ''; // permite selecionar o mesmo arquivo de novo depois
    if (arquivo) enviarFotoCapaMutation.mutate(arquivo);
  }

  // Pixel transparente — usado quando o proxy falha pra 1 imagem específica, pra ela não travar
  // a captura inteira (html-to-image rejeita a chamada toda se qualquer <img> não carregar).
  const PLACEHOLDER_TRANSPARENTE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

  // "Construída pela nossa ferramenta" (ver conversa em docs/22-PLANOGRAMA.md) — tira um
  // screenshot da própria grade já renderizada (html-to-image) em vez de duplicar a lógica de
  // desenho no backend. A foto de cada produto costuma vir de um host externo sem CORS liberado
  // (imagem_url é livre no catálogo) — html-to-image não consegue embutir isso no canvas
  // diretamente, então antes de capturar trocamos cada <img> por uma versão buscada via
  // /planogramas/proxy-imagem (mesma origem, autenticada).
  //
  // Importante: a troca acontece numa CÓPIA da grade fora da árvore do React
  // (`cloneNode` + anexada ao body, escondida por posição), não no DOM ao vivo — mexer direto
  // no <img src> real corria o risco real de o React reescrever de volta pro valor da prop
  // (bloco.produto_auditoria.imagem_url) num re-render no meio dos fetches assíncronos,
  // desfazendo a troca antes do html-to-image capturar (foi exatamente o que aconteceu ao
  // testar — a captura via clone é imune a isso).
  async function gerarCapaAutomatica() {
    if (!gradeRef.current) return;
    setGerandoCapa(true);
    setErro(null);

    // Largura explícita, copiada do elemento real — sem isso, dentro do wrapper 0×0 (abaixo) o
    // clone resolve `width:auto` contra um container de largura zero e colapsa pra 0×0, saindo
    // em branco mesmo sem erro nenhum (achado testando: `toBlob` "bem sucedido", com bytes,
    // não é garantia de conteúdo visível — só olhando o pixel real revelou o problema).
    const largura = gradeRef.current.getBoundingClientRect().width;
    const clone = gradeRef.current.cloneNode(true) as HTMLElement;
    clone.style.width = `${largura}px`;
    // Escondido com um wrapper 0×0 + overflow:hidden — testado e confirmado (lendo os pixels
    // do resultado) que isso funciona. Uma outra forma testada antes e descartada pelo mesmo
    // motivo (branco sem erro): `opacity:0` (html-to-image trata como "sem conteúdo pra
    // desenhar").
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.top = '0';
    wrapper.style.left = '0';
    wrapper.style.width = '0';
    wrapper.style.height = '0';
    wrapper.style.overflow = 'hidden';
    wrapper.appendChild(clone);
    document.body.appendChild(wrapper);

    const blobUrlsCriadas: string[] = [];

    try {
      const imgs = Array.from(clone.querySelectorAll('img'));
      await Promise.all(
        imgs.map(async (img) => {
          const original = img.src;
          if (!original) return;
          try {
            const { data } = await apiClient.get<Blob>('/planogramas/proxy-imagem', {
              params: { url: original },
              responseType: 'blob',
            });
            const blobUrl = URL.createObjectURL(data);
            blobUrlsCriadas.push(blobUrl);
            img.src = blobUrl;
          } catch {
            // Essa imagem específica não carregou pelo proxy — cai num placeholder em vez de
            // deixar a URL externa original (que ia falhar de novo dentro do html-to-image e
            // derrubar a captura inteira).
            img.src = PLACEHOLDER_TRANSPARENTE;
          }
          await new Promise((resolve) => {
            if (img.complete) {
              resolve(null);
              return;
            }
            img.onload = () => resolve(null);
            img.onerror = () => resolve(null);
          });
        }),
      );

      const blob = await toBlob(clone, { backgroundColor: '#ffffff', pixelRatio: 2 });
      if (!blob) throw new Error('sem blob');
      await enviarFotoCapaMutation.mutateAsync(blob);
    } catch {
      setErro('Não foi possível gerar a capa automaticamente — tente enviar uma foto.');
    } finally {
      blobUrlsCriadas.forEach((url) => URL.revokeObjectURL(url));
      document.body.removeChild(wrapper);
      setGerandoCapa(false);
    }
  }

  // Posições cobertas por blocos já existentes, pra saber quais índices pular ao desenhar a
  // grade (o bloco de largura N já ocupa visualmente N colunas a partir de posicao_inicio).
  const posicoesCobertasPorPrateleira = useMemo(() => {
    const mapa: Record<string, Set<number>> = {};
    for (const prateleira of planograma?.prateleiras ?? []) {
      const cobertas = new Set<number>();
      for (const bloco of prateleira.blocos) {
        for (let i = bloco.posicao_inicio; i < bloco.posicao_inicio + bloco.largura; i++) {
          cobertas.add(i);
        }
      }
      mapa[prateleira.id] = cobertas;
    }
    return mapa;
  }, [planograma]);

  function alternarSelecao(prateleiraId: string, posicao: number, evento: React.MouseEvent) {
    setSelecao((atual) => {
      const atualDaPrateleira = new Set(atual[prateleiraId] ?? []);
      const anterior = ultimoClique[prateleiraId];

      if (evento.shiftKey && anterior !== undefined) {
        const [de, ate] = anterior < posicao ? [anterior, posicao] : [posicao, anterior];
        for (let i = de; i <= ate; i++) {
          if (!posicoesCobertasPorPrateleira[prateleiraId]?.has(i)) atualDaPrateleira.add(i);
        }
      } else if (evento.ctrlKey || evento.metaKey) {
        if (atualDaPrateleira.has(posicao)) atualDaPrateleira.delete(posicao);
        else atualDaPrateleira.add(posicao);
      } else {
        atualDaPrateleira.clear();
        atualDaPrateleira.add(posicao);
      }

      return { ...atual, [prateleiraId]: atualDaPrateleira };
    });
    setUltimoClique((atual) => ({ ...atual, [prateleiraId]: posicao }));
  }

  function handleDragEnd(evento: DragEndEvent) {
    const ativoId = String(evento.active.id);
    const sobreId = evento.over?.id ? String(evento.over.id) : null;
    if (!sobreId || !ativoId.startsWith('produto:') || !sobreId.startsWith('celula:')) return;

    const produtoUuid = ativoId.replace('produto:', '');
    const [, prateleiraId, posicaoStr] = sobreId.split(':');
    setProdutoAtivoUuid(produtoUuid);
    criarBlocos(publicId!, prateleiraId, produtoUuid, [{ posicao_inicio: Number(posicaoStr), largura: 1 }])
      .then(invalidarPlanograma)
      .catch(() => setErro('Não foi possível posicionar o produto ali — confira se a célula está livre.'));
  }

  if (planogramaQuery.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!planograma) {
    return <Alert severity="error">Planograma não encontrado.</Alert>;
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      {cabecalho}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <IconButton onClick={() => navigate('/planogramas')}>
              <ArrowBackIcon />
            </IconButton>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={modo}
              onChange={(_, valor) => valor && setModo(valor)}
            >
              <ToggleButton value="editor">Editor</ToggleButton>
              <ToggleButton value="visualizacao">Visualização</ToggleButton>
            </ToggleButtonGroup>
            <Box sx={{ flex: 1 }} />
            <Chip label={planograma.ativo ? 'Ativo' : 'Inativo'} color={planograma.ativo ? 'success' : 'default'} size="small" />
            <Tooltip title="Editar descrição">
              <IconButton size="small" onClick={() => setEditarDescricaoAberto(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>

          {erro && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErro(null)}>
              {erro}
            </Alert>
          )}

          <Paper sx={{ p: 1.5, mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Box
              onClick={() => capaBlobUrl && setCapaAmpliadaAberta(true)}
              sx={{
                width: 88,
                height: 88,
                borderRadius: 1,
                overflow: 'hidden',
                bgcolor: 'action.hover',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: capaBlobUrl ? 'zoom-in' : 'default',
              }}
            >
              {capaBlobUrl ? (
                <Box component="img" src={capaBlobUrl} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ px: 1, textAlign: 'center' }}>
                  Sem capa
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2">Foto capa</Typography>
              <Typography variant="body2" color="text.secondary">
                Aparece como referência visual no menu "Planogramas" do app do promotor.
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Button size="small" variant="outlined" component="label" disabled={enviarFotoCapaMutation.isPending}>
                  Enviar foto
                  <input type="file" accept="image/png,image/jpeg" hidden onChange={handleArquivoCapaSelecionado} />
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => void gerarCapaAutomatica()}
                  disabled={gerandoCapa || enviarFotoCapaMutation.isPending || planograma.prateleiras.length === 0}
                >
                  {gerandoCapa ? 'Gerando...' : 'Gerar automaticamente'}
                </Button>
              </Box>
            </Box>
          </Paper>

          {modo === 'visualizacao' ? (
            <VisualizacaoProporcional planograma={planograma} />
          ) : (
            <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Clique numa célula vazia pra selecionar (shift+clique seleciona um intervalo,
            ctrl/cmd+clique adiciona avulso), escolha um produto na lista ao lado e aplique — ou
            arraste o produto direto pra uma célula.
          </Typography>

          <Box ref={gradeRef}>
          {planograma.prateleiras.map((prateleira) => {
            const selecaoAtual = selecao[prateleira.id] ?? new Set<number>();
            return (
              <Paper key={prateleira.id} sx={{ p: 1.5, mb: 1.5, '&:hover .andar-acoes': { opacity: 1 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                  <Typography variant="body2" sx={{ flex: 1, fontWeight: 600 }}>
                    {prateleira.descricao || `Andar ${prateleira.ordem + 1}`}
                  </Typography>
                  <Chip label={`${prateleira.quantidade_blocos} blocos`} size="small" />
                  <Box className="andar-acoes" sx={{ display: 'flex', opacity: 0, transition: 'opacity .15s' }}>
                    <Tooltip title="Editar quantidade de blocos">
                      <IconButton
                        size="small"
                        onClick={() => setEditarQuantidade({ prateleira, valor: prateleira.quantidade_blocos })}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remover andar">
                      <IconButton
                        size="small"
                        onClick={() => {
                          if (window.confirm('Remover este andar e todos os produtos posicionados nele?')) {
                            removerPrateleiraMutation.mutate(prateleira.id);
                          }
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                <Box
                  sx={{
                    display: 'grid',
                    // Colunas esticam pra preencher a largura do card (parecer uma prateleira de
                    // verdade, sem vão vazio à direita) — a altura das células é fixa (44px,
                    // definida em cada célula), não depende da largura, então isso não volta a
                    // deixar a prateleira alta numa tela larga. `minmax(28px, 1fr)` garante um
                    // mínimo legível; com muitos blocos numa tela estreita, rola horizontalmente
                    // em vez de espremer abaixo do mínimo.
                    gridTemplateColumns: `repeat(${prateleira.quantidade_blocos}, minmax(28px, 1fr))`,
                    gap: 0.5,
                    overflowX: 'auto',
                    pb: 0.5,
                  }}
                >
                  {Array.from({ length: prateleira.quantidade_blocos }, (_, posicao) => {
                    const bloco = prateleira.blocos.find((b) => b.posicao_inicio === posicao);
                    if (bloco) {
                      return (
                        <BlocoPreenchido
                          key={posicao}
                          bloco={bloco}
                          onRemover={() => {
                            if (window.confirm(`Remover "${bloco.produto_auditoria?.descricao ?? 'produto'}" desta posição?`)) {
                              removerBlocoMutation.mutate({ prateleiraId: prateleira.id, blocoId: bloco.id });
                            }
                          }}
                        />
                      );
                    }
                    if (posicoesCobertasPorPrateleira[prateleira.id]?.has(posicao)) {
                      return null; // já coberta por um bloco de largura > 1 iniciado antes
                    }
                    return (
                      <CelulaVazia
                        key={posicao}
                        prateleiraId={prateleira.id}
                        posicao={posicao}
                        selecionada={selecaoAtual.has(posicao)}
                        onClick={(e) => alternarSelecao(prateleira.id, posicao, e)}
                      />
                    );
                  })}
                </Box>

                {selecaoAtual.size > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
                    <Typography variant="body2">
                      {selecaoAtual.size} célula(s) selecionada(s)
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={!produtoAtivoUuid || criarBlocosMutation.isPending}
                      onClick={() =>
                        criarBlocosMutation.mutate({
                          prateleiraId: prateleira.id,
                          blocos: paraBlocosIndividuais([...selecaoAtual]),
                        })
                      }
                    >
                      Aplicar produto selecionado
                    </Button>
                    <Button size="small" onClick={() => setSelecao((atual) => ({ ...atual, [prateleira.id]: new Set() }))}>
                      Limpar seleção
                    </Button>
                  </Box>
                )}
              </Paper>
            );
          })}
          </Box>

          <Button variant="outlined" onClick={() => setNovaPrateleiraAberto(true)} sx={{ mr: 1 }}>
            + Novo andar
          </Button>
          <Button variant="outlined" onClick={() => setVariosAndaresAberto(true)}>
            + Vários andares
          </Button>
            </>
          )}
        </Box>

        {modo === 'editor' && (
        <Paper sx={{ width: 280, flexShrink: 0, position: 'sticky', top: 16, p: 2, maxHeight: '80vh', overflow: 'auto' }}>
          <Typography variant="subtitle1" gutterBottom>
            Produtos do catálogo
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Buscar produto..."
            value={buscaProduto}
            onChange={(e) => setBuscaProduto(e.target.value)}
            sx={{ mb: 1 }}
          />
          <Typography variant="caption" color="text.secondary">
            Clique num produto pra ativar, depois "Aplicar produto selecionado" — ou arraste
            direto pra uma célula vazia.
          </Typography>
          <List dense sx={{ mt: 1 }}>
            {produtosQuery.data?.produtos.map((produto) => (
              <Box
                key={produto.id}
                onClick={() => setProdutoAtivoUuid(produto.id)}
                sx={{
                  borderRadius: 1,
                  outline: produtoAtivoUuid === produto.id ? '2px solid' : 'none',
                  outlineColor: 'primary.main',
                }}
              >
                <ProdutoArrastavel id={produto.id} descricao={produto.descricao} imagemUrl={produto.imagem_url} />
              </Box>
            ))}
            {produtosQuery.data?.produtos.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                Nenhum produto encontrado.
              </Typography>
            )}
          </List>
        </Paper>
        )}
      </Box>

      <PlanogramaFormDialog
        open={editarDescricaoAberto}
        planograma={planograma}
        onClose={() => {
          setEditarDescricaoAberto(false);
          invalidarPlanograma();
        }}
      />

      <Dialog open={capaAmpliadaAberta} onClose={() => setCapaAmpliadaAberta(false)} maxWidth="md" fullWidth>
        <DialogContent sx={{ p: 0, lineHeight: 0 }}>
          {capaBlobUrl && <Box component="img" src={capaBlobUrl} sx={{ width: '100%', display: 'block' }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={novaPrateleiraAberto} onClose={() => setNovaPrateleiraAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Novo andar</DialogTitle>
        <DialogContent>
          <TextField
            label="Descrição (opcional)"
            fullWidth
            margin="normal"
            value={novaPrateleiraDescricao}
            onChange={(e) => setNovaPrateleiraDescricao(e.target.value)}
            placeholder='Ex.: "Andar 1"'
          />
          <TextField
            label="Quantidade de blocos"
            type="number"
            fullWidth
            margin="normal"
            value={novaPrateleiraQuantidade}
            onChange={(e) => setNovaPrateleiraQuantidade(Math.max(1, Number(e.target.value)))}
            slotProps={{ htmlInput: { min: 1, max: 200 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setNovaPrateleiraAberto(false)}>Cancelar</Button>
          <Button variant="contained" disabled={criarPrateleiraMutation.isPending} onClick={() => criarPrateleiraMutation.mutate()}>
            Criar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={variosAndaresAberto} onClose={() => setVariosAndaresAberto(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Criar vários andares</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Cria todos de uma vez, todos com a mesma quantidade de blocos — mais rápido que criar
            um por um quando o padrão se repete (ex.: 4 andares de 9 blocos).
          </Typography>
          <TextField
            label="Quantidade de andares"
            type="number"
            fullWidth
            margin="normal"
            value={variosAndaresQuantidadeAndares}
            onChange={(e) => setVariosAndaresQuantidadeAndares(Math.max(1, Number(e.target.value)))}
            slotProps={{ htmlInput: { min: 1, max: 50 } }}
          />
          <TextField
            label="Blocos por andar"
            type="number"
            fullWidth
            margin="normal"
            value={variosAndaresBlocosPorAndar}
            onChange={(e) => setVariosAndaresBlocosPorAndar(Math.max(1, Number(e.target.value)))}
            slotProps={{ htmlInput: { min: 1, max: 200 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setVariosAndaresAberto(false)}>Cancelar</Button>
          <Button variant="contained" disabled={criandoVariosAndares} onClick={() => void criarVariosAndares()}>
            {criandoVariosAndares ? 'Criando...' : `Criar ${variosAndaresQuantidadeAndares} andares`}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!editarQuantidade} onClose={() => setEditarQuantidade(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Editar quantidade de blocos</DialogTitle>
        <DialogContent>
          <TextField
            label="Quantidade de blocos"
            type="number"
            fullWidth
            margin="normal"
            value={editarQuantidade?.valor ?? 1}
            onChange={(e) => setEditarQuantidade((atual) => (atual ? { ...atual, valor: Math.max(1, Number(e.target.value)) } : atual))}
            slotProps={{ htmlInput: { min: 1, max: 200 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditarQuantidade(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={atualizarQuantidadeMutation.isPending}
            onClick={() =>
              editarQuantidade &&
              atualizarQuantidadeMutation.mutate({ prateleiraId: editarQuantidade.prateleira.id, quantidade: editarQuantidade.valor })
            }
          >
            Salvar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!confirmacaoReducao} onClose={() => setConfirmacaoReducao(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Isso vai remover produtos já posicionados</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Reduzir pra {confirmacaoReducao?.valor} blocos remove os seguintes produtos deste andar:
          </Typography>
          {confirmacaoReducao?.pendente.blocos_removidos.map((bloco) => (
            <Chip
              key={bloco.id}
              label={`${bloco.produto_auditoria?.descricao ?? 'Produto'} (posição ${bloco.posicao_inicio})`}
              sx={{ mr: 0.5, mb: 0.5 }}
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmacaoReducao(null)}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() =>
              confirmacaoReducao &&
              atualizarQuantidadeMutation.mutate({
                prateleiraId: confirmacaoReducao.prateleira.id,
                quantidade: confirmacaoReducao.valor,
                force: true,
              })
            }
          >
            Confirmar remoção
          </Button>
        </DialogActions>
      </Dialog>
    </DndContext>
  );
}

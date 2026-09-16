import AddIcon from '@mui/icons-material/Add';
import { usePageHeader } from '../../components/layout/PageHeaderSlot';
import PhotoSizeSelectLargeIcon from '@mui/icons-material/PhotoSizeSelectLarge';
import PhotoSizeSelectSmallIcon from '@mui/icons-material/PhotoSizeSelectSmall';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Menu,
  MenuItem,
  Popover,
  Slider,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { forwardRef, useMemo, useState } from 'react';
import type { ContextProp, GridItemProps, GridListProps } from 'react-virtuoso';
import { VirtuosoGrid } from 'react-virtuoso';
import { GaleriaDialog } from '../../components/fotos/GaleriaDialog';
import { MosaicoImagens } from '../../components/fotos/MosaicoImagens';
import { achatarFotos, type FotoComRegistro } from '../../components/fotos/tipos';
import { listarDepartamentos } from '../../lib/api/departamentos';
import { listarGaleriaFotos, type GaleriaFotosFiltros } from '../../lib/api/galeriaFotos';
import { listarMarcas } from '../../lib/api/marcas';
import { listarPontosVenda } from '../../lib/api/pontosVenda';
import { listarProdutos } from '../../lib/api/produtos';
import { listarRamosAtividade } from '../../lib/api/ramosAtividade';
import { listarRedesLojas } from '../../lib/api/redesLojas';
import { listarSecoes } from '../../lib/api/secoes';
import { listarTiposRegistro } from '../../lib/api/tiposRegistro';
import { listarUsuarios } from '../../lib/api/usuarios';
import { labelDoDia, mesmaDataLocal } from '../../lib/datas';
import type { FotoGaleria } from '../../types/api';

// Filtro em chip dinâmico (Linear/Notion/Airtable), não formulário estático — pedido explícito
// do usuário, ver docs/23-GALERIA-DE-FOTOS.md §5.1. "período" e "ruptura" são especiais
// (período = 2 datas, ruptura = toggle sem popover); os outros 9 são todos a mesma coisa —
// Autocomplete de uma entidade — resolvidos via CONFIG_ENTIDADE abaixo.
type TipoFiltro =
  | 'periodo'
  | 'tipo_registro'
  | 'departamento'
  | 'secao'
  | 'marca'
  | 'produto'
  | 'loja'
  | 'rede_loja'
  | 'ramo_atividade'
  | 'promotor'
  | 'ruptura';

type ChaveEntidade = Exclude<TipoFiltro, 'periodo' | 'ruptura'>;

interface OpcaoFiltro {
  id: string;
  label: string;
}

const LABELS_FILTRO: Record<TipoFiltro, string> = {
  periodo: 'Período',
  tipo_registro: 'Tipo de registro',
  departamento: 'Departamento',
  secao: 'Seção',
  marca: 'Marca',
  produto: 'Produto',
  loja: 'Loja',
  rede_loja: 'Rede de lojas',
  ramo_atividade: 'Ramo de atividade',
  promotor: 'Promotor',
  ruptura: 'Ruptura',
};

const ORDEM_MENU: TipoFiltro[] = [
  'periodo',
  'tipo_registro',
  'departamento',
  'secao',
  'marca',
  'produto',
  'loja',
  'rede_loja',
  'ramo_atividade',
  'promotor',
  'ruptura',
];

const ENTIDADES_VAZIAS: Record<ChaveEntidade, OpcaoFiltro | null> = {
  tipo_registro: null,
  departamento: null,
  secao: null,
  marca: null,
  produto: null,
  loja: null,
  rede_loja: null,
  ramo_atividade: null,
  promotor: null,
};

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// "Últimos 7 dias" = hoje + os 6 dias anteriores, 7 dias corridos no total (inclusive hoje) —
// mesmo período padrão que Google Fotos/dashboards de analytics costumam abrir.
function seteDiasAtrasISO(): string {
  const data = new Date();
  data.setDate(data.getDate() - 6);
  return data.toISOString().slice(0, 10);
}

const TAMANHO_CARD_PADRAO = 160;
const TAMANHO_CARD_MIN = 100;
const TAMANHO_CARD_MAX = 320;

interface GridContext {
  tamanhoCard: number;
}

// Célula da grade virtualizada — `GridListProps`/`GridItemProps` vêm prontos do react-virtuoso
// (style de posicionamento + className), só embrulha num `Box` pra poder usar `sx` (a grade em
// si, `display: grid`, é definida aqui; o resto do layout já é responsabilidade de cada card).
// `context` (ver VirtuosoGrid abaixo) carrega o tamanho do card escolhido no slider — permite o
// controle "personalizado, tal como Google Fotos" sem recriar a grade inteira a cada mudança.
const GridList = forwardRef<HTMLDivElement, GridListProps & ContextProp<GridContext>>(function GridList(
  { style, children, context, ...props },
  ref,
) {
  return (
    <Box
      ref={ref}
      {...props}
      style={style}
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${context.tamanhoCard}px, 1fr))`,
        gap: 1,
      }}
    >
      {children}
    </Box>
  );
});

// Descarta `context` explicitamente — sem isso ele vazaria como atributo inválido pro <div> (o
// componente recebe a prop mesmo sem usá-la, já que a grade toda foi tipada com GridContext).
const GridItem = forwardRef<HTMLDivElement, GridItemProps & ContextProp<GridContext>>(function GridItem(
  { children, context: _context, ...props },
  ref,
) {
  return (
    <Box ref={ref} {...props}>
      {children}
    </Box>
  );
});

function CardFoto({
  foto,
  onAbrirImagem,
}: {
  foto: FotoGaleria;
  // Devolve só o id da imagem clicada — quem decide a lista/índice pra navegação é o pai (ver
  // `todasFotos` em GaleriaFotosPage), não este card: um clique aqui precisa abrir o lightbox
  // navegável pela GRADE INTEIRA (estilo Google Fotos), não só pelas fotos deste card (que aqui
  // é normalmente 1 só — sem isso as setas de navegação nunca apareciam, ver GaleriaDialog).
  onAbrirImagem: (imagemId: string) => void;
}) {
  const fotosDoRegistro = useMemo(() => achatarFotos([foto.registro]), [foto.registro]);

  return (
    <Box sx={{ borderRadius: 1.5, overflow: 'hidden', border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <Box sx={{ position: 'relative' }}>
        {/* Tag do tipo de registro sobreposta na foto (canto superior esquerdo) — mesmo lugar
            do handoff de design (Galeria de Fotos.dc.html: "{{ p.tag }}"). */}
        <Box
          sx={{
            position: 'absolute',
            left: 6,
            top: 6,
            zIndex: 1,
            fontSize: 10,
            fontWeight: 600,
            fontFamily: 'monospace',
            color: '#fff',
            bgcolor: 'rgba(23,21,49,0.72)',
            borderRadius: 1,
            px: 0.75,
            py: 0.25,
            pointerEvents: 'none',
          }}
        >
          {foto.registro.tipo_registro.descricao}
        </Box>
        <MosaicoImagens
          fotos={fotosDoRegistro}
          onAbrir={(i) => onAbrirImagem(fotosDoRegistro[i].imagem.id)}
          maxWidth="100%"
        />
      </Box>
      <Box sx={{ px: 0.75, py: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', lineHeight: 1.4, fontSize: 11.5 }} noWrap>
          {foto.ponto_venda?.fantasia ?? '—'}
        </Typography>
        {/* hora · promotor — mesmo par de dados que o card do handoff de design mostra
            (Galeria de Fotos.dc.html: "{{ p.time }} · {{ p.promoter }}"). */}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, fontSize: 10.5 }} noWrap>
          {new Date(foto.ocorrido_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          {foto.usuario ? ` · ${foto.usuario.nome}` : ''}
        </Typography>
      </Box>
    </Box>
  );
}

// Grade só de fotos (diferente do Atividades, que é uma timeline de eventos) — filtrável,
// paginada por infinite scroll + renderização virtualizada (VirtuosoGrid: só os cards visíveis
// ficam no DOM, economia real de memória numa sessão que pode acumular muitas fotos). Ver
// docs/23-GALERIA-DE-FOTOS.md.
export function GaleriaFotosPage() {
  // Abre em "últimos 7 dias" por padrão — diferente da v1 (sem filtro nenhum), pedido explícito
  // do usuário. Continua removível como qualquer outro chip (clica o X e vê tudo).
  const [filtrosAtivos, setFiltrosAtivos] = useState<TipoFiltro[]>(['periodo']);
  const [dataInicio, setDataInicio] = useState(seteDiasAtrasISO());
  const [dataFim, setDataFim] = useState(hojeISO());
  const [entidades, setEntidades] = useState(ENTIDADES_VAZIAS);
  const [ruptura, setRuptura] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [edicao, setEdicao] = useState<{ tipo: TipoFiltro; anchorEl: HTMLElement } | null>(null);
  const [galeria, setGaleria] = useState<{ fotos: FotoComRegistro[]; indice: number } | null>(null);
  // Tamanho do card, personalizável — mesmo controle que Google Fotos tem pro zoom da grade.
  const [tamanhoCard, setTamanhoCard] = useState(TAMANHO_CARD_PADRAO);
  // Índice da primeira foto visível no viewport — alimenta a barra de data fixa abaixo (estilo
  // Google Fotos: a data não fica repetida em cada seção, um único rótulo no topo troca sozinho
  // conforme rola). Preferido a agrupar a grade em seções por dia porque a VirtuosoGrid não
  // suporta cabeçalho de grupo nativamente (só a Virtuoso em modo lista suporta).
  const [indiceVisivel, setIndiceVisivel] = useState(0);

  const tiposRegistroQuery = useQuery({ queryKey: ['tipos-registro', 'filtro'], queryFn: () => listarTiposRegistro() });
  const departamentosQuery = useQuery({ queryKey: ['departamentos', 'filtro'], queryFn: () => listarDepartamentos() });
  const secoesQuery = useQuery({ queryKey: ['secoes', 'filtro'], queryFn: () => listarSecoes() });
  const marcasQuery = useQuery({ queryKey: ['marcas', 'filtro'], queryFn: () => listarMarcas() });
  const produtosQuery = useQuery({ queryKey: ['produtos', 'filtro'], queryFn: () => listarProdutos() });
  const pontosVendaQuery = useQuery({ queryKey: ['pontos-venda', 'filtro'], queryFn: () => listarPontosVenda() });
  const redesLojasQuery = useQuery({ queryKey: ['redes-lojas', 'filtro'], queryFn: () => listarRedesLojas() });
  const ramosAtividadeQuery = useQuery({ queryKey: ['ramos-atividade', 'filtro'], queryFn: () => listarRamosAtividade() });
  const promotoresQuery = useQuery({
    queryKey: ['usuarios', 'promotores', 'filtro'],
    queryFn: () => listarUsuarios({ user_type: 'PROMOTOR' }),
  });

  const configEntidade: Record<ChaveEntidade, { opcoes: OpcaoFiltro[]; carregando: boolean }> = {
    tipo_registro: {
      opcoes: (tiposRegistroQuery.data?.tipos_registro ?? []).map((t) => ({ id: t.id, label: t.descricao })),
      carregando: tiposRegistroQuery.isLoading,
    },
    departamento: {
      opcoes: (departamentosQuery.data?.departamentos ?? []).map((d) => ({ id: d.id, label: d.descricao })),
      carregando: departamentosQuery.isLoading,
    },
    secao: {
      opcoes: (secoesQuery.data?.secoes ?? []).map((s) => ({ id: s.id, label: s.descricao })),
      carregando: secoesQuery.isLoading,
    },
    marca: {
      opcoes: (marcasQuery.data?.marcas ?? []).map((m) => ({ id: m.id, label: m.descricao })),
      carregando: marcasQuery.isLoading,
    },
    produto: {
      opcoes: (produtosQuery.data?.produtos ?? []).map((p) => ({ id: p.id, label: p.descricao })),
      carregando: produtosQuery.isLoading,
    },
    loja: {
      opcoes: (pontosVendaQuery.data?.pontos_venda ?? []).map((p) => ({ id: p.id, label: p.fantasia })),
      carregando: pontosVendaQuery.isLoading,
    },
    rede_loja: {
      opcoes: (redesLojasQuery.data?.redes_lojas ?? []).map((r) => ({ id: r.id, label: r.descricao })),
      carregando: redesLojasQuery.isLoading,
    },
    ramo_atividade: {
      opcoes: (ramosAtividadeQuery.data?.ramos_atividade ?? []).map((r) => ({ id: r.id, label: r.descricao })),
      carregando: ramosAtividadeQuery.isLoading,
    },
    promotor: {
      opcoes: (promotoresQuery.data?.usuarios ?? []).map((u) => ({ id: u.id, label: u.nome })),
      carregando: promotoresQuery.isLoading,
    },
  };

  const filtros: GaleriaFotosFiltros = {
    data_inicio: filtrosAtivos.includes('periodo') ? dataInicio || undefined : undefined,
    data_fim: filtrosAtivos.includes('periodo') ? dataFim || undefined : undefined,
    tipo_registro_uuid: entidades.tipo_registro?.id,
    departamento_uuid: entidades.departamento?.id,
    secao_uuid: entidades.secao?.id,
    marca_uuid: entidades.marca?.id,
    produto_auditoria_uuid: entidades.produto?.id,
    ponto_venda_uuid: entidades.loja?.id,
    rede_loja_uuid: entidades.rede_loja?.id,
    ramo_atividade_uuid: entidades.ramo_atividade?.id,
    usuario_uuid: entidades.promotor?.id,
    ruptura: filtrosAtivos.includes('ruptura') ? ruptura : undefined,
  };

  const galeriaQuery = useInfiniteQuery({
    queryKey: ['galeria-fotos', filtros],
    queryFn: ({ pageParam }) => listarGaleriaFotos({ ...filtros, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (pagina) =>
      pagina.meta.current_page < pagina.meta.last_page ? pagina.meta.current_page + 1 : undefined,
  });
  const fotos = useMemo(() => galeriaQuery.data?.pages.flatMap((pagina) => pagina.registros) ?? [], [galeriaQuery.data]);
  // Lista achatada de TODAS as fotos já carregadas (todas as páginas, não só o card clicado) —
  // é o que dá ao lightbox setinha de navegação de verdade pela grade inteira, estilo Google
  // Fotos, com o nome de quem registrou (só a Galeria tem esse dado por foto, ver FotoGaleria).
  const todasFotos = useMemo<FotoComRegistro[]>(
    () =>
      fotos.flatMap((f) =>
        f.registro.imagens.map((imagem) => ({ registro: f.registro, imagem, usuario: f.usuario ?? undefined })),
      ),
    [fotos],
  );

  // Data da foto atualmente no topo do viewport + quantas fotos já carregadas são desse mesmo
  // dia (só entre o que já veio das páginas carregadas, mesmo espírito do contador do Atividades).
  const dataVisivel = fotos[indiceVisivel]?.ocorrido_em;
  const contagemDiaVisivel = dataVisivel ? fotos.filter((f) => mesmaDataLocal(f.ocorrido_em, dataVisivel)).length : 0;

  function abrirNaGaleria(imagemId: string) {
    const indice = todasFotos.findIndex((f) => f.imagem.id === imagemId);
    if (indice === -1) return;
    setGaleria({ fotos: todasFotos, indice });
  }

  function adicionarFiltro(tipo: TipoFiltro) {
    setFiltrosAtivos((atual) => [...atual, tipo]);
    if (tipo === 'ruptura') {
      setRuptura(true);
      setMenuAnchor(null);
      return;
    }
    // Ancora no próprio botão "+ Filtro" — o chip novo ainda não existe no DOM neste instante
    // (só nasce no próximo render), mas visualmente abre bem perto de onde ele vai aparecer.
    if (menuAnchor) setEdicao({ tipo, anchorEl: menuAnchor });
    setMenuAnchor(null);
  }

  function removerFiltro(tipo: TipoFiltro) {
    setFiltrosAtivos((atual) => atual.filter((t) => t !== tipo));
    if (tipo === 'periodo') {
      setDataInicio('');
      setDataFim('');
    } else if (tipo !== 'ruptura') {
      setEntidades((atual) => ({ ...atual, [tipo]: null }));
    }
    if (edicao?.tipo === tipo) setEdicao(null);
  }

  function limparFiltros() {
    setFiltrosAtivos([]);
    setDataInicio('');
    setDataFim('');
    setEntidades(ENTIDADES_VAZIAS);
    setEdicao(null);
  }

  function labelChip(tipo: TipoFiltro): string {
    if (tipo === 'periodo') {
      if (dataInicio && dataFim) return `${formatarData(dataInicio)} – ${formatarData(dataFim)}`;
      if (dataInicio) return `A partir de ${formatarData(dataInicio)}`;
      if (dataFim) return `Até ${formatarData(dataFim)}`;
      return LABELS_FILTRO.periodo;
    }
    if (tipo === 'ruptura') return `Ruptura: ${ruptura ? 'Sim' : 'Não'}`;
    const valor = entidades[tipo];
    return valor ? `${LABELS_FILTRO[tipo]}: ${valor.label}` : LABELS_FILTRO[tipo];
  }

  const cabecalho = usePageHeader(
    <Typography variant="h6" sx={{ fontWeight: 700 }}>
      Galeria de Fotos
    </Typography>,
  );

  return (
    <Box>
      {cabecalho}
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Todas as fotos coletadas nas visitas, filtráveis por período, tipo, catálogo, loja e
        promotor — sem precisar abrir visita por visita.
      </Typography>

      {/* Barra de filtros em chips — ver docs/23-GALERIA-DE-FOTOS.md §5.1. */}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 2, overflowX: 'auto', pb: 0.5 }}>
        {filtrosAtivos.map((tipo) => (
          <Chip
            key={tipo}
            label={labelChip(tipo)}
            color={tipo === 'ruptura' || tipo === 'periodo' || entidades[tipo as ChaveEntidade] ? 'primary' : 'default'}
            variant={tipo === 'ruptura' || tipo === 'periodo' || entidades[tipo as ChaveEntidade] ? 'filled' : 'outlined'}
            onClick={(e) => (tipo === 'ruptura' ? setRuptura((r) => !r) : setEdicao({ tipo, anchorEl: e.currentTarget }))}
            onDelete={() => removerFiltro(tipo)}
          />
        ))}

        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={(e) => setMenuAnchor(e.currentTarget)}>
          Filtro
        </Button>
        <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
          {ORDEM_MENU.filter((tipo) => !filtrosAtivos.includes(tipo)).map((tipo) => (
            <MenuItem key={tipo} onClick={() => adicionarFiltro(tipo)}>
              {LABELS_FILTRO[tipo]}
            </MenuItem>
          ))}
        </Menu>

        {filtrosAtivos.length > 0 && (
          <Button size="small" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        )}

        {/* Contador total + tamanho do card — mesmo par de controles do handoff de design
            (Galeria de Fotos.dc.html: "1.248 fotos" + slider "Tamanho"). Empurrado pro fim da
            barra (ml: 'auto') — some pra baixo dos chips só em tela muito estreita. */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto', minWidth: 160 }}>
          {galeriaQuery.data && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                {galeriaQuery.data.pages[0].meta.total} foto{galeriaQuery.data.pages[0].meta.total === 1 ? '' : 's'}
              </Typography>
              <Box sx={{ width: '1px', height: 20, bgcolor: 'divider' }} />
            </>
          )}
          <PhotoSizeSelectSmallIcon fontSize="small" color="action" />
          <Slider
            size="small"
            value={tamanhoCard}
            min={TAMANHO_CARD_MIN}
            max={TAMANHO_CARD_MAX}
            step={20}
            onChange={(_, valor) => setTamanhoCard(valor as number)}
            sx={{ width: 100 }}
            aria-label="Tamanho das fotos"
          />
          <PhotoSizeSelectLargeIcon fontSize="small" color="action" />
        </Box>
      </Box>

      <Popover
        open={!!edicao}
        anchorEl={edicao?.anchorEl}
        onClose={() => setEdicao(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        {edicao?.tipo === 'periodo' && (
          <Box sx={{ p: 2, width: 260, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Data início"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
            <TextField
              label="Data fim"
              type="date"
              size="small"
              slotProps={{ inputLabel: { shrink: true } }}
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </Box>
        )}
        {edicao && edicao.tipo !== 'periodo' && edicao.tipo !== 'ruptura' && (
          <Box sx={{ p: 2, width: 280 }}>
            <Autocomplete
              openOnFocus
              options={configEntidade[edicao.tipo].opcoes}
              getOptionLabel={(o) => o.label}
              loading={configEntidade[edicao.tipo].carregando}
              value={entidades[edicao.tipo]}
              onChange={(_, valor) => {
                const tipo = edicao.tipo;
                setEntidades((atual) => ({ ...atual, [tipo]: valor }));
                if (valor) setEdicao(null);
              }}
              renderInput={(params) => <TextField {...params} label={LABELS_FILTRO[edicao.tipo]} size="small" autoFocus />}
            />
          </Box>
        )}
      </Popover>

      {galeriaQuery.isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {galeriaQuery.isError && (
        <Typography color="error" variant="body2">
          Não foi possível carregar a galeria — você pode não ter permissão para isto, ou houve
          um problema de conexão.
        </Typography>
      )}
      {!galeriaQuery.isLoading && fotos.length === 0 && (
        <Typography color="text.secondary">Nenhuma foto encontrada pros filtros escolhidos.</Typography>
      )}

      {/* Data fixa no topo ao rolar, estilo Google Fotos — mostra o dia da foto que está no topo
          do viewport agora, trocando sozinha conforme a rolagem (ver rangeChanged abaixo). */}
      {dataVisivel && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            position: 'sticky',
            // 64px = altura da AppBar fixa (AppLayout) — mesmo ajuste do AtividadesPage, sem
            // isso o rótulo gruda atrás da AppBar em vez de logo abaixo dela.
            top: 64,
            zIndex: 2,
            backdropFilter: 'blur(6px)',
            bgcolor: (t) => alpha(t.palette.background.default, 0.85),
            py: 0.75,
            mb: 1,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13.5 }}>
            {labelDoDia(dataVisivel)}
          </Typography>
          <Chip
            size="small"
            label={`${contagemDiaVisivel} foto${contagemDiaVisivel === 1 ? '' : 's'}`}
            sx={{ height: 20, fontSize: 11, fontFamily: 'monospace', fontWeight: 600, bgcolor: 'action.hover' }}
          />
          <Box sx={{ flex: 1, height: '1px', bgcolor: 'divider' }} />
        </Box>
      )}

      <VirtuosoGrid
        useWindowScroll
        data={fotos}
        // Maior que o default — desmonta menos card num scroll normal, complementando o cache
        // de blob URL (ver components/fotos/blobCache.ts) que já cobre o resto do caso.
        overscan={1600}
        context={{ tamanhoCard }}
        rangeChanged={(range) => setIndiceVisivel(range.startIndex)}
        endReached={() => {
          if (galeriaQuery.hasNextPage && !galeriaQuery.isFetchingNextPage) void galeriaQuery.fetchNextPage();
        }}
        components={{ List: GridList, Item: GridItem }}
        itemContent={(_, foto) => <CardFoto foto={foto} onAbrirImagem={abrirNaGaleria} />}
      />
      {galeriaQuery.isFetchingNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      )}

      {galeria && (
        <GaleriaDialog
          fotos={galeria.fotos}
          indice={galeria.indice}
          onNavegar={(novoIndice) => setGaleria({ fotos: galeria.fotos, indice: novoIndice })}
          onClose={() => setGaleria(null)}
        />
      )}
    </Box>
  );
}

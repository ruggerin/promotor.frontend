import AddIcon from '@mui/icons-material/Add';
import {
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Menu,
  MenuItem,
  Popover,
  TextField,
  Typography,
} from '@mui/material';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { forwardRef, useMemo, useState } from 'react';
import type { GridItemProps, GridListProps } from 'react-virtuoso';
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

// Célula da grade virtualizada — `GridListProps`/`GridItemProps` vêm prontos do react-virtuoso
// (style de posicionamento + className), só embrulha num `Box` pra poder usar `sx` (a grade em
// si, `display: grid`, é definida aqui; o resto do layout já é responsabilidade de cada card).
const GridList = forwardRef<HTMLDivElement, GridListProps>(function GridList({ style, children, ...props }, ref) {
  return (
    <Box
      ref={ref}
      {...props}
      style={style}
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5 }}
    >
      {children}
    </Box>
  );
});

const GridItem = forwardRef<HTMLDivElement, GridItemProps>(function GridItem({ children, ...props }, ref) {
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
  onAbrirImagem: (fotos: FotoComRegistro[], indice: number) => void;
}) {
  const fotosDoRegistro = useMemo(() => achatarFotos([foto.registro]), [foto.registro]);

  return (
    <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', height: '100%' }}>
      <MosaicoImagens fotos={fotosDoRegistro} onAbrir={(i) => onAbrirImagem(fotosDoRegistro, i)} maxWidth="100%" />
      <Box sx={{ p: 1 }}>
        <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }} noWrap>
          {foto.registro.tipo_registro.descricao}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }} noWrap>
          {foto.ponto_venda?.fantasia ?? '—'} · {new Date(foto.ocorrido_em).toLocaleDateString('pt-BR')}
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
  const [filtrosAtivos, setFiltrosAtivos] = useState<TipoFiltro[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [entidades, setEntidades] = useState(ENTIDADES_VAZIAS);
  const [ruptura, setRuptura] = useState(true);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [edicao, setEdicao] = useState<{ tipo: TipoFiltro; anchorEl: HTMLElement } | null>(null);
  const [galeria, setGaleria] = useState<{ fotos: FotoComRegistro[]; indice: number } | null>(null);

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

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Galeria de Fotos
      </Typography>
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

      <VirtuosoGrid
        useWindowScroll
        data={fotos}
        overscan={600}
        endReached={() => {
          if (galeriaQuery.hasNextPage && !galeriaQuery.isFetchingNextPage) void galeriaQuery.fetchNextPage();
        }}
        components={{ List: GridList, Item: GridItem }}
        itemContent={(_, foto) => (
          <CardFoto foto={foto} onAbrirImagem={(fs, indice) => setGaleria({ fotos: fs, indice })} />
        )}
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

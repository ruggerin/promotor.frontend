import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined';
import AltRouteIcon from '@mui/icons-material/AltRouteOutlined';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined';
import BoltIcon from '@mui/icons-material/BoltOutlined';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthOutlined';
import CampaignIcon from '@mui/icons-material/CampaignOutlined';
import CategoryIcon from '@mui/icons-material/CategoryOutlined';
import ChecklistIcon from '@mui/icons-material/ChecklistOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import EventRepeatIcon from '@mui/icons-material/EventRepeatOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import FlagIcon from '@mui/icons-material/FlagOutlined';
import GridViewIcon from '@mui/icons-material/GridViewOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import InsightsIcon from '@mui/icons-material/InsightsOutlined';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import LabelIcon from '@mui/icons-material/LabelOutlined';
import ListAltIcon from '@mui/icons-material/ListAltOutlined';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/MenuOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocationOutlined';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibraryOutlined';
import RuleIcon from '@mui/icons-material/RuleOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import SecurityIcon from '@mui/icons-material/SecurityOutlined';
import SendIcon from '@mui/icons-material/SendOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import StoreIcon from '@mui/icons-material/StoreOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAltOutlined';
import TuneIcon from '@mui/icons-material/TuneOutlined';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import WorkIcon from '@mui/icons-material/WorkOutlineOutlined';
import {
  Box,
  Drawer,
  IconButton,
  ListItemButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { buscarResumoAtividades } from '../../lib/api/atividades';
import { buscarConformidadeRastreamento } from '../../lib/api/localizacoes';
import { listarOrdensServico } from '../../lib/api/ordensServico';
import { useAuth } from '../../lib/auth/AuthContext';
import { horus } from '../../theme';
import { AutorizacaoGestorButton } from '../AutorizacaoGestorButton';
import { UsuarioAvatar } from '../UsuarioAvatar';
import { HeaderSlotContext } from './PageHeaderSlot';

// Chassi do admin no padrão visual Horus (6/10/2026): menu lateral branco de 232px (64px
// recolhido, só ícones), item ativo preenchido em índigo, busca de telas com Ctrl+K, usuário no
// rodapé do menu; header branco fixo com o título/ações que cada página injeta (usePageHeader).

const LARGURA_MENU = 232;
const LARGURA_MENU_MINI = 64;
const STATUS_SOLICITACAO = ['AGUARDANDO_APROVACAO', 'REAGENDAMENTO_SOLICITADO', 'CANCELAMENTO_SOLICITADO'] as const;
const CHAVE_MENU_ABERTO = 'pdv-admin:menu-lateral-aberto';

type ItemMenu = {
  rotulo: string;
  caminho: string;
  icone: ReactNode;
  /** Contador em tag âmbar à direita (ex.: pendências). Zero ou ausente = não mostra. */
  contador?: number;
  visivel?: boolean;
};

type GrupoMenu = { rotulo: string; itens: ItemMenu[] };

/** Minúsculas e sem acento, pra busca de telas ("operacao" acha "Operação do dia"). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function AppLayout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  // Alvo do portal de cada página (ver PageHeaderSlot.tsx) — título e ações ficam no header.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  // Recolher o menu (64px, só ícones) — persiste em localStorage, conforto do viewer apenas.
  const [menuAberto, setMenuAberto] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CHAVE_MENU_ABERTO) !== '0';
    } catch {
      return true;
    }
  });

  // Abaixo de md o menu fixo some e vira gaveta temporária aberta pelo botão do header.
  const ehMobile = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);
  const mini = !ehMobile && !menuAberto;

  const [busca, setBusca] = useState('');
  const buscaRef = useRef<HTMLInputElement>(null);

  function definirMenuAberto(aberto: boolean) {
    setMenuAberto(aberto);
    try {
      localStorage.setItem(CHAVE_MENU_ABERTO, aberto ? '1' : '0');
    } catch {
      // Storage indisponível — só não persiste a preferência.
    }
  }

  // Abre o menu (expande no desktop, gaveta no celular) e foca a busca de telas.
  function focarBusca() {
    if (ehMobile) setMenuMobileAberto(true);
    else if (!menuAberto) definirMenuAberto(true);
    // Espera o input existir/ficar visível depois da expansão.
    window.setTimeout(() => buscaRef.current?.focus(), 50);
  }

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focarBusca();
      }
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  });

  const ehGestao = usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR';
  const permissoes = usuario?.perfil?.permissoes ?? [];

  // Solicitações pendentes de OS (docs/13 §6.2) — só ADMIN/GESTOR têm a permissão da rota.
  const solicitacoesQuery = useQuery({
    queryKey: ['ordens-servico', 'solicitacoes-pendentes-count'],
    queryFn: () => listarOrdensServico({ status: [...STATUS_SOLICITACAO] }),
    enabled: ehGestao,
    refetchInterval: 60_000,
  });
  const solicitacoesPendentes = solicitacoesQuery.data?.meta.total ?? 0;

  // Contador de Atividades (docs/43 §6 decisão 5) — respostas novas + alertas sem tratativa
  // (esses só quando a empresa usa resolução de alerta).
  const resumoAtividadesQuery = useQuery({
    queryKey: ['atividades-resumo', 'menu'],
    queryFn: () => buscarResumoAtividades(),
    enabled: ehGestao,
    refetchInterval: 60_000,
  });
  const resumoAtividades = resumoAtividadesQuery.data;
  const contadorAtividades = resumoAtividades
    ? resumoAtividades.respostas_novas + (resumoAtividades.requer_resolucao ? resumoAtividades.alertas.total : 0)
    : 0;

  // Promotores com rastreamento irregular (docs/47) — GESTOR sem rastreamento.visualizar recebe
  // 403 e o contador não aparece (retry: false pra não martelar a API).
  const conformidadeQuery = useQuery({
    queryKey: ['localizacoes', 'conformidade', 'menu'],
    queryFn: buscarConformidadeRastreamento,
    enabled: ehGestao,
    refetchInterval: 60_000,
    retry: false,
  });
  const irregularesRastreamento = conformidadeQuery.data?.habilitado ? conformidadeQuery.data.irregulares.length : 0;

  // Gates de visibilidade: o backend também barra (403), aqui é só a UX de esconder o link.
  // Detalhes de cada regra nos docs citados.
  const grupos: GrupoMenu[] = [
    {
      rotulo: 'Operação',
      itens: [
        { rotulo: 'Operação do dia', caminho: '/operacao-do-dia', icone: <InsightsIcon />, visivel: ehGestao }, // docs/32
        { rotulo: 'Visitas', caminho: '/visitas', icone: <AssignmentIcon /> },
        { rotulo: 'Pontos de venda', caminho: '/pontos-venda', icone: <StoreIcon /> },
        { rotulo: 'Atividades', caminho: '/atividades', icone: <BoltIcon />, contador: contadorAtividades, visivel: ehGestao }, // docs/19
        { rotulo: 'Planos de ação', caminho: '/planos-acao', icone: <TaskAltIcon />, visivel: ehGestao }, // docs/37
        {
          // docs/38 — módulo contratado + ADMIN ou GESTOR com alguma permissão pedidos_venda.*
          rotulo: 'Pedidos de venda',
          caminho: '/pedidos-venda',
          icone: <ShoppingCartOutlinedIcon />,
          visivel:
            Boolean(usuario?.empresa?.pedidos_venda_habilitado) &&
            (usuario?.user_type === 'ADMIN' ||
              (usuario?.user_type === 'GESTOR' && permissoes.some((p) => p.startsWith('pedidos_venda.')))),
        },
        { rotulo: 'Galeria de registros', caminho: '/galeria-fotos', icone: <PhotoLibraryIcon />, visivel: ehGestao }, // docs/23
        { rotulo: 'Registros', caminho: '/registros', icone: <ChecklistIcon />, visivel: ehGestao }, // docs/44
        { rotulo: 'Mapa ao vivo', caminho: '/rastreamento', icone: <MyLocationIcon />, contador: irregularesRastreamento, visivel: ehGestao }, // docs/11
        { rotulo: 'Rota do dia', caminho: '/rota-do-dia', icone: <AltRouteIcon />, visivel: ehGestao }, // docs/48
        { rotulo: 'Cumprimento de visitas', caminho: '/relatorios/visitas-planejadas', icone: <AssessmentIcon />, visivel: ehGestao }, // docs/28
        { rotulo: 'Coleta por formulário', caminho: '/relatorios/respostas-formulario', icone: <FactCheckIcon />, visivel: ehGestao },
      ],
    },
    {
      rotulo: 'Cadastros',
      itens: [
        { rotulo: 'Catálogo', caminho: '/catalogo', icone: <CategoryIcon /> },
        { rotulo: 'Redes de lojas', caminho: '/redes-lojas', icone: <AccountTreeIcon /> },
        { rotulo: 'Ramos de atividade', caminho: '/ramos-atividade', icone: <WorkIcon /> },
        { rotulo: 'Motivos de resolução', caminho: '/motivos-resolucao-alerta', icone: <RuleIcon /> },
        { rotulo: 'Formulários', caminho: '/tipos-registro', icone: <ListAltIcon /> },
        { rotulo: 'Planogramas', caminho: '/planogramas', icone: <GridViewIcon /> },
        { rotulo: 'Campanhas', caminho: '/campanhas', icone: <CampaignIcon /> },
        { rotulo: 'Contratos', caminho: '/contratos', icone: <DescriptionIcon /> },
        { rotulo: 'Ordens de serviço', caminho: '/ordens-servico', icone: <EventNoteIcon />, contador: solicitacoesPendentes },
        { rotulo: 'Direcionamentos', caminho: '/direcionamentos', icone: <SendIcon /> }, // docs/25
        { rotulo: 'Agenda de visita', caminho: '/agendas-visita', icone: <CalendarMonthIcon /> },
        { rotulo: 'Planejador de visitas', caminho: '/planejador-visitas', icone: <EventRepeatIcon /> },
        { rotulo: 'Tipos de visita', caminho: '/tipos-visita', icone: <LabelIcon /> },
        { rotulo: 'Objetivos de visita', caminho: '/objetivos-visita', icone: <FlagIcon /> },
        { rotulo: 'Centros de custo', caminho: '/centros-custo', icone: <PaidIcon /> },
        { rotulo: 'Usuários', caminho: '/usuarios', icone: <PeopleIcon /> },
        // Gestão de perfis é sempre user_type:ADMIN exato no backend (nem SUPERADMIN passa).
        { rotulo: 'Perfis', caminho: '/perfis', icone: <SecurityIcon />, visivel: usuario?.user_type === 'ADMIN' },
        {
          // docs/42 — lojas/vínculo: pontos_venda.gerenciar; produtos: catalogo.gerenciar
          rotulo: 'Importação de dados',
          caminho: '/importacao-dados',
          icone: <UploadFileIcon />,
          visivel:
            usuario?.user_type === 'ADMIN' ||
            (usuario?.user_type === 'GESTOR' &&
              permissoes.some((p) => p === 'pontos_venda.gerenciar' || p === 'catalogo.gerenciar')),
        },
      ],
    },
    {
      rotulo: 'Outros',
      itens: [
        { rotulo: 'Parâmetros', caminho: '/parametros', icone: <TuneIcon /> },
        { rotulo: 'Manual', caminho: '/manual', icone: <HelpOutlineIcon /> },
        // SUPERADMIN não pertence a empresa nenhuma — CRUD de empresas clientes é só dele.
        { rotulo: 'Empresas', caminho: '/empresas', icone: <BusinessIcon />, visivel: usuario?.user_type === 'SUPERADMIN' },
      ],
    },
  ];

  const termo = normalizar(busca.trim());
  const gruposVisiveis = grupos
    .map((g) => ({
      ...g,
      itens: g.itens.filter((i) => i.visivel !== false && (!termo || normalizar(i.rotulo).includes(termo))),
    }))
    .filter((g) => g.itens.length > 0);

  function emRota(caminho: string): boolean {
    return location.pathname === caminho || location.pathname.startsWith(`${caminho}/`);
  }

  function aoNavegar() {
    setBusca('');
    if (ehMobile) setMenuMobileAberto(false);
  }

  const menu = (
    <MenuLateral
      mini={mini}
      grupos={gruposVisiveis}
      busca={busca}
      termo={termo}
      buscaRef={buscaRef}
      emRota={emRota}
      onBusca={setBusca}
      onEnterBusca={() => {
        const primeiro = gruposVisiveis[0]?.itens[0];
        if (primeiro) {
          navigate(primeiro.caminho);
          aoNavegar();
          buscaRef.current?.blur();
        }
      }}
      onNavegar={aoNavegar}
      onRecolher={ehMobile ? () => setMenuMobileAberto(false) : () => definirMenuAberto(!menuAberto)}
      onBuscaMini={focarBusca}
      rodape={
        usuario && (
          <RodapeUsuario
            mini={mini}
            nome={usuario.nome}
            fotoUrl={usuario.foto_url}
            empresa={usuario.empresa?.nome_fantasia ?? usuario.user_type}
            onSair={() => void logout()}
          />
        )
      }
    />
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {ehMobile ? (
        <Drawer
          variant="temporary"
          open={menuMobileAberto}
          onClose={() => setMenuMobileAberto(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: LARGURA_MENU, border: 0 } }}
        >
          {menu}
        </Drawer>
      ) : (
        <Box
          component="aside"
          className="app-menu-lateral"
          aria-label="Menu principal"
          sx={{
            width: mini ? LARGURA_MENU_MINI : LARGURA_MENU,
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            height: '100vh',
            bgcolor: 'background.paper',
            borderRight: `1px solid ${horus.borda}`,
            transition: 'width 160ms ease',
            zIndex: 2,
          }}
        >
          {menu}
        </Box>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Box
          component="header"
          className="app-header"
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            minHeight: 60,
            px: { xs: 2, md: 3 },
            py: 1.25,
            bgcolor: 'background.paper',
            borderBottom: `1px solid ${horus.borda}`,
          }}
        >
          {ehMobile && (
            <BotaoQuadrado rotulo="Abrir menu" onClick={() => setMenuMobileAberto(true)}>
              <MenuIcon />
            </BotaoQuadrado>
          )}
          {/* Alvo do portal — cada página injeta aqui o título e as ações (usePageHeader). Títulos
              ainda feitos com Typography h6 ganham o tamanho de título de página (17px). */}
          <Box
            ref={setHeaderSlot}
            sx={{
              flex: 1,
              minWidth: 0,
              '& .MuiTypography-h6, & .MuiTypography-h5': { fontSize: 17, fontWeight: 600, lineHeight: 1.3 },
            }}
          />
          <Box sx={{ width: '1px', height: 24, bgcolor: horus.borda, mx: 0.5, display: { xs: 'none', sm: 'block' } }} />
          {/* Saída de segurança pra visita travada (docs/15 §12) — backend barra sem visitas.intervir. */}
          {ehGestao && <AutorizacaoGestorButton />}
          <BotaoQuadrado rotulo="Buscar tela (Ctrl K)" onClick={focarBusca}>
            <SearchIcon />
          </BotaoQuadrado>
        </Box>

        <Box component="main" sx={{ flex: 1, minWidth: 0, px: { xs: 2, md: 3 }, pt: { xs: 2, md: 2.5 }, pb: 5 }}>
          <HeaderSlotContext.Provider value={headerSlot}>
            <Outlet />
          </HeaderSlotContext.Provider>
        </Box>
      </Box>
    </Box>
  );
}

function MenuLateral({
  mini,
  grupos,
  busca,
  termo,
  buscaRef,
  emRota,
  onBusca,
  onEnterBusca,
  onNavegar,
  onRecolher,
  onBuscaMini,
  rodape,
}: {
  mini: boolean;
  grupos: GrupoMenu[];
  busca: string;
  termo: string;
  buscaRef: RefObject<HTMLInputElement | null>;
  emRota: (caminho: string) => boolean;
  onBusca: (valor: string) => void;
  onEnterBusca: () => void;
  onNavegar: () => void;
  onRecolher: () => void;
  onBuscaMini: () => void;
  rodape: ReactNode;
}) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', py: 2, px: mini ? 1.25 : 1.5 }}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: mini ? 'column' : 'row',
          alignItems: 'center',
          gap: 1.25,
          px: mini ? 0 : 0.5,
          pb: 2,
          borderBottom: `1px solid ${horus.borda}`,
        }}
      >
        <Box sx={{ width: mini ? 20 : 92, overflow: 'hidden', flexShrink: 0, lineHeight: 0 }}>
          <LogoHorus />
        </Box>
        <Box sx={{ flex: 1 }} />
        <BotaoQuadrado rotulo={mini ? 'Expandir menu' : 'Recolher menu'} onClick={onRecolher} pequeno>
          <KeyboardDoubleArrowLeftIcon sx={{ transform: mini ? 'rotate(180deg)' : undefined }} />
        </BotaoQuadrado>
      </Box>

      {mini ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 1.75 }}>
          <BotaoQuadrado rotulo="Buscar tela (Ctrl K)" onClick={onBuscaMini} pequeno>
            <SearchIcon />
          </BotaoQuadrado>
        </Box>
      ) : (
        <Box
          component="label"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            height: 32,
            px: 1,
            mt: 1.75,
            mb: 0.5,
            border: `1px solid ${horus.bordaCampo}`,
            borderRadius: '6px',
            color: horus.textoFraco,
            '&:focus-within': { borderColor: horus.indigo, color: horus.indigo },
            '&:focus-within kbd': { display: 'none' },
          }}
        >
          <SearchIcon sx={{ fontSize: 16 }} />
          <Box
            component="input"
            ref={buscaRef}
            type="search"
            value={busca}
            placeholder="Buscar tela"
            autoComplete="off"
            aria-label="Buscar no menu"
            onChange={(e: ChangeEvent<HTMLInputElement>) => onBusca(e.target.value)}
            onKeyDown={(e: ReactKeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') onEnterBusca();
              if (e.key === 'Escape') {
                onBusca('');
                e.currentTarget.blur();
              }
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              border: 0,
              outline: 0,
              bgcolor: 'transparent',
              font: 'inherit',
              fontSize: 13,
              color: horus.texto,
              '&::placeholder': { color: horus.textoFraco },
            }}
          />
          <Box
            component="kbd"
            sx={{
              font: `500 10.5px ${horus.mono}`,
              color: horus.textoFraco,
              border: `1px solid ${horus.borda}`,
              borderRadius: '4px',
              px: 0.5,
            }}
          >
            Ctrl K
          </Box>
        </Box>
      )}

      <Box component="nav" sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', mt: 0.5, mx: -0.5, px: 0.5 }}>
        {grupos.length === 0 && (
          <Typography sx={{ mt: 1, px: 1.25, color: 'text.secondary' }}>Nenhuma tela encontrada.</Typography>
        )}
        {grupos.map((grupo) => (
          <Box key={grupo.rotulo} sx={{ mt: 1.75, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {!mini && (
              <Typography
                component="div"
                sx={{
                  fontSize: 11,
                  fontWeight: 500,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: horus.textoFraco,
                  px: 1.25,
                  pb: 0.75,
                }}
              >
                {grupo.rotulo}
              </Typography>
            )}
            {grupo.itens.map((item) => (
              <ItemDoMenu
                key={item.caminho}
                item={item}
                mini={mini}
                termo={termo}
                ativo={emRota(item.caminho)}
                onClick={onNavegar}
              />
            ))}
          </Box>
        ))}
      </Box>

      {rodape}
    </Box>
  );
}

function ItemDoMenu({
  item,
  mini,
  termo,
  ativo,
  onClick,
}: {
  item: ItemMenu;
  mini: boolean;
  termo: string;
  ativo: boolean;
  onClick: () => void;
}) {
  const contador = item.contador ?? 0;
  const botao = (
    <ListItemButton
      component={NavLink}
      to={item.caminho}
      selected={ativo}
      onClick={onClick}
      disableRipple
      aria-label={mini ? item.rotulo : undefined}
      sx={{
        flex: 'none',
        height: 34,
        minHeight: 34,
        px: mini ? 0 : 1.25,
        gap: 1.25,
        justifyContent: mini ? 'center' : 'flex-start',
        borderRadius: '6px',
        color: horus.texto2,
        fontSize: 13,
        '& .MuiListItemIcon-root': { minWidth: 0, color: horus.textoSecundario, position: 'relative' },
        '& .MuiListItemIcon-root svg': { fontSize: 17 },
        '&:hover': { bgcolor: horus.indigoClaro, color: horus.indigoEscuro },
        '&:hover .MuiListItemIcon-root': { color: horus.indigo },
        '&.Mui-selected, &.Mui-selected:hover': { bgcolor: horus.indigo, color: '#fff', fontWeight: 500 },
        '&.Mui-selected .MuiListItemIcon-root': { color: '#fff' },
        '&.Mui-focusVisible': { outline: `2px solid ${horus.indigo}`, outlineOffset: 1, bgcolor: 'transparent' },
        '&.Mui-selected.Mui-focusVisible': { bgcolor: horus.indigo },
      }}
    >
      <ListItemIcon>
        {item.icone}
        {mini && contador > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: -2,
              right: -4,
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: horus.ambar,
              border: '1.5px solid #fff',
            }}
          />
        )}
      </ListItemIcon>
      {!mini && (
        <>
          <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Destaque texto={item.rotulo} termo={termo} />
          </Box>
          {contador > 0 && (
            <Box
              component="span"
              sx={{
                font: `600 11px ${horus.mono}`,
                color: horus.ambarEscuro,
                bgcolor: horus.ambarClaro,
                px: 0.75,
                borderRadius: '4px',
                lineHeight: '18px',
              }}
            >
              {contador > 99 ? '99+' : contador}
            </Box>
          )}
        </>
      )}
    </ListItemButton>
  );

  return mini ? (
    <Tooltip title={contador > 0 ? `${item.rotulo} (${contador})` : item.rotulo} placement="right">
      {botao}
    </Tooltip>
  ) : (
    botao
  );
}

/** Marca o trecho buscado dentro do rótulo — o termo já vem normalizado (sem acento). */
function Destaque({ texto, termo }: { texto: string; termo: string }) {
  const i = termo ? normalizar(texto).indexOf(termo) : -1;
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <Box component="mark" sx={{ bgcolor: '#fde68a', color: 'inherit', borderRadius: '2px' }}>
        {texto.slice(i, i + termo.length)}
      </Box>
      {texto.slice(i + termo.length)}
    </>
  );
}

function RodapeUsuario({
  mini,
  nome,
  fotoUrl,
  empresa,
  onSair,
}: {
  mini: boolean;
  nome: string;
  fotoUrl?: string | null;
  empresa: string;
  onSair: () => void;
}) {
  const [ancora, setAncora] = useState<HTMLElement | null>(null);
  const abrir = (e: ReactMouseEvent<HTMLElement>) => setAncora(e.currentTarget);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: mini ? 'center' : 'flex-start',
        gap: 1.25,
        pt: 1.75,
        px: mini ? 0 : 0.5,
        mt: 1,
        borderTop: `1px solid ${horus.borda}`,
      }}
    >
      {mini ? (
        <IconButton onClick={abrir} aria-label="Opções da conta" title={nome} sx={{ p: 0, borderRadius: '50%' }}>
          <UsuarioAvatar nome={nome} fotoUrl={fotoUrl} size={32} />
        </IconButton>
      ) : (
        <>
          <UsuarioAvatar nome={nome} fotoUrl={fotoUrl} size={32} />
          <Box sx={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
            <Typography noWrap sx={{ fontSize: 13, fontWeight: 500 }}>
              {nome}
            </Typography>
            <Typography noWrap sx={{ fontSize: 12, color: 'text.secondary' }}>
              {empresa}
            </Typography>
          </Box>
          <BotaoQuadrado rotulo="Opções da conta" onClick={abrir} pequeno>
            <UnfoldMoreIcon />
          </BotaoQuadrado>
        </>
      )}
      <Menu
        anchorEl={ancora}
        open={Boolean(ancora)}
        onClose={() => setAncora(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <MenuItem
          onClick={() => {
            setAncora(null);
            onSair();
          }}
          sx={{ gap: 1 }}
        >
          <LogoutIcon sx={{ fontSize: 17, color: 'text.secondary' }} />
          Sair
        </MenuItem>
      </Menu>
    </Box>
  );
}

/** Botão de ícone quadrado com borda (34px; 26px no `pequeno`), padrão do header e do menu. */
function BotaoQuadrado({
  rotulo,
  onClick,
  pequeno,
  children,
}: {
  rotulo: string;
  onClick: (e: ReactMouseEvent<HTMLElement>) => void;
  pequeno?: boolean;
  children: ReactNode;
}) {
  const lado = pequeno ? 26 : 34;
  return (
    <IconButton
      onClick={onClick}
      aria-label={rotulo}
      title={rotulo}
      sx={{
        width: lado,
        height: lado,
        flexShrink: 0,
        border: `1px solid ${horus.bordaCampo}`,
        borderRadius: '6px',
        color: horus.textoSecundario,
        '& svg': { fontSize: pequeno ? 15 : 18 },
        '&:hover': { color: horus.texto, bgcolor: horus.hover },
      }}
    >
      {children}
    </IconButton>
  );
}

/** Logotipo Horus (Manual da marca) — recolhido, o contêiner corta e sobra só o "H". */
function LogoHorus() {
  return (
    <svg viewBox="-20 18 860 204" role="img" aria-label="Horus" style={{ width: 92, height: 'auto', display: 'block' }}>
      <g fill="#4f46e5">
        <path d="M0,40 H36 V200 H0 Z" />
        <path d="M104,40 H140 V200 H104 Z" />
      </g>
      <path
        fill="#f59e0b"
        d="M0,40 H36 C36,86 50,102 70,102 C112,102 140,132 140,200 H104 C104,154 92,138 70,138 C28,138 0,108 0,40 Z"
      />
      <path
        fill="#f59e0b"
        fillRule="evenodd"
        d="M246,38 A82,82 0 1 1 246,202 A82,82 0 1 1 246,38 Z M246,74 A46,46 0 1 0 246,166 A46,46 0 1 0 246,74 Z"
      />
      <g fill="#3730a3" fillRule="evenodd">
        <path transform="translate(352,0)" d="M0,200 V40 H70 A49,49 0 0 1 70,138 H36 V200 Z M36,76 V102 H70 A13,13 0 0 0 70,76 Z" />
        <path transform="translate(352,0)" d="M58,126 H100 L140,200 H98 Z" />
        <path transform="translate(516,0)" d="M0,40 V130 A70,70 0 0 0 140,130 V40 H104 V130 A34,34 0 0 1 36,130 V40 Z" />
        <path
          transform="translate(680,0)"
          d="M140,40 H49 A49,49 0 0 0 49,138 H91 A13,13 0 0 1 91,164 H0 V200 H91 A49,49 0 0 0 91,102 H49 A13,13 0 0 1 49,76 H140 Z"
        />
      </g>
    </svg>
  );
}

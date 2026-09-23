import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BoltIcon from '@mui/icons-material/Bolt';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import CategoryIcon from '@mui/icons-material/Category';
import DescriptionIcon from '@mui/icons-material/Description';
import EventNoteIcon from '@mui/icons-material/EventNote';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import SendIcon from '@mui/icons-material/Send';
import FlagIcon from '@mui/icons-material/Flag';
import GridViewIcon from '@mui/icons-material/GridView';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import LabelIcon from '@mui/icons-material/Label';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PaidIcon from '@mui/icons-material/Paid';
import AssessmentIcon from '@mui/icons-material/Assessment';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PeopleIcon from '@mui/icons-material/People';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SecurityIcon from '@mui/icons-material/Security';
import StoreIcon from '@mui/icons-material/Store';
import TuneIcon from '@mui/icons-material/Tune';
import WorkIcon from '@mui/icons-material/Work';
import {
  AppBar,
  Badge,
  Box,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { buscarNaoLidos } from '../../lib/api/comentarios';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { AutorizacaoGestorButton } from '../AutorizacaoGestorButton';
import { UsuarioAvatar } from '../UsuarioAvatar';
import { listarOrdensServico } from '../../lib/api/ordensServico';
import { useAuth } from '../../lib/auth/AuthContext';
import { HeaderSlotContext } from './PageHeaderSlot';

// Visual do menu lateral (docs/24-TEMA-ADMIN-WEB.md) reproduz o handoff de design
// ("Interface administrativa indigo e amber" — Galeria de Fotos.dc.html / Atividades.dc.html):
// fundo escuro fixo, independente do tema claro do resto do admin (não vem do palette do MUI —
// é a mesma cor em qualquer viewer, então os valores ficam hardcoded aqui, não em theme.ts).
const SIDEBAR = {
  bg: '#171531',
  texto: '#c9c6e4',
  textoFraco: '#6f6b9c',
  hoverBg: '#221f45',
  ativoBg: '#2b2660',
  amber: '#fbbf24',
  indigo: '#4f46e5',
};

const DRAWER_WIDTH = 250;
const STATUS_SOLICITACAO = ['AGUARDANDO_APROVACAO', 'REAGENDAMENTO_SOLICITADO', 'CANCELAMENTO_SOLICITADO'] as const;
const CHAVE_MENU_ABERTO = 'pdv-admin:menu-lateral-aberto';

export function AppLayout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  // Alvo do portal de cada página pra "descrição da rotina" (ver PageHeaderSlot.tsx) — fica no
  // header em vez de repetir "título + frase explicando a tela" dentro do corpo de cada página.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  // Expandir/recolher o menu lateral (botão hambúrguer no header) — persiste em localStorage,
  // puro conforto do viewer (nunca lido pelo backend nem por outra aba/dispositivo), então
  // funciona bem sem exigir nenhuma capability de artifact/servidor. Lido só na inicialização;
  // tenta/ignora falha (modo privado, storage bloqueado) sem travar o layout.
  const [menuAberto, setMenuAberto] = useState<boolean>(() => {
    try {
      return localStorage.getItem(CHAVE_MENU_ABERTO) !== '0';
    } catch {
      return true;
    }
  });

  function alternarMenu() {
    setMenuAberto((atual) => {
      const novo = !atual;
      try {
        localStorage.setItem(CHAVE_MENU_ABERTO, novo ? '1' : '0');
      } catch {
        // Storage indisponível — só não persiste a preferência, o toggle em si continua indo.
      }
      return novo;
    });
  }

  // Contagem de solicitações pendentes (docs/13-AGENDA-MOBILE-E-AUTONOMIA.md §6.2) — visibilidade
  // passiva assim que o gestor abre o admin, sem depender de push. Só ADMIN/GESTOR têm a
  // permissão que essa rota exige; PROMOTOR nunca vê este menu de qualquer forma.
  const solicitacoesQuery = useQuery({
    queryKey: ['ordens-servico', 'solicitacoes-pendentes-count'],
    queryFn: () => listarOrdensServico({ status: [...STATUS_SOLICITACAO] }),
    enabled: usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR',
    refetchInterval: 60_000,
  });
  const solicitacoesPendentes = solicitacoesQuery.data?.meta.total ?? 0;

  // Badge de feedback não lido (docs/28 §3) — polling, sem push. Aparece no item Atividades.
  const naoLidosQuery = useQuery({
    queryKey: ['comentarios-nao-lidos'],
    queryFn: buscarNaoLidos,
    enabled: usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR',
    refetchInterval: 60_000,
  });
  const naoLidos = naoLidosQuery.data;

  // `NavLink` só calcula `active` sozinho quando NINGUÉM mais fornece `className` — o
  // `ListItemButton` do MUI sempre passa a própria lista de classes geradas pra baixo, o que
  // pisa nesse comportamento automático. Por isso a rota atual é calculada aqui e passada via
  // `selected` (prop nativa do MUI, vira classe `.Mui-selected`), não via `.active` do router.
  function emRota(caminho: string): boolean {
    return location.pathname === caminho || location.pathname.startsWith(`${caminho}/`);
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          width: menuAberto ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          ml: menuAberto ? `${DRAWER_WIDTH}px` : 0,
          bgcolor: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          transition: (theme) =>
            theme.transitions.create(['width', 'margin'], { easing: theme.transitions.easing.sharp, duration: 200 }),
        }}
      >
        <Toolbar sx={{ display: 'flex', gap: 2 }}>
          <IconButton
            onClick={alternarMenu}
            edge="start"
            sx={{ flexShrink: 0 }}
            title={menuAberto ? 'Recolher menu' : 'Expandir menu'}
          >
            <MenuIcon />
          </IconButton>
          {/* Alvo do portal — cada página injeta aqui sua descrição/ação (usePageHeader), ganhando
              espaço vertical no corpo pra relatório/tabela/feed. Vazio quando a página não usa o
              hook (ex. telas que ainda não migraram esse padrão). */}
          <Box ref={setHeaderSlot} sx={{ flex: 1, minWidth: 0 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            {usuario && <UsuarioAvatar nome={usuario.nome} fotoUrl={usuario.foto_url} size={32} />}
            <Typography variant="body2" noWrap>
              {usuario?.nome} · {usuario?.empresa?.nome_fantasia ?? usuario?.user_type}
            </Typography>
            {/* Saída de segurança pra visita travada, sem o gestor digitar e-mail/senha no
                aparelho do promotor — ver docs/15-INTERVENCAO-ADMINISTRATIVA-VISITA.md §12. O
                backend barra quem não tem visitas.intervir, então mostra pra ADMIN/GESTOR igual
                aos outros itens gated deste jeito. */}
            {(usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR') && <AutorizacaoGestorButton />}
            <IconButton onClick={() => void logout()} title="Sair">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: menuAberto ? DRAWER_WIDTH : 0,
          flexShrink: 0,
          // Item flex, por padrão, não encolhe abaixo do min-content do conteúdo interno (a
          // regra CSS `min-width: auto` implícita) — sem isso, o `width: 0` acima é ignorado e o
          // menu continua do tamanho de sempre mesmo "fechado". Ver overflowX abaixo, que só
          // funciona depois que o width de verdade encolhe.
          minWidth: 0,
          overflowX: 'hidden',
          transition: (theme) => theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: 200 }),
          // O papel do Drawer (a folha escura em si) usa `position: fixed` mesmo no variant
          // "permanent" — não fica preso ao box do pai, então `overflowX` no root acima NÃO
          // clipa ele sozinho (overflow de ancestral não recorta descendente fixed, a menos que
          // o ancestral vire "containing block", o que não é o caso aqui). Por isso o encolhe
          // direto aqui também, em espelho do root — sem isso, o menu "fechava" só por baixo dos
          // panos (o root ia pra 0, mas a folha continuava pintando por cima, cheia, sempre).
          '& .MuiDrawer-paper': {
            width: menuAberto ? DRAWER_WIDTH : 0,
            overflowX: 'hidden',
            boxSizing: 'border-box',
            bgcolor: SIDEBAR.bg,
            color: SIDEBAR.texto,
            borderRight: 0,
            transition: (theme) => theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: 200 }),
          },
          '& .MuiListSubheader-root': {
            bgcolor: 'transparent',
            color: SIDEBAR.textoFraco,
            fontSize: '10.5px',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            lineHeight: 2.4,
          },
          '& .MuiListItemButton-root': {
            mx: 1.5,
            borderRadius: 2,
            color: SIDEBAR.texto,
            '&:hover': { bgcolor: SIDEBAR.hoverBg, color: '#fff' },
            '&.Mui-selected': {
              bgcolor: SIDEBAR.ativoBg,
              color: '#fff',
              fontWeight: 600,
              boxShadow: `inset 2px 0 0 ${SIDEBAR.amber}`,
            },
            '&.Mui-selected:hover': { bgcolor: SIDEBAR.ativoBg },
            '&.Mui-selected .MuiListItemIcon-root': { color: '#fff' },
            '&:hover .MuiListItemIcon-root': { color: '#fff' },
          },
          '& .MuiListItemIcon-root': {
            color: '#8d89bd',
            minWidth: 38,
          },
          '& .MuiListItemText-primary': {
            fontSize: '13.5px',
          },
        }}
      >
        {/* Logo — mesmo lockup do handoff de design: quadrado indigo com um recorte amber
            dentro, "PDV Admin" ao lado. Substitui o Toolbar-espaçador antigo (que só existia
            pra compensar a altura da AppBar). */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2.75, py: 2.75 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: '9px',
              bgcolor: SIDEBAR.indigo,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Box sx={{ width: 9, height: 9, borderRadius: '2px', bgcolor: SIDEBAR.amber }} />
          </Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em', color: '#fff' }}>
            PDV Admin
          </Typography>
        </Box>
        <List subheader={<ListSubheader>Operação</ListSubheader>}>
          {/* Protótipo com dado mocado, só pra validar layout — ver
              docs/32-PAINEL-OPERACAO-DO-DIA.md. Mesmo gate de "Atividades" (ADMIN/GESTOR). */}
          {(usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR') && (
            <ListItemButton component={NavLink} to="/operacao-do-dia" selected={emRota('/operacao-do-dia')}>
              <ListItemIcon>
                <InsightsIcon />
              </ListItemIcon>
              <ListItemText primary="Operação do dia" />
              <Chip
                label="protótipo"
                size="small"
                variant="outlined"
                sx={{ height: 18, fontSize: '9.5px', color: SIDEBAR.textoFraco, borderColor: SIDEBAR.textoFraco }}
              />
            </ListItemButton>
          )}
          <ListItemButton component={NavLink} to="/visitas" selected={emRota('/visitas')}>
            <ListItemIcon>
              <AssignmentIcon />
            </ListItemIcon>
            <ListItemText primary="Visitas" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/pontos-venda" selected={emRota('/pontos-venda')}>
            <ListItemIcon>
              <StoreIcon />
            </ListItemIcon>
            <ListItemText primary="Pontos de Venda" />
          </ListItemButton>
          {/* Timeline de supervisão (check-in/checkout/alertas) — pensada pra substituir o
              grupo de WhatsApp do gestor, ver docs/19-PAINEL-ATIVIDADES.md. PROMOTOR não vê:
              o backend também bloqueia (403), o gate aqui é só a UX de esconder o link. */}
          {(usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR') && (
            <ListItemButton component={NavLink} to="/atividades" selected={emRota('/atividades')}>
              <ListItemIcon>
                <Badge color="error" badgeContent={naoLidos?.total ?? 0} max={99}>
                  <BoltIcon />
                </Badge>
              </ListItemIcon>
              <ListItemText primary="Atividades" />
            </ListItemButton>
          )}
          {/* Grade só de fotos (diferente do Atividades, que é timeline de eventos) — mesmo
              gate de ADMIN/GESTOR, ver docs/23-GALERIA-DE-FOTOS.md §4. */}
          {(usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR') && (
            <ListItemButton component={NavLink} to="/galeria-fotos" selected={emRota('/galeria-fotos')}>
              <ListItemIcon>
                <PhotoLibraryIcon />
              </ListItemIcon>
              <ListItemText primary="Galeria de Fotos" />
            </ListItemButton>
          )}
          {/* Relatórios agregados (docs/28 §2) — ADMIN/GESTOR, a API também barra com 403. */}
          {(usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR') && (
            <>
              <ListItemButton
                component={NavLink}
                to="/relatorios/visitas-planejadas"
                selected={emRota('/relatorios/visitas-planejadas')}
              >
                <ListItemIcon>
                  <AssessmentIcon />
                </ListItemIcon>
                <ListItemText primary="Cumprimento de visitas" />
              </ListItemButton>
              <ListItemButton
                component={NavLink}
                to="/relatorios/respostas-formulario"
                selected={emRota('/relatorios/respostas-formulario')}
              >
                <ListItemIcon>
                  <FactCheckIcon />
                </ListItemIcon>
                <ListItemText primary="Respostas por pergunta" />
              </ListItemButton>
            </>
          )}
        </List>
        <List subheader={<ListSubheader>Gestão</ListSubheader>}>
          <ListItemButton component={NavLink} to="/catalogo" selected={emRota('/catalogo')}>
            <ListItemIcon>
              <CategoryIcon />
            </ListItemIcon>
            <ListItemText primary="Catálogo" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/redes-lojas" selected={emRota('/redes-lojas')}>
            <ListItemIcon>
              <AccountTreeIcon />
            </ListItemIcon>
            <ListItemText primary="Redes de Lojas" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/ramos-atividade" selected={emRota('/ramos-atividade')}>
            <ListItemIcon>
              <WorkIcon />
            </ListItemIcon>
            <ListItemText primary="Ramos de Atividade" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/tipos-registro" selected={emRota('/tipos-registro')}>
            <ListItemIcon>
              <ListAltIcon />
            </ListItemIcon>
            <ListItemText primary="Formulários" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/planogramas" selected={emRota('/planogramas')}>
            <ListItemIcon>
              <GridViewIcon />
            </ListItemIcon>
            <ListItemText primary="Planogramas" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/campanhas" selected={emRota('/campanhas')}>
            <ListItemIcon>
              <CampaignIcon />
            </ListItemIcon>
            <ListItemText primary="Campanhas" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/contratos" selected={emRota('/contratos')}>
            <ListItemIcon>
              <DescriptionIcon />
            </ListItemIcon>
            <ListItemText primary="Contratos" />
          </ListItemButton>
          <ListItemButton
            component={NavLink}
            to="/ordens-servico"
            selected={emRota('/ordens-servico')}
            sx={{ justifyContent: 'space-between' }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
              <ListItemIcon>
                <EventNoteIcon />
              </ListItemIcon>
              <ListItemText primary="Ordens de Serviço" />
            </Box>
            {solicitacoesPendentes > 0 && <BadgeAmber valor={solicitacoesPendentes} />}
          </ListItemButton>
          {/* Molde que gera Ordem de Serviço em massa — ver docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md. */}
          <ListItemButton component={NavLink} to="/direcionamentos" selected={emRota('/direcionamentos')}>
            <ListItemIcon>
              <SendIcon />
            </ListItemIcon>
            <ListItemText primary="Direcionamentos" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/agendas-visita" selected={emRota('/agendas-visita')}>
            <ListItemIcon>
              <CalendarMonthIcon />
            </ListItemIcon>
            <ListItemText primary="Agenda de Visita" />
          </ListItemButton>
          {/* Quadro de arrastar-e-soltar pra montar a rota fixa semanal — edita as mesmas
              AgendaVisita de recorrência SEMANAL da tela acima, só que em lote e visual. */}
          <ListItemButton component={NavLink} to="/planejador-visitas" selected={emRota('/planejador-visitas')}>
            <ListItemIcon>
              <EventRepeatIcon />
            </ListItemIcon>
            <ListItemText primary="Planejador de Visitas" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/tipos-visita" selected={emRota('/tipos-visita')}>
            <ListItemIcon>
              <LabelIcon />
            </ListItemIcon>
            <ListItemText primary="Tipos de Visita" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/objetivos-visita" selected={emRota('/objetivos-visita')}>
            <ListItemIcon>
              <FlagIcon />
            </ListItemIcon>
            <ListItemText primary="Objetivos de Visita" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/centros-custo" selected={emRota('/centros-custo')}>
            <ListItemIcon>
              <PaidIcon />
            </ListItemIcon>
            <ListItemText primary="Centros de Custo" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/usuarios" selected={emRota('/usuarios')}>
            <ListItemIcon>
              <PeopleIcon />
            </ListItemIcon>
            <ListItemText primary="Usuários" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/parametros" selected={emRota('/parametros')}>
            <ListItemIcon>
              <TuneIcon />
            </ListItemIcon>
            <ListItemText primary="Parâmetros" />
          </ListItemButton>
          {/* Mapa ao vivo dos promotores (docs/11-RASTREAMENTO-TEMPO-REAL.md) — ADMIN sempre; GESTOR vê o
              item e a API barra com 403 sem rastreamento.visualizar (a tela trata) — o /auth/me não
              expõe as permissões do perfil, mesmo critério dos outros itens. */}
          {(usuario?.user_type === 'ADMIN' || usuario?.user_type === 'GESTOR') && (
            <ListItemButton component={NavLink} to="/rastreamento" selected={emRota('/rastreamento')}>
              <ListItemIcon>
                <MyLocationIcon />
              </ListItemIcon>
              <ListItemText primary="Mapa ao vivo" />
            </ListItemButton>
          )}
          {/* Gestão de perfis é sempre user_type:ADMIN no backend — nem SUPERADMIN passa (o
              middleware da rota é 'user_type:ADMIN' exato, não é uma permissão configurável). */}
          {usuario?.user_type === 'ADMIN' && (
            <ListItemButton component={NavLink} to="/perfis" selected={emRota('/perfis')}>
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText primary="Perfis" />
            </ListItemButton>
          )}
        </List>
        <List subheader={<ListSubheader>Ajuda</ListSubheader>}>
          <ListItemButton component={NavLink} to="/manual" selected={emRota('/manual')}>
            <ListItemIcon>
              <HelpOutlineIcon />
            </ListItemIcon>
            <ListItemText primary="Manual" />
          </ListItemButton>
        </List>
        {/* SUPERADMIN não pertence a empresa nenhuma — CRUD de empresas clientes (planos,
            limites, bloqueio) é só pra ele, a API já bloqueia 403 pros outros user_type. */}
        {usuario?.user_type === 'SUPERADMIN' && (
          <List subheader={<ListSubheader>Suporte</ListSubheader>}>
            <ListItemButton component={NavLink} to="/empresas" selected={emRota('/empresas')}>
              <ListItemIcon>
                <BusinessIcon />
              </ListItemIcon>
              <ListItemText primary="Empresas" />
            </ListItemButton>
          </List>
        )}
      </Drawer>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: menuAberto ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          transition: (theme) => theme.transitions.create('width', { easing: theme.transitions.easing.sharp, duration: 200 }),
        }}
      >
        <Toolbar />
        <HeaderSlotContext.Provider value={headerSlot}>
          <Outlet />
        </HeaderSlotContext.Provider>
      </Box>
    </Box>
  );
}

// Contador "24"-like do handoff de design — pill amber com texto escuro monoespaçado, ao lado do
// rótulo do item de menu (mesmo padrão do mock pra badge de item, ex. "Visitas 24").
function BadgeAmber({ valor }: { valor: number }): ReactNode {
  return (
    <Box
      sx={{
        fontSize: '11px',
        fontWeight: 600,
        fontFamily: '"JetBrains Mono", monospace',
        color: '#171531',
        bgcolor: '#fbbf24',
        borderRadius: '6px',
        px: 0.9,
        py: '1px',
        lineHeight: 1.5,
      }}
    >
      {valor}
    </Box>
  );
}

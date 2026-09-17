import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AssignmentIcon from '@mui/icons-material/Assignment';
import BoltIcon from '@mui/icons-material/Bolt';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import CategoryIcon from '@mui/icons-material/Category';
import DescriptionIcon from '@mui/icons-material/Description';
import EventNoteIcon from '@mui/icons-material/EventNote';
import SendIcon from '@mui/icons-material/Send';
import FlagIcon from '@mui/icons-material/Flag';
import GridViewIcon from '@mui/icons-material/GridView';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import LabelIcon from '@mui/icons-material/Label';
import ListAltIcon from '@mui/icons-material/ListAlt';
import LogoutIcon from '@mui/icons-material/Logout';
import PaidIcon from '@mui/icons-material/Paid';
import PeopleIcon from '@mui/icons-material/People';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import SecurityIcon from '@mui/icons-material/Security';
import StoreIcon from '@mui/icons-material/Store';
import TuneIcon from '@mui/icons-material/Tune';
import WorkIcon from '@mui/icons-material/Work';
import {
  AppBar,
  Box,
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
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
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

export function AppLayout() {
  const { usuario, logout } = useAuth();
  const location = useLocation();
  // Alvo do portal de cada página pra "descrição da rotina" (ver PageHeaderSlot.tsx) — fica no
  // header em vez de repetir "título + frase explicando a tela" dentro do corpo de cada página.
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

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
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ display: 'flex', gap: 2 }}>
          {/* Alvo do portal — cada página injeta aqui sua descrição/ação (usePageHeader), ganhando
              espaço vertical no corpo pra relatório/tabela/feed. Vazio quando a página não usa o
              hook (ex. telas que ainda não migraram esse padrão). */}
          <Box ref={setHeaderSlot} sx={{ flex: 1, minWidth: 0 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
            {usuario && <UsuarioAvatar nome={usuario.nome} fotoUrl={usuario.foto_url} size={32} />}
            <Typography variant="body2" noWrap>
              {usuario?.nome} · {usuario?.empresa?.nome_fantasia ?? usuario?.user_type}
            </Typography>
            <IconButton onClick={() => void logout()} title="Sair">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            bgcolor: SIDEBAR.bg,
            color: SIDEBAR.texto,
            borderRight: 0,
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
                <BoltIcon />
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
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` } }}
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

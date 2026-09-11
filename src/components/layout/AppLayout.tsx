import AssignmentIcon from '@mui/icons-material/Assignment';
import BusinessIcon from '@mui/icons-material/Business';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import CampaignIcon from '@mui/icons-material/Campaign';
import CategoryIcon from '@mui/icons-material/Category';
import DescriptionIcon from '@mui/icons-material/Description';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FlagIcon from '@mui/icons-material/Flag';
import LabelIcon from '@mui/icons-material/Label';
import LogoutIcon from '@mui/icons-material/Logout';
import PaidIcon from '@mui/icons-material/Paid';
import PeopleIcon from '@mui/icons-material/People';
import SecurityIcon from '@mui/icons-material/Security';
import StoreIcon from '@mui/icons-material/Store';
import TuneIcon from '@mui/icons-material/Tune';
import {
  AppBar,
  Badge,
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
import { NavLink, Outlet } from 'react-router-dom';
import { listarOrdensServico } from '../../lib/api/ordensServico';
import { useAuth } from '../../lib/auth/AuthContext';

const DRAWER_WIDTH = 240;
const STATUS_SOLICITACAO = ['AGUARDANDO_APROVACAO', 'REAGENDAMENTO_SOLICITADO', 'CANCELAMENTO_SOLICITADO'] as const;

export function AppLayout() {
  const { usuario, logout } = useAuth();

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

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="h6" noWrap component="div">
            PDV Admin
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">
              {usuario?.nome} · {usuario?.empresa?.nome_fantasia ?? usuario?.user_type}
            </Typography>
            <IconButton color="inherit" onClick={() => void logout()} title="Sair">
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
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List subheader={<ListSubheader>Operação</ListSubheader>}>
          <ListItemButton component={NavLink} to="/visitas">
            <ListItemIcon>
              <AssignmentIcon />
            </ListItemIcon>
            <ListItemText primary="Visitas" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/pontos-venda">
            <ListItemIcon>
              <StoreIcon />
            </ListItemIcon>
            <ListItemText primary="Pontos de Venda" />
          </ListItemButton>
        </List>
        <List subheader={<ListSubheader>Gestão</ListSubheader>}>
          <ListItemButton component={NavLink} to="/catalogo">
            <ListItemIcon>
              <CategoryIcon />
            </ListItemIcon>
            <ListItemText primary="Catálogo" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/campanhas">
            <ListItemIcon>
              <CampaignIcon />
            </ListItemIcon>
            <ListItemText primary="Campanhas" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/contratos">
            <ListItemIcon>
              <DescriptionIcon />
            </ListItemIcon>
            <ListItemText primary="Contratos" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/ordens-servico">
            <ListItemIcon>
              <Badge badgeContent={solicitacoesPendentes} color="warning">
                <EventNoteIcon />
              </Badge>
            </ListItemIcon>
            <ListItemText primary="Ordens de Serviço" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/agendas-visita">
            <ListItemIcon>
              <CalendarMonthIcon />
            </ListItemIcon>
            <ListItemText primary="Agenda de Visita" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/tipos-visita">
            <ListItemIcon>
              <LabelIcon />
            </ListItemIcon>
            <ListItemText primary="Tipos de Visita" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/objetivos-visita">
            <ListItemIcon>
              <FlagIcon />
            </ListItemIcon>
            <ListItemText primary="Objetivos de Visita" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/centros-custo">
            <ListItemIcon>
              <PaidIcon />
            </ListItemIcon>
            <ListItemText primary="Centros de Custo" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/usuarios">
            <ListItemIcon>
              <PeopleIcon />
            </ListItemIcon>
            <ListItemText primary="Usuários" />
          </ListItemButton>
          <ListItemButton component={NavLink} to="/parametros">
            <ListItemIcon>
              <TuneIcon />
            </ListItemIcon>
            <ListItemText primary="Parâmetros" />
          </ListItemButton>
          {/* Gestão de perfis é sempre user_type:ADMIN no backend — nem SUPERADMIN passa (o
              middleware da rota é 'user_type:ADMIN' exato, não é uma permissão configurável). */}
          {usuario?.user_type === 'ADMIN' && (
            <ListItemButton component={NavLink} to="/perfis">
              <ListItemIcon>
                <SecurityIcon />
              </ListItemIcon>
              <ListItemText primary="Perfis" />
            </ListItemButton>
          )}
        </List>
        {/* SUPERADMIN não pertence a empresa nenhuma — CRUD de empresas clientes (planos,
            limites, bloqueio) é só pra ele, a API já bloqueia 403 pros outros user_type. */}
        {usuario?.user_type === 'SUPERADMIN' && (
          <List subheader={<ListSubheader>Suporte</ListSubheader>}>
            <ListItemButton component={NavLink} to="/empresas">
              <ListItemIcon>
                <BusinessIcon />
              </ListItemIcon>
              <ListItemText primary="Empresas" />
            </ListItemButton>
          </List>
        )}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}

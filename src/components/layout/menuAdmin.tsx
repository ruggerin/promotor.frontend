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
import EventBusyIcon from '@mui/icons-material/EventBusyOutlined';
import EventNoteIcon from '@mui/icons-material/EventNoteOutlined';
import EventRepeatIcon from '@mui/icons-material/EventRepeatOutlined';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import FlagIcon from '@mui/icons-material/FlagOutlined';
import GridViewIcon from '@mui/icons-material/GridViewOutlined';
import HelpOutlineIcon from '@mui/icons-material/HelpOutlineOutlined';
import InsightsIcon from '@mui/icons-material/InsightsOutlined';
import LabelIcon from '@mui/icons-material/LabelOutlined';
import ListAltIcon from '@mui/icons-material/ListAltOutlined';
import MyLocationIcon from '@mui/icons-material/MyLocationOutlined';
import PaidIcon from '@mui/icons-material/PaidOutlined';
import PeopleIcon from '@mui/icons-material/PeopleOutlined';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibraryOutlined';
import PushPinIcon from '@mui/icons-material/PushPinOutlined';
import QueryStatsIcon from '@mui/icons-material/QueryStatsOutlined';
import RuleIcon from '@mui/icons-material/RuleOutlined';
import SecurityIcon from '@mui/icons-material/SecurityOutlined';
import SendIcon from '@mui/icons-material/SendOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import StoreIcon from '@mui/icons-material/StoreOutlined';
import TaskAltIcon from '@mui/icons-material/TaskAltOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import TuneIcon from '@mui/icons-material/TuneOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import WorkIcon from '@mui/icons-material/WorkOutlineOutlined';
import type { ReactNode } from 'react';
import { podeVerTela, type ChaveTela } from '../../lib/acesso/telas';
import type { RelatorioFixado } from '../../lib/api/relatoriosPersonalizados';
import type { Usuario } from '../../types/api';

// Estrutura do menu do admin — docs/63-ORGANIZACAO-DO-MENU-E-NOME-LOJA.md §1.3. Fica fora do
// AppLayout pra o teste de estrutura (menuAdmin.test.ts) conferir a mesma lista que a tela mostra.

export type ItemMenu = {
  rotulo: string;
  caminho: string;
  icone: ReactNode;
  /** Contador em tag âmbar à direita (ex.: pendências). Zero ou ausente = não mostra. */
  contador?: number;
  visivel?: boolean;
  /** Tela do item (docs/64) — decide a visibilidade e o "sem acesso" de quem digita a URL. */
  tela?: ChaveTela;
  /** Relatório fixado no menu (docs/63 §1.7) — fica fora do teto de itens do grupo. */
  fixado?: boolean;
};

export type GrupoMenu = {
  /** Chave estável do grupo (memória de recolhido). Vazia = sem cabeçalho (início). */
  chave: string;
  rotulo: string;
  itens: ItemMenu[];
};

export type ContadoresMenu = {
  atividades: number;
  rastreamentoIrregular: number;
  visitasNaoRealizadas: number;
  solicitacoesOs: number;
};

export const CONTADORES_ZERADOS: ContadoresMenu = { atividades: 0, rastreamentoIrregular: 0, visitasNaoRealizadas: 0, solicitacoesOs: 0 };

/**
 * Cada item aponta a tela dele (docs/64) e fica visível se `podeVerTela` deixa. O backend também
 * barra (403) as rotas exclusivas da tela; aqui é a UX de esconder o link. A posição e o rótulo
 * seguem o doc 63.
 */
export function montarMenu(usuario: Usuario | null, contadores: ContadoresMenu, fixados: RelatorioFixado[] = []): GrupoMenu[] {
  const ver = (tela: ChaveTela) => podeVerTela(usuario, tela);
  const item = (tela: ChaveTela, dados: Omit<ItemMenu, 'tela' | 'visivel'>, extra = true): ItemMenu => ({
    ...dados,
    tela,
    visivel: extra && ver(tela),
  });

  return [
    {
      chave: '',
      rotulo: '',
      itens: [item('operacao_dia', { rotulo: 'Operação do dia', caminho: '/operacao-do-dia', icone: <InsightsIcon /> })], // docs/32
    },
    {
      chave: 'acompanhamento',
      rotulo: 'Acompanhamento',
      itens: [
        item('atividades', { rotulo: 'Atividades', caminho: '/atividades', icone: <BoltIcon />, contador: contadores.atividades }), // docs/19
        item('mapa_ao_vivo', { rotulo: 'Mapa ao vivo', caminho: '/rastreamento', icone: <MyLocationIcon />, contador: contadores.rastreamentoIrregular }), // docs/11
        item('rota_dia', { rotulo: 'Rota do dia', caminho: '/rota-do-dia', icone: <AltRouteIcon /> }), // docs/48
        // docs/59 — decisão do gestor sobre a visita vencida; o suporte (SUPERADMIN) não decide.
        item(
          'planejamento',
          { rotulo: 'Visitas não realizadas', caminho: '/visitas-nao-realizadas', icone: <EventBusyIcon />, contador: contadores.visitasNaoRealizadas },
          usuario?.user_type !== 'SUPERADMIN',
        ),
      ],
    },
    {
      chave: 'campo',
      rotulo: 'Campo',
      itens: [
        item('visitas', { rotulo: 'Visitas', caminho: '/visitas', icone: <AssignmentIcon /> }),
        item('registros', { rotulo: 'Registros', caminho: '/registros', icone: <ChecklistIcon /> }), // docs/44
        item('registros', { rotulo: 'Galeria de registros', caminho: '/galeria-fotos', icone: <PhotoLibraryIcon /> }), // docs/23
        item('planos_acao', { rotulo: 'Planos de ação', caminho: '/planos-acao', icone: <TaskAltIcon /> }), // docs/37
        // docs/38 — módulo contratado.
        item('pedidos_venda', { rotulo: 'Pedidos de venda', caminho: '/pedidos-venda', icone: <ShoppingCartOutlinedIcon /> }, Boolean(usuario?.empresa?.pedidos_venda_habilitado)),
      ],
    },
    {
      chave: 'planejamento',
      rotulo: 'Planejamento',
      itens: [
        item('planejamento', { rotulo: 'Agenda de visita', caminho: '/agendas-visita', icone: <CalendarMonthIcon /> }),
        item('planejamento', { rotulo: 'Planejador de visitas', caminho: '/planejador-visitas', icone: <EventRepeatIcon /> }),
        item('planejamento', { rotulo: 'Direcionamentos', caminho: '/direcionamentos', icone: <SendIcon /> }), // docs/25
        item('ordens_servico', { rotulo: 'Ordens de serviço', caminho: '/ordens-servico', icone: <EventNoteIcon />, contador: contadores.solicitacoesOs }),
        item('campanhas', { rotulo: 'Campanhas', caminho: '/campanhas', icone: <CampaignIcon /> }),
        item('contratos', { rotulo: 'Contratos', caminho: '/contratos', icone: <DescriptionIcon /> }),
      ],
    },
    {
      chave: 'relatorios',
      rotulo: 'Relatórios',
      itens: [
        item('relatorios', { rotulo: 'Relatórios', caminho: '/relatorios-personalizados', icone: <QueryStatsIcon /> }), // docs/60
        item('relatorios', { rotulo: 'Cumprimento de visitas', caminho: '/relatorios/visitas-planejadas', icone: <AssessmentIcon /> }), // docs/28
        item('relatorios', { rotulo: 'Tempo na loja', caminho: '/relatorios/tempo-na-loja', icone: <TimerOutlinedIcon /> }), // docs/59
        item('relatorios', { rotulo: 'Coleta por formulário', caminho: '/relatorios/respostas-formulario', icone: <FactCheckIcon /> }),
        // Fixados no menu (docs/63 §1.7) — a API já devolve só os que o usuário enxerga.
        ...fixados.map((f) =>
          item('relatorios', { rotulo: f.nome, caminho: `/relatorios-personalizados/${f.id}`, icone: <PushPinIcon />, fixado: true }),
        ),
      ],
    },
    {
      chave: 'cadastros',
      rotulo: 'Cadastros',
      itens: [
        item('lojas', { rotulo: 'Lojas', caminho: '/pontos-venda', icone: <StoreIcon /> }),
        item('lojas', { rotulo: 'Redes de lojas', caminho: '/redes-lojas', icone: <AccountTreeIcon /> }),
        item('lojas', { rotulo: 'Ramos de atividade', caminho: '/ramos-atividade', icone: <WorkIcon /> }),
        item('catalogo', { rotulo: 'Catálogo (produtos)', caminho: '/catalogo', icone: <CategoryIcon /> }),
        item('catalogo', { rotulo: 'Planogramas', caminho: '/planogramas', icone: <GridViewIcon /> }),
        item('formularios', { rotulo: 'Formulários', caminho: '/tipos-registro', icone: <ListAltIcon /> }),
      ],
    },
    {
      chave: 'equipe',
      rotulo: 'Equipe e acesso',
      itens: [
        item('usuarios', { rotulo: 'Usuários', caminho: '/usuarios', icone: <PeopleIcon /> }),
        // Gestão de perfis é sempre user_type:ADMIN exato no backend (nem SUPERADMIN passa).
        item('perfis', { rotulo: 'Perfis', caminho: '/perfis', icone: <SecurityIcon /> }),
        item('centros_custo', { rotulo: 'Centros de custo', caminho: '/centros-custo', icone: <PaidIcon /> }),
      ],
    },
    {
      chave: 'configuracoes',
      rotulo: 'Configurações',
      itens: [
        // Vira "Configurações" com o doc 62.
        item('configuracoes', { rotulo: 'Parâmetros', caminho: '/parametros', icone: <TuneIcon /> }),
        item('configuracoes', { rotulo: 'Tipos de visita', caminho: '/tipos-visita', icone: <LabelIcon /> }),
        item('configuracoes', { rotulo: 'Objetivos de visita', caminho: '/objetivos-visita', icone: <FlagIcon /> }),
        item('configuracoes', { rotulo: 'Motivos de não execução', caminho: '/motivos-nao-execucao', icone: <RuleIcon /> }),
        item('configuracoes', { rotulo: 'Motivos de resolução', caminho: '/motivos-resolucao-alerta', icone: <RuleIcon /> }),
        // docs/42 — lojas/vínculo: pontos_venda.gerenciar; produtos: catalogo.gerenciar
        item('importacao', { rotulo: 'Importação de dados', caminho: '/importacao-dados', icone: <UploadFileIcon /> }),
      ],
    },
    {
      chave: 'ajuda',
      rotulo: 'Ajuda e administração',
      itens: [
        item('manual', { rotulo: 'Manual', caminho: '/manual', icone: <HelpOutlineIcon /> }),
        // SUPERADMIN não pertence a empresa nenhuma — CRUD de empresas clientes é só dele.
        item('empresas', { rotulo: 'Empresas', caminho: '/empresas', icone: <BusinessIcon /> }),
      ],
    },
  ];
}

/** Só os itens que o usuário vê; grupo vazio some (docs/63 §1.4). */
export function filtrarVisiveis(grupos: GrupoMenu[]): GrupoMenu[] {
  return grupos.map((g) => ({ ...g, itens: g.itens.filter((i) => i.visivel !== false) })).filter((g) => g.itens.length > 0);
}

/**
 * Item ativo = o de caminho mais longo que casa com a URL. Assim um relatório fixado
 * (/relatorios-personalizados/x) acende sozinho, sem acender junto o item "Relatórios".
 */
export function caminhoAtivo(grupos: GrupoMenu[], pathname: string): string | null {
  let melhor: string | null = null;
  for (const g of grupos) {
    for (const i of g.itens) {
      const casa = pathname === i.caminho || pathname.startsWith(`${i.caminho}/`);
      if (casa && (melhor === null || i.caminho.length > melhor.length)) melhor = i.caminho;
    }
  }
  return melhor;
}

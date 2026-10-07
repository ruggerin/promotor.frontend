import CheckIcon from '@mui/icons-material/Check';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import MenuIcon from '@mui/icons-material/MenuOutlined';
import SearchIcon from '@mui/icons-material/SearchOutlined';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import {
  Box,
  ButtonBase,
  Divider,
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
import { podeVerTela } from '../../lib/acesso/telas';
import { listarRelatoriosFixados } from '../../lib/api/relatoriosPersonalizados';
import { useAuth } from '../../lib/auth/AuthContext';
import { useTema } from '../../lib/tema/TemaProvider';
import type { PreferenciaTema } from '../../types/api';
import { horus } from '../../theme';
import { AutorizacaoGestorButton } from '../AutorizacaoGestorButton';
import { LogoHorus } from '../LogoHorus';
import { UsuarioAvatar } from '../UsuarioAvatar';
import { caminhoAtivo, filtrarVisiveis, montarMenu, type GrupoMenu, type ItemMenu } from './menuAdmin';
import { HeaderSlotContext } from './PageHeaderSlot';
import { PainelSuporte } from './PainelSuporte';

// Chassi do admin no padrão visual Horus (6/10/2026): menu lateral branco de 232px (64px
// recolhido, só ícones), item ativo preenchido em índigo, busca de telas com Ctrl+K, usuário no
// rodapé do menu; header branco fixo com o título/ações que cada página injeta (usePageHeader).

const LARGURA_MENU = 232;
const LARGURA_MENU_MINI = 64;
const STATUS_SOLICITACAO = ['AGUARDANDO_APROVACAO', 'REAGENDAMENTO_SOLICITADO', 'CANCELAMENTO_SOLICITADO'] as const;
const CHAVE_MENU_ABERTO = 'pdv-admin:menu-lateral-aberto';
// Grupos recolhidos pelo usuário (docs/63 §1.4) — conforto do viewer, o menu funciona sem.
const CHAVE_GRUPOS_RECOLHIDOS = 'pdv-admin:menu-grupos-recolhidos';

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

  const [recolhidos, setRecolhidos] = useState<string[]>(() => {
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_GRUPOS_RECOLHIDOS) ?? '[]');
      return Array.isArray(salvo) ? salvo.filter((c): c is string => typeof c === 'string') : [];
    } catch {
      return [];
    }
  });

  function alternarGrupo(chave: string) {
    setRecolhidos((atual) => {
      const novo = atual.includes(chave) ? atual.filter((c) => c !== chave) : [...atual, chave];
      try {
        localStorage.setItem(CHAVE_GRUPOS_RECOLHIDOS, JSON.stringify(novo));
      } catch {
        // Storage indisponível — só não persiste a preferência.
      }
      return novo;
    });
  }

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

  // Solicitações pendentes de OS (docs/13 §6.2) — só ADMIN/GESTOR têm a permissão da rota.
  const solicitacoesQuery = useQuery({
    queryKey: ['ordens-servico', 'solicitacoes-pendentes-count'],
    queryFn: () => listarOrdensServico({ status: [...STATUS_SOLICITACAO] }),
    enabled: ehGestao && podeVerTela(usuario, 'ordens_servico'),
    refetchInterval: 60_000,
  });
  const solicitacoesPendentes = solicitacoesQuery.data?.meta.total ?? 0;

  // Visitas planejadas vencidas aguardando decisão do gestor (docs/59) — enquanto houver, o número
  // fica visível. Sem ordens_servico.gerenciar o GESTOR recebe 403 e o contador não aparece.
  const naoRealizadasQuery = useQuery({
    queryKey: ['visitas-nao-realizadas', 'contador'],
    queryFn: () => listarOrdensServico({ vencidas: true, por_pagina: 1 }),
    enabled: ehGestao && podeVerTela(usuario, 'planejamento'),
    refetchInterval: 60_000,
    retry: false,
  });
  const visitasNaoRealizadas = naoRealizadasQuery.data?.meta.total ?? 0;

  // Contador de Atividades (docs/43 §6 decisão 5) — respostas novas + alertas sem tratativa
  // (esses só quando a empresa usa resolução de alerta).
  const resumoAtividadesQuery = useQuery({
    queryKey: ['atividades-resumo', 'menu'],
    queryFn: () => buscarResumoAtividades(),
    enabled: podeVerTela(usuario, 'atividades'),
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
    enabled: podeVerTela(usuario, 'mapa_ao_vivo'),
    refetchInterval: 60_000,
    retry: false,
  });
  const irregularesRastreamento = conformidadeQuery.data?.habilitado ? conformidadeQuery.data.irregulares.length : 0;

  // Relatórios fixados no menu (docs/63 §1.7). Mesma raiz de chave da lista do gerador, pra
  // fixar/desafixar lá atualizar o menu na hora.
  const fixadosQuery = useQuery({
    queryKey: ['relatorios-personalizados', 'menu'],
    queryFn: listarRelatoriosFixados,
    enabled: podeVerTela(usuario, 'relatorios'),
    retry: false,
  });

  const todosGrupos = montarMenu(
    usuario,
    {
      atividades: contadorAtividades,
      rastreamentoIrregular: irregularesRastreamento,
      visitasNaoRealizadas,
      solicitacoesOs: solicitacoesPendentes,
    },
    fixadosQuery.data ?? [],
  );
  const grupos = filtrarVisiveis(todosGrupos);

  // URL digitada de uma tela que o perfil não vê (docs/64): "sem acesso" em vez de tela vazia ou
  // erro de API. Só vale pra caminho que é item do menu (e subpáginas dele).
  const caminhoDaRota = caminhoAtivo(todosGrupos, location.pathname);
  const semAcesso =
    caminhoDaRota !== null &&
    todosGrupos.some((g) => g.itens.some((i) => i.caminho === caminhoDaRota && i.visivel === false && !i.fixado));

  // A busca ignora o recolhimento: mostra o que casa em todos os grupos.
  const termo = normalizar(busca.trim());
  const gruposVisiveis = termo
    ? grupos.map((g) => ({ ...g, itens: g.itens.filter((i) => normalizar(i.rotulo).includes(termo)) })).filter((g) => g.itens.length > 0)
    : grupos;

  const ativo = caminhoAtivo(grupos, location.pathname);

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
      ativo={ativo}
      recolhidos={recolhidos}
      onAlternarGrupo={alternarGrupo}
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
            {semAcesso ? <SemAcesso /> : <Outlet />}
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
  ativo,
  recolhidos,
  onAlternarGrupo,
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
  ativo: string | null;
  recolhidos: string[];
  onAlternarGrupo: (chave: string) => void;
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
          {/* Recolhido, o contêiner de 20px corta o logo e sobra só o "H". */}
          <LogoHorus largura={92} />
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
        {grupos.map((grupo) => {
          // Recolher só vale fora da busca e do modo mini; o grupo da página atual fica sempre aberto.
          const temAtivo = grupo.itens.some((i) => i.caminho === ativo);
          const recolhido = !mini && !termo && grupo.chave !== '' && !temAtivo && recolhidos.includes(grupo.chave);
          const somaContadores = grupo.itens.reduce((t, i) => t + (i.contador ?? 0), 0);
          return (
            <Box key={grupo.chave || 'inicio'} sx={{ mt: grupo.chave ? 1.75 : 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {!mini && grupo.chave && (
                <ButtonBase
                  onClick={() => onAlternarGrupo(grupo.chave)}
                  aria-expanded={!recolhido}
                  disabled={temAtivo || Boolean(termo)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    justifyContent: 'flex-start',
                    textAlign: 'left',
                    px: 1.25,
                    pb: 0.75,
                    borderRadius: '4px',
                    fontSize: 11,
                    fontWeight: 500,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: horus.textoFraco,
                    '&:hover': { color: horus.texto2 },
                    '&.Mui-disabled': { color: horus.textoFraco },
                    '&.Mui-focusVisible': { outline: `2px solid ${horus.indigo}`, outlineOffset: 1 },
                  }}
                >
                  <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {grupo.rotulo}
                  </Box>
                  {/* Recolhido, o contador do grupo segura as pendências à vista (docs/63 §1.4). */}
                  {recolhido && somaContadores > 0 && <TagContador valor={somaContadores} />}
                  {!temAtivo && !termo && (
                    <ExpandMoreIcon
                      sx={{ fontSize: 15, transition: 'transform 120ms ease', transform: recolhido ? 'rotate(-90deg)' : undefined }}
                    />
                  )}
                </ButtonBase>
              )}
              {mini && grupo.chave && <Box sx={{ borderTop: `1px solid ${horus.borda}`, mx: 1, mb: 0.5 }} />}
              {!recolhido &&
                grupo.itens.map((item) => (
                  <ItemDoMenu
                    key={item.caminho}
                    item={item}
                    mini={mini}
                    termo={termo}
                    ativo={item.caminho === ativo}
                    onClick={onNavegar}
                    telaAtual={grupos.flatMap((gr) => gr.itens).find((i) => i.caminho === ativo)?.rotulo ?? null}
                  />
                ))}
            </Box>
          );
        })}
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
  telaAtual,
}: {
  item: ItemMenu;
  mini: boolean;
  termo: string;
  ativo: boolean;
  onClick: () => void;
  /** Rótulo da tela aberta — vai no e-mail do suporte. */
  telaAtual: string | null;
}) {
  const contador = item.contador ?? 0;
  const [ancoraSuporte, setAncoraSuporte] = useState<HTMLElement | null>(null);
  // Suporte não navega: abre o painel (portal em aba nova + e-mail), a tela atual fica como está.
  const destino = item.suporte
    ? { component: 'button' as const, onClick: (e: ReactMouseEvent<HTMLElement>) => setAncoraSuporte(e.currentTarget) }
    : { component: NavLink, to: item.caminho, onClick };
  const botao = (
    <ListItemButton
      {...destino}
      selected={ativo}
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
              border: `1.5px solid ${horus.painel}`,
            }}
          />
        )}
      </ListItemIcon>
      {!mini && (
        <>
          <Box component="span" sx={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Destaque texto={item.rotulo} termo={termo} />
          </Box>
          {contador > 0 && <TagContador valor={contador} />}
        </>
      )}
    </ListItemButton>
  );

  const comDica = mini ? (
    <Tooltip title={contador > 0 ? `${item.rotulo} (${contador})` : item.rotulo} placement="right">
      {botao}
    </Tooltip>
  ) : (
    botao
  );

  if (!item.suporte) return comDica;
  return (
    <>
      {comDica}
      <PainelSuporte ancora={ancoraSuporte} tela={telaAtual} onFechar={() => setAncoraSuporte(null)} />
    </>
  );
}

function SemAcesso() {
  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', mt: 8, textAlign: 'center' }}>
      <Typography sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}>Sem acesso a esta tela</Typography>
      <Typography sx={{ color: 'text.secondary' }}>
        O seu perfil não inclui esta tela. Se precisar dela, peça a um administrador para liberar em Perfis.
      </Typography>
    </Box>
  );
}

function TagContador({ valor }: { valor: number }) {
  return (
    <Box
      component="span"
      sx={{
        font: `600 11px ${horus.mono}`,
        letterSpacing: 0,
        color: horus.ambarEscuro,
        bgcolor: horus.ambarClaro,
        px: 0.75,
        borderRadius: '4px',
        lineHeight: '18px',
      }}
    >
      {valor > 99 ? '99+' : valor}
    </Box>
  );
}

/** Marca o trecho buscado dentro do rótulo — o termo já vem normalizado (sem acento). */
function Destaque({ texto, termo }: { texto: string; termo: string }) {
  const i = termo ? normalizar(texto).indexOf(termo) : -1;
  if (i < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, i)}
      <Box component="mark" sx={{ bgcolor: horus.ambarClaro, color: 'inherit', borderRadius: '2px' }}>
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
  const { preferencia, definir } = useTema();

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
        {/* Tema do admin (docs/65) — preferência do usuário, vale em qualquer navegador. */}
        <Typography sx={{ px: 1.25, pt: 0.5, pb: 0.25, fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: horus.textoFraco }}>
          Tema
        </Typography>
        {OPCOES_TEMA.map(({ valor, rotulo, icone }) => (
          <MenuItem key={valor} selected={preferencia === valor} onClick={() => definir(valor)} sx={{ gap: 1, minWidth: 180 }}>
            {icone}
            <Box component="span" sx={{ flex: 1 }}>
              {rotulo}
            </Box>
            {preferencia === valor && <CheckIcon sx={{ fontSize: 16, color: horus.indigo }} />}
          </MenuItem>
        ))}
        <Divider sx={{ my: 0.5 }} />
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

const OPCOES_TEMA: { valor: PreferenciaTema; rotulo: string; icone: ReactNode }[] = [
  { valor: 'sistema', rotulo: 'Igual ao sistema', icone: <SettingsBrightnessIcon sx={{ fontSize: 17, color: 'text.secondary' }} /> },
  { valor: 'claro', rotulo: 'Claro', icone: <LightModeIcon sx={{ fontSize: 17, color: 'text.secondary' }} /> },
  { valor: 'escuro', rotulo: 'Escuro', icone: <DarkModeIcon sx={{ fontSize: 17, color: 'text.secondary' }} /> },
];

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

import type { Permissao, Usuario } from '../../types/api';

// Catálogo de telas — docs/64-CONTROLE-DE-ACESSO-POR-TELA.md §3. Uma regra só (podeVerTela) pro
// menu, pro bloqueio de URL e pro formulário de Perfil. A API barra as rotas exclusivas de cada
// tela; o resto (lojas, catálogo, OS, parâmetros) é leitura aberta que o app e os filtros usam.

export type ChaveTela =
  | 'operacao_dia'
  | 'atividades'
  | 'mapa_ao_vivo'
  | 'rota_dia'
  | 'visitas'
  | 'registros'
  | 'planos_acao'
  | 'pedidos_venda'
  | 'ordens_servico'
  | 'planejamento'
  | 'campanhas'
  | 'contratos'
  | 'relatorios'
  | 'regua_xp'
  | 'avaliacoes'
  | 'classes_loja'
  | 'lojas'
  | 'catalogo'
  | 'formularios'
  | 'usuarios'
  | 'equipe_comercial'
  | 'perfis'
  | 'licencas'
  | 'centros_custo'
  | 'configuracoes'
  | 'importacao'
  | 'integracoes'
  | 'manual'
  | 'empresas';

export type AcaoTela = { valor: Permissao; rotulo: string };

export type DefTela = {
  chave: ChaveTela;
  rotulo: string;
  /** Grupo do formulário de Perfil — mesmo nome do grupo do menu (docs/63). */
  grupo: string;
  /**
   * O que libera a tela pro GESTOR. `tela.*` nas telas que não tinham permissão de leitura; nas
   * outras, a permissão que já existia (basta ter uma da lista). Ausente = regra especial.
   */
  libera?: Permissao[];
  /** Ações (escrita) mostradas embaixo da tela no Perfil. Só valem com a tela marcada. */
  acoes?: AcaoTela[];
  /** O SUPERADMIN vê no menu (mantém o que ele já via antes do doc 64). */
  superadmin?: boolean;
  /** Ajuda curta no Perfil. */
  ajuda?: string;
};

export const TELAS: DefTela[] = [
  { chave: 'operacao_dia', rotulo: 'Operação do dia', grupo: 'Início', libera: ['tela.operacao_dia'] },
  { chave: 'atividades', rotulo: 'Atividades', grupo: 'Acompanhamento', libera: ['tela.atividades'] },
  { chave: 'mapa_ao_vivo', rotulo: 'Mapa ao vivo', grupo: 'Acompanhamento', libera: ['rastreamento.visualizar'], ajuda: 'Posição dos promotores agora' },
  { chave: 'rota_dia', rotulo: 'Rota do dia', grupo: 'Acompanhamento', libera: ['rastreamento.trajeto'], ajuda: 'Por onde o promotor passou, paradas fora de loja' },
  {
    chave: 'visitas',
    rotulo: 'Visitas',
    grupo: 'Campo',
    libera: ['tela.visitas'],
    superadmin: true,
  },
  { chave: 'registros', rotulo: 'Registros e galeria', grupo: 'Campo', libera: ['tela.registros'] },
  {
    chave: 'planos_acao',
    rotulo: 'Planos de ação',
    grupo: 'Campo',
    libera: ['planos_acao.visualizar'],
    acoes: [
      { valor: 'planos_acao.criar', rotulo: 'Abrir plano a partir de um alerta' },
      { valor: 'planos_acao.movimentar_etapa', rotulo: 'Movimentar etapa' },
      { valor: 'planos_acao.concluir', rotulo: 'Concluir o plano' },
      { valor: 'planos_acao.cancelar', rotulo: 'Cancelar o plano' },
    ],
  },
  {
    chave: 'pedidos_venda',
    rotulo: 'Pedidos de venda',
    grupo: 'Campo',
    libera: ['pedidos_venda.visualizar', 'pedidos_venda.criar', 'pedidos_venda.aprovar'],
    ajuda: 'Módulo contratado. "Tirar pedido" também liga o modo Vendedor no app do promotor.',
  },
  {
    chave: 'ordens_servico',
    rotulo: 'Ordens de serviço',
    grupo: 'Planejamento',
    libera: ['tela.ordens_servico'],
    superadmin: true,
    acoes: [{ valor: 'ordens_servico.gerenciar', rotulo: 'Criar e editar OS, e planejar visitas' }],
  },
  {
    // Agenda, Planejador, Direcionamentos e Visitas não realizadas leem rotas que já exigiam
    // ordens_servico.gerenciar — no Perfil é a ação "planejar" da tela de OS.
    chave: 'planejamento',
    rotulo: 'Agenda, planejador e direcionamentos',
    grupo: 'Planejamento',
    libera: ['ordens_servico.gerenciar'],
    superadmin: true,
  },
  {
    chave: 'campanhas',
    rotulo: 'Campanhas',
    grupo: 'Planejamento',
    libera: ['tela.campanhas'],
    superadmin: true,
    acoes: [{ valor: 'campanhas.gerenciar', rotulo: 'Criar e editar campanhas' }],
  },
  { chave: 'contratos', rotulo: 'Contratos', grupo: 'Planejamento', libera: ['contratos.gerenciar'], superadmin: true, ajuda: 'Ver e editar' },
  {
    chave: 'relatorios',
    rotulo: 'Relatórios',
    grupo: 'Relatórios',
    libera: ['tela.relatorios'],
    acoes: [
      { valor: 'relatorios.personalizados.gerenciar', rotulo: 'Criar, editar e fixar relatórios para a empresa' },
      { valor: 'faturamento.visualizar', rotulo: 'Ver faturamento, lucro e Esforço × Retorno (precisa estar habilitado nas Configurações)' },
    ],
  },
  {
    // docs/88 — recurso de plano: só aparece com `controle_xp_habilitado` na empresa.
    chave: 'regua_xp',
    rotulo: 'Régua de produtividade',
    grupo: 'Relatórios',
    libera: ['xp.visualizar'],
    ajuda: 'Possível × realizado, perdas, ranking e valor gerado (recurso do plano)',
    acoes: [{ valor: 'xp.gerenciar', rotulo: 'Classificar ocorrências e cadastrar as classes de loja' }],
  },
  {
    // doc 33 — aparece com o parâmetro "Avaliação de formulário pelo gestor" ligado.
    chave: 'avaliacoes',
    rotulo: 'Avaliação de formulários',
    grupo: 'Campo',
    libera: ['formularios.avaliar'],
    ajuda: 'Aprovar ou reprovar formulários marcados com "Exige avaliação"',
  },
  {
    chave: 'lojas',
    rotulo: 'Lojas, redes e ramos',
    grupo: 'Cadastros',
    libera: ['tela.lojas'],
    superadmin: true,
    acoes: [{ valor: 'pontos_venda.gerenciar', rotulo: 'Cadastrar e editar lojas, sortimento e promotores da loja' }],
  },
  {
    chave: 'catalogo',
    rotulo: 'Catálogo e planogramas',
    grupo: 'Cadastros',
    libera: ['tela.catalogo'],
    superadmin: true,
    acoes: [{ valor: 'catalogo.gerenciar', rotulo: 'Cadastrar e editar produtos, marcas, seções e planogramas' }],
  },
  { chave: 'formularios', rotulo: 'Formulários', grupo: 'Cadastros', libera: ['tela.formularios'], superadmin: true },
  { chave: 'classes_loja', rotulo: 'Classes de loja (XP)', grupo: 'Cadastros', libera: ['xp.gerenciar'], ajuda: 'Quanto vale uma visita em cada tipo de loja (docs/88)' },
  { chave: 'usuarios', rotulo: 'Usuários', grupo: 'Equipe e acesso', libera: ['usuarios.gerenciar'], superadmin: true, ajuda: 'Ver e editar' },
  {
    chave: 'equipe_comercial',
    rotulo: 'Vendedores e supervisores',
    grupo: 'Equipe e acesso',
    libera: ['vendedores.gerenciar'],
    ajuda: 'Cadastro do ERP: ver, importar e ajustar contato (docs/73)',
  },
  { chave: 'perfis', rotulo: 'Perfis', grupo: 'Equipe e acesso', ajuda: 'Sempre só do ADMIN' },
  { chave: 'licencas', rotulo: 'Licenças e plano', grupo: 'Equipe e acesso', ajuda: 'Sempre só do ADMIN' }, // docs/67
  { chave: 'centros_custo', rotulo: 'Centros de custo', grupo: 'Equipe e acesso', libera: ['centros_custo.gerenciar'], superadmin: true, ajuda: 'Dado financeiro' },
  {
    chave: 'configuracoes',
    rotulo: 'Configurações e listas de apoio',
    grupo: 'Configurações',
    libera: ['tela.configuracoes'],
    superadmin: true,
    ajuda: 'Parâmetros, tipos e objetivos de visita, motivos',
    acoes: [{ valor: 'parametros.gerenciar', rotulo: 'Alterar parâmetros' }],
  },
  { chave: 'importacao', rotulo: 'Importação de dados', grupo: 'Configurações', libera: ['pontos_venda.gerenciar', 'catalogo.gerenciar', 'vendedores.gerenciar', 'ordens_servico.gerenciar'] },
  // docs/96 — tokens de API pro ERP/BI do cliente; como Perfis, nunca delegável a GESTOR.
  { chave: 'integracoes', rotulo: 'Integrações (tokens de API)', grupo: 'Configurações', ajuda: 'Sempre só do ADMIN' },
  { chave: 'manual', rotulo: 'Manual', grupo: 'Ajuda', superadmin: true },
  { chave: 'empresas', rotulo: 'Empresas', grupo: 'Ajuda', superadmin: true },
];

const POR_CHAVE = new Map(TELAS.map((t) => [t.chave, t]));

/** Todas as `tela.*` — o perfil novo nasce com elas marcadas (docs/64 §2.4). */
export const PERMISSOES_DE_TELA: Permissao[] = [
  ...new Set(TELAS.flatMap((t) => (t.libera ?? []).filter((p) => p.startsWith('tela.')))),
];

/**
 * ADMIN vê tudo da empresa; GESTOR pelo perfil; SUPERADMIN só o que já via (e Empresas é só
 * dele); PROMOTOR não usa o admin. Módulo contratado (pedidos de venda) fica no menu.
 */
export function podeVerTela(usuario: Usuario | null | undefined, chave: ChaveTela): boolean {
  const tela = POR_CHAVE.get(chave);
  if (!usuario || !tela) return false;
  if (chave === 'manual') return true;
  if (chave === 'empresas') return usuario.user_type === 'SUPERADMIN';
  if (usuario.user_type === 'SUPERADMIN') return Boolean(tela.superadmin);
  // Recurso de plano (docs/88) e parâmetro da empresa (doc 33): sem eles, a tela nem existe.
  if ((chave === 'regua_xp' || chave === 'classes_loja') && !usuario.empresa?.controle_xp_habilitado) return false;
  if (chave === 'avaliacoes' && !usuario.empresa?.avaliacao_formulario_habilitada) return false;
  if (usuario.user_type === 'ADMIN') return true;
  if (usuario.user_type !== 'GESTOR' || chave === 'perfis' || chave === 'licencas' || chave === 'integracoes') return false;
  const permissoes = usuario.perfil?.permissoes ?? [];
  return (tela.libera ?? []).some((p) => permissoes.includes(p));
}

/** Ação que exige a tela (espelha Permissao::telaExigida da API). */
export function telaDaAcao(acao: Permissao): Permissao | null {
  for (const t of TELAS) {
    if (t.acoes?.some((a) => a.valor === acao)) {
      const daTela = (t.libera ?? []).find((p) => p.startsWith('tela.'));
      if (daTela) return daTela;
    }
  }
  return null;
}

/** Ação (escrita) liberada: ADMIN sempre; GESTOR pelo perfil (espelha EnsurePermissao da API). */
export function temAcao(usuario: Usuario | null | undefined, permissao: Permissao): boolean {
  if (!usuario) return false;
  if (usuario.user_type === 'ADMIN') return true;
  return usuario.user_type === 'GESTOR' && (usuario.perfil?.permissoes ?? []).includes(permissao);
}

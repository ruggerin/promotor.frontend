// Tipos espelhando os JsonResource da API (api/app/Http/Resources/) — `id` é sempre o uuid
// (string), nunca o bigint interno, ver docs/02-API-BACKEND.md#convenção-de-identificadores-na-api.

export type UserType = 'SUPERADMIN' | 'ADMIN' | 'GESTOR' | 'PROMOTOR';
export type Permissao =
  | 'pontos_venda.gerenciar'
  | 'catalogo.gerenciar'
  | 'campanhas.gerenciar'
  | 'parametros.gerenciar'
  | 'usuarios.gerenciar'
  | 'contratos.gerenciar'
  | 'ordens_servico.gerenciar'
  | 'centros_custo.gerenciar'
  | 'pontos_venda.visualizar_todos'
  | 'visitas.intervir'
  | 'rastreamento.visualizar'
  | 'pedidos.gerenciar'
  | 'planos_acao.visualizar'
  | 'planos_acao.criar'
  | 'planos_acao.movimentar_etapa'
  | 'planos_acao.concluir'
  | 'planos_acao.cancelar';
export type PlanoEmpresa = 'GRATUITO' | 'START' | 'PRO' | 'BUSINESS';
export type StatusVisita = 'ABERTA' | 'FINALIZADA' | 'CANCELADA';
// PROMOTOR = checkout normal pelo app (com GPS); ADMIN = forçado por um gestor (sem GPS);
// null = visita ainda aberta. Ver docs/15-INTERVENCAO-ADMINISTRATIVA-VISITA.md.
export type CheckoutTipo = 'PROMOTOR' | 'ADMIN';
export type AcaoIntervencaoVisita = 'CANCELAMENTO' | 'CHECKOUT_FORCADO' | 'CORRECAO_HORARIO';
export type Propriedade = 'PROPRIA' | 'CONCORRENTE';
export type TipoItemCampanha = 'PRODUTO' | 'SECAO' | 'DEPARTAMENTO' | 'MARCA';

// PENDENTE/REJEITADO só quando o item foi criado por um promotor em modo REQUER_APROVACAO —
// null = não se aplica (cadastro normal, ou promotor em modo autônomo). Ver
// docs/14-SORTIMENTO-PONTO-VENDA.md §9.
export type StatusAprovacao = 'PENDENTE' | 'REJEITADO' | null;

// Os 3 níveis de autonomia do promotor sobre self-service (vincular ao sortimento / cadastrar
// produto novo) — configurável por empresa. Ver docs/14-SORTIMENTO-PONTO-VENDA.md §9.
export type AutonomiaPromotor = 'DESABILITADO' | 'AUTONOMO' | 'REQUER_APROVACAO';
export type StatusFatura = 'PENDENTE' | 'PAGA' | 'CANCELADA';
export type TipoEventoHistorico = 'LOGIN' | 'VISITA_INICIO' | 'VISITA_FIM' | 'REGISTRO';
export type TipoContrato = 'COMODATO' | 'PONTO_EXTRA';
export type TipoCampoRegistro = 'NUMERO' | 'TEXTO' | 'MOEDA' | 'MULTIPLA_ESCOLHA' | 'BOOLEANO' | 'DATA' | 'SORTIMENTO';
// visitas.tipo (PROGRAMADA/NAO_PROGRAMADA) foi removido — agendamento agora vive inteiro em
// OrdemServico, ver docs/07-ORDEM-DE-SERVICO.md e docs/10-AGENDA-VISITA.md. CONTRATO = gerada
// automaticamente por um comodato/ponto extra vencendo, ver GerarOrdensServicoPorContrato.
export type OrigemOrdemServico = 'MANUAL' | 'CAMPANHA' | 'AGENDA' | 'CONTRATO' | 'DIRECIONAMENTO';

// Prioridade de uma OrdemServico ou AgendaVisita — só exibição/ordenação. Ver
// docs/10-AGENDA-VISITA.md.
export type PrioridadeVisita = 'BAIXA' | 'MEDIA' | 'ALTA';
// Sem EXPIRADA persistido de propósito — calculado na exibição (PENDENTE + prazo_fim no
// passado), mesmo padrão de StatusFatura ("Atrasada"). Os três últimos só existem quando a
// empresa tem AGENDA_REQUER_APROVACAO ativo — ver docs/13-AGENDA-MOBILE-E-AUTONOMIA.md.
export type StatusOrdemServico =
  | 'PENDENTE'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA'
  | 'AGUARDANDO_APROVACAO'
  | 'REAGENDAMENTO_SOLICITADO'
  | 'CANCELAMENTO_SOLICITADO';
export type FontePagamentoMeta = 'EMPRESA' | 'INDUSTRIA' | 'COMPARTILHADO';
// Nunca persistido — sempre computado na leitura (ContratoMeta.resumo). Ver
// docs/09-CONTRATO-METAS.md §4.
export type StatusApuracaoMeta = 'AGUARDANDO' | 'ATINGIDA' | 'NAO_ATINGIDA';

export interface Empresa {
  id: string;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  plano: PlanoEmpresa;
  limite_usuarios: number | null;
  limite_pontos_venda: number | null;
  // Cobrança por dispositivo — conta usuários PROMOTOR ativos (cada um trava 1 dispositivo
  // por vez), separado de limite_usuarios (headcount geral do plano). Ver
  // docs/02-API-BACKEND.md, regra de negócio 5.
  limite_licencas: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Espelha o objeto `uso` de GET /superadmin/empresas/{uuid} — ver
// EmpresaController::showSuperadmin.
export interface EmpresaUso {
  licencas_usadas: number;
  licencas_limite: number | null;
  usuarios_total: number;
  usuarios_limite: number | null;
  pontos_venda_total: number;
  pontos_venda_limite: number | null;
  visitas_total: number;
  visitas_ultimos_30_dias: number;
  pontos_venda_visitados: number;
  ultima_atividade_em: string | null;
}

export interface Fatura {
  id: string;
  valor: number;
  referencia: string;
  vencimento: string;
  status: StatusFatura;
  pago_em: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface Perfil {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: Permissao[];
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Configuração chave/valor por empresa (ex.: CHECKIN_RAIO_METROS) — ver
// docs/01-MODELO-DE-DADOS.md#6-parâmetros. `valor` é sempre string; quem consome decide como
// interpretar (int/bool/json) conforme a convenção de cada `chave`.
export interface Parametro {
  id: string;
  chave: string;
  valor: string;
  descricao: string | null;
  ativo: boolean;
  // Só vem preenchido pra quem pede como SUPERADMIN — ver docs/02-API-BACKEND.md.
  empresa?: Empresa;
  created_at: string;
  updated_at: string;
}

export interface Dispositivo {
  identificador: string;
  nome: string | null;
  ultimo_acesso_em: string;
}

// Linha da timeline de GET /usuarios/{uuid}/historico — campos ficam null quando não fazem
// sentido pro `tipo` (ex.: ponto_venda só vem em VISITA_INICIO/VISITA_FIM/REGISTRO, nunca em
// LOGIN), ver UsuarioController::historico.
export interface EventoHistorico {
  tipo: TipoEventoHistorico;
  ocorrido_em: string;
  ponto_venda: { id: string; fantasia: string } | null;
  produto: { id: string; descricao: string } | null;
  // Nome do tipo customizado pela empresa (ver TipoRegistro abaixo), não mais um enum fixo.
  tipo_registro: string | null;
  ruptura: boolean | null;
  observacao: string | null;
  dispositivo: string | null;
  // Só vêm preenchidos em VISITA_INICIO/VISITA_FIM (localização do check-in/checkout) — usados
  // na aba "Localização" do histórico.
  latitude: number | string | null;
  longitude: number | string | null;
  distancia_metros: number | string | null;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  user_type: UserType;
  ativo: boolean;
  avatar_url: string | null;
  // Foto de verdade enviada pelo próprio usuário (self-service, hoje só pelo app mobile — ver
  // docs/05-APP-MOBILE-UX.md). Distinto de avatar_url (texto livre, nunca usado hoje). Rota
  // autenticada (`GET /api/usuarios/{uuid}/foto`) — nunca uma URL pública direta, por isso
  // precisa passar pelo axios (com o Authorization já injetado), não um <img src> comum. Ver
  // components/UsuarioAvatar.tsx.
  foto_url: string | null;
  empresa?: Empresa;
  // Só tem valor pra user_type GESTOR — ADMIN sempre tem acesso total, PROMOTOR/SUPERADMIN
  // não usam perfil.
  perfil?: { id: string; nome: string } | null;
  // Só tem valor pra user_type PROMOTOR — nome do perfil de custo, nunca os valores (que
  // exigem a permissão centros_custo.gerenciar). Ver docs/08-CENTRO-DE-CUSTO.md.
  centro_custo?: { id: string; descricao: string } | null;
  // Só tem valor pra user_type PROMOTOR — trava de 1 dispositivo por vez, ver
  // docs/02-API-BACKEND.md. null quando nunca logou pelo mobile.
  dispositivo?: Dispositivo | null;
  created_at: string;
  updated_at: string;
}

export interface PontoVenda {
  id: string;
  codigo_externo: string | null;
  cnpj: string | null;
  razao_social: string;
  fantasia: string;
  latitude: number;
  longitude: number;
  endereco: string;
  numero: string | null;
  bairro: string | null;
  cidade: string;
  cep: string | null;
  telefone: string | null;
  email: string | null;
  numero_checkouts: number | null;
  // Rota autenticada (mesmo padrão de UsuarioAvatar/foto_url) — nunca a URL direta do disco.
  fachada_url: string | null;
  rede_loja: { id: string; descricao: string } | null;
  ramo_atividade: { id: string; descricao: string } | null;
  // Promotores atribuídos a esta loja (regra de negócio 6, ver docs/02-API-BACKEND.md) — vazio
  // quando ninguém foi atribuído ainda (a loja fica visível a todos os promotores da empresa).
  promotores: { id: string; nome: string }[];
  // Só vem preenchido pra quem pede como SUPERADMIN (ver docs/02-API-BACKEND.md) — usado pra
  // escolher a loja certa ao cadastrar contrato de uma empresa que não é a própria.
  empresa?: Empresa;
  // Só carregado no detalhe (PontoVendaDetailPage), nunca na listagem. Ver
  // docs/14-SORTIMENTO-PONTO-VENDA.md.
  sortimento?: SortimentoPontoVenda[];
  // Contagem rápida do mix — só presente na listagem (PontoVendaController::index faz
  // withCount), null no detalhe (que já traz o array `sortimento` inteiro acima). Usado pelo
  // Planejador de Visitas (mapa e impressão de rota).
  sortimento_count: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Comodato de expositor ou ponto extra entre a empresa e um PDV — ver
// docs/01-MODELO-DE-DADOS.md.
// Bloco de resumo computado no backend (ContratoMeta::resumo) — nunca persistido, sempre
// recalculado na leitura a partir dos campos negociados + resultado apurado. Ver
// docs/09-CONTRATO-METAS.md §4.
export interface ContratoMetaResumo {
  valor_investimento_industria: number;
  valor_investimento_empresa: number;
  status_apuracao: StatusApuracaoMeta;
  percentual_atingido: number | null;
  // "Quantas vezes voltou" (múltiplo, não percentual) — ex.: 10 = investiu 1x, apurou 10x.
  retorno_sobre_investimento: number | null;
}

// Meta de contrapartida comercial (verba de trade marketing) negociada dentro de um Contrato —
// ver docs/09-CONTRATO-METAS.md.
export interface ContratoMeta {
  id: string;
  marca: { id: string; descricao: string } | null;
  descricao: string | null;
  valor_investimento: number;
  meta_valor: number;
  periodo_inicio: string;
  periodo_fim: string;
  fonte_pagamento: FontePagamentoMeta;
  percentual_industria: number | null;
  resultado_apurado: number | null;
  apurado_em: string | null;
  apurado_por: { id: string; nome: string } | null;
  resumo: ContratoMetaResumo;
  created_at: string;
  updated_at: string;
}

// Log de alterações do contrato (append-only) — ver docs/02-API-BACKEND.md#contratos.
export interface ContratoHistorico {
  id: string;
  descricao: string;
  usuario: { id: string; nome: string } | null;
  created_at: string;
}

export interface Contrato {
  id: string;
  ponto_venda?: { id: string; fantasia: string };
  tipo: TipoContrato;
  descricao: string | null;
  vigencia_inicio: string;
  vigencia_fim: string;
  arquivo_url: string | null;
  // Sempre vem em GET /contratos/{uuid} (show, usado por ContratoDetailPage); na listagem
  // (GET /contratos) só com `?with_metas=1`, hoje sem consumidor no admin web mas mantido na
  // API — ver docs/02-API-BACKEND.md#contratos.
  metas?: ContratoMeta[];
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DepartamentoAuditoria {
  id: string;
  descricao: string;
  // Só vem preenchido pra quem pede como SUPERADMIN (ver docs/02-API-BACKEND.md) — usado pra
  // mostrar a coluna/filtro "Empresa" no admin web.
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RedeLoja {
  id: string;
  descricao: string;
  // Só vem preenchido pra quem pede como SUPERADMIN (ver docs/02-API-BACKEND.md) — usado pra
  // mostrar a coluna/filtro "Empresa" no admin web.
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface RamoAtividade {
  id: string;
  descricao: string;
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface SecaoAuditoria {
  id: string;
  descricao: string;
  departamento?: { id: string; descricao: string } | null;
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarcaAuditoria {
  id: string;
  descricao: string;
  propriedade: Propriedade;
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface NivelExibicao {
  id: string;
  descricao: string;
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Origem da lista de produtos de um campo SORTIMENTO — docs/20-FORMULARIO-DINAMICO-CAMPANHA.md
// decisão 3. DINAMICO busca ao vivo o sortimento real do PDV dentro do recorte configurado;
// FIXO usa uma lista curada no cadastro do campo, ignorando o sortimento do PDV.
export type SortimentoOrigemCampo = 'DINAMICO' | 'FIXO';
// Subconjunto de TipoItemCampanha — sem PRODUTO, que não faz sentido como recorte de um checklist.
export type SortimentoTipoVinculo = 'SECAO' | 'DEPARTAMENTO' | 'MARCA';

export interface CampoTipoRegistro {
  id: string;
  chave: string;
  rotulo: string;
  tipo_campo: TipoCampoRegistro;
  // Só preenchido quando tipo_campo = MULTIPLA_ESCOLHA.
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
  // Só tem efeito quando tipo_campo = DATA (docs/35-LIMITE-RETROATIVO-CAMPO-DATA.md) — `null` =
  // sem limite, aceita qualquer data passada (comportamento padrão).
  limite_dias_retroativos: number | null;
  // Campo condicional (docs/20-FORMULARIO-DINAMICO-CAMPANHA.md decisão 7) — `depende_de_chave` é
  // a `chave` de outro campo do mesmo tipo_registro (não um uuid), só aparece/é obrigatório
  // quando esse campo pai tiver o valor `depende_de_valor`.
  depende_de_chave: string | null;
  depende_de_valor: string | null;
  // Campo SORTIMENTO (decisão 3) — todos só preenchidos quando tipo_campo = SORTIMENTO.
  sortimento_origem: SortimentoOrigemCampo | null;
  sortimento_tipo_vinculo: SortimentoTipoVinculo | null;
  sortimento_secao: { id: string; descricao: string } | null;
  sortimento_departamento: { id: string; descricao: string } | null;
  sortimento_marca: { id: string; descricao: string } | null;
  // Lista curada — só populada quando sortimento_origem = FIXO.
  sortimento_produtos: { id: string; descricao: string }[];
  // Ausência no checklist vira ruptura só quando este switch está ligado (decisão 4).
  confirmar_ruptura_ausentes: boolean;
}

// Substitui o antigo enum fixo TipoRegistroVisita (FOTO/RUPTURA/OBSERVACAO) — lista
// customizável por empresa, com campos extras próprios (ex.: "Ponto extra" pede quantidade e
// valor além da foto). Ver docs/01-MODELO-DE-DADOS.md#tipos-de-registro.
export type EscopoAcaoTipoRegistro = 'SEMPRE' | 'CAMPANHA' | 'CONTRATO';
export type GranularidadeResposta = 'LINHA' | 'PRODUTO';

export interface TipoRegistro {
  id: string;
  descricao: string;
  // Slug do Material Design Icons, sem o prefixo "mdi-" (ver components/MdiIcon.tsx e
  // App\Support\IconeTipoRegistro no backend) — mesmo valor usado pelo mobile.
  icone: string | null;
  // Sequência de exibição — admin e mobile listam por ela (ver TipoRegistroController::index).
  // Não é editável direto no form: só muda via botões "mover" na listagem.
  ordem: number;
  exige_foto: boolean;
  permite_vincular_catalogo: boolean;
  // Ação obrigatória — aparece na aba Ações da visita em vez de só uma opção do Registro geral.
  // escopo_acao/campanha_auditoria_uuid só fazem sentido quando acao_obrigatoria é true.
  acao_obrigatoria: boolean;
  escopo_acao: EscopoAcaoTipoRegistro | null;
  campanha_auditoria_uuid: string | null;
  // Granularidade da resposta (linha/seção inteira vs. produto individual) — ver
  // docs/16-GRANULARIDADE-CHECKLIST-AUDITORIA.md §4. `null` = sem regra, comportamento livre.
  granularidade_padrao: GranularidadeResposta | null;
  excecoes_granularidade: { secao_uuid: string; secao_descricao: string; granularidade: GranularidadeResposta }[];
  // Marca a coluna "Ruptura" da grade de coleta (Fase 2) — sempre a primeira, marcar um produto
  // exclui ele das demais colunas da mesma linha. Ver docs/16-GRANULARIDADE-CHECKLIST-AUDITORIA.md §9.
  eh_ruptura: boolean;
  // Dispara evento de alerta no Painel de Atividades — ver docs/19-PAINEL-ATIVIDADES.md.
  eh_alerta: boolean;
  // Fase 3 de docs/20-FORMULARIO-DINAMICO-CAMPANHA.md (decisões 5 e 8).
  usa_pontuacao: boolean;
  disponivel_registro_livre: boolean;
  campos: CampoTipoRegistro[];
  empresa?: Empresa;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProdutoAuditoria {
  id: string;
  descricao: string;
  // Opcional por padrão; pode virar obrigatório/único no cadastro via os parâmetros
  // CODIGO_BARRAS_OBRIGATORIO/CODIGO_BARRAS_UNICO da empresa.
  codigo_barras: string | null;
  // Código do ERP de origem — busca por ele também, ver docs/27-BUSCA-MULTIPLA-DE-PRODUTOS.md.
  codigo_externo: string | null;
  imagem_url: string | null;
  departamento?: { id: string; descricao: string } | null;
  secao?: { id: string; descricao: string } | null;
  marca?: { id: string; descricao: string } | null;
  nivel_exibicao?: { id: string; descricao: string } | null;
  produto_final: boolean;
  // Gera aviso nomeado ao finalizar a visita se ficar sem registro — ver
  // docs/16-GRANULARIDADE-CHECKLIST-AUDITORIA.md §6.
  produto_chave: boolean;
  gerar_via_secoes_marcas: boolean;
  peso_kg: number | null;
  propriedade: Propriedade;
  empresa?: Empresa;
  ativo: boolean;
  // PENDENTE/REJEITADO só quando criado por um promotor em modo REQUER_APROVACAO — ver
  // docs/14-SORTIMENTO-PONTO-VENDA.md §9.2.
  status_aprovacao: StatusAprovacao;
  criado_por?: { id: string; nome: string } | null;
  created_at: string;
  updated_at: string;
}

export interface CampanhaItem {
  id: string;
  tipo_item: TipoItemCampanha;
  produto: { id: string; descricao: string } | null;
  departamento: { id: string; descricao: string } | null;
  secao: { id: string; descricao: string } | null;
  marca: { id: string; descricao: string } | null;
  created_at: string;
  updated_at: string;
}

// Vínculo entre produto (ou seção/departamento/marca inteira) e um PDV específico — ver
// docs/14-SORTIMENTO-PONTO-VENDA.md.
export interface SortimentoPontoVenda {
  id: string;
  tipo_item: TipoItemCampanha;
  produto: { id: string; descricao: string; propriedade: Propriedade } | null;
  departamento: { id: string; descricao: string } | null;
  secao: { id: string; descricao: string } | null;
  marca: { id: string; descricao: string } | null;
  // null = cadastrado pelo admin web; preenchido = promotor pela visita.
  usuario: { id: string; nome: string } | null;
  status_aprovacao: StatusAprovacao;
  created_at: string;
  updated_at: string;
}

export interface CampanhaAuditoria {
  id: string;
  descricao: string;
  observacao: string | null;
  layout: string | null;
  vigencia_inicio: string;
  vigencia_fim: string;
  restricao: string | null;
  exclusividade: string | null;
  frequencia_dias: number | null;
  execucao_recorrente: boolean;
  possui_restricao: boolean;
  possui_exclusividade: boolean;
  ativo: boolean;
  itens?: CampanhaItem[];
  created_at: string;
  updated_at: string;
}

export interface CampoRespondido {
  chave: string;
  rotulo: string;
  tipo_campo: TipoCampoRegistro;
  // null quando tipo_campo = SORTIMENTO (usar o campo sortimento abaixo nesse caso).
  valor: string | null;
  sortimento: {
    presentes: { id: string; descricao: string }[];
    ausentes: { id: string; descricao: string }[];
  } | null;
}

export interface VisitaRegistro {
  id: string;
  tipo_registro: { id: string; descricao: string; icone: string | null };
  produto_auditoria: { id: string; descricao: string } | null;
  // Vínculo opcional a um recorte mais amplo do catálogo — no máximo um destes três vem
  // preenchido, conforme `tipo_vinculo` (mesmo padrão de CampanhaItem).
  tipo_vinculo: TipoItemCampanha | null;
  secao: { id: string; descricao: string } | null;
  departamento: { id: string; descricao: string } | null;
  marca: { id: string; descricao: string } | null;
  ruptura: boolean;
  observacao: string | null;
  // Valores dos campos customizados do tipo_registro (ex.: { quantidade: "5", valor: "199.90" }).
  // Cru — pra exibir, usar campos_respondidos (já com rótulo e valor formatado).
  valores_campos: Record<string, string> | null;
  // Mesmo dado de valores_campos, com rótulo resolvido e valor formatado por tipo_campo
  // (BOOLEANO vira Sim/Não, SORTIMENTO resolve os uuids de produto pra descrição) — ver
  // App\Support\FormatadorValoresCampos no backend. Só os campos que têm valor entram na lista.
  campos_respondidos: CampoRespondido[];
  // % de compliance (campos BOOLEANO/SORTIMENTO que "passaram") — só quando
  // tipo_registro.usa_pontuacao = true, ver docs/20-FORMULARIO-DINAMICO-CAMPANHA.md decisão 5.
  pontuacao: number | null;
  // N:N — mesma foto pode evidenciar vários registros, um registro pode ter várias fotos. Ver
  // docs/21-EVIDENCIA-EM-FOTOS.md. Substitui o antigo imagem_url (string única).
  imagens: { id: string; url: string }[];
  // Feedback (docs/28 §3) — só presentes onde o backend contou (detalhe da visita e Painel de
  // Atividades): total de comentários e quantos são novos pra quem está olhando.
  comentarios_count?: number;
  comentarios_novos?: number;
  // Uuid da visita dona (quando o backend carregou a relação) — abre o feed de comentários.
  visita_id?: string;
  // Resolução de alerta (Painel de Atividades) — só relevante quando tipo_registro.eh_alerta é
  // true. Ver docs/19-PAINEL-ATIVIDADES.md.
  alerta_resolvido_em: string | null;
  resolvido_por: { id: string; nome: string } | null;
  // Plano de Ação em andamento nascido deste alerta — só vem no feed do Painel de Atividades
  // (docs/37-PLANOS-DE-ACAO.md §5).
  plano_acao_ativo?: { id: string; status: StatusPlanoAcao } | null;
  // Soft-cancel (nunca hard delete) — registro cancelado continua no histórico mas some das
  // contagens/filtros da visita. Ver VisitaRegistro::cancelado_em no backend.
  cancelado_em: string | null;
  created_at: string;
  updated_at: string;
}

// Planos de Ação — ver docs/37-PLANOS-DE-ACAO.md e App\Http\Resources\PlanoAcaoResource.
export type StatusPlanoAcao = 'ABERTO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';
export type StatusEtapaPlanoAcao = 'PENDENTE' | 'EM_ANDAMENTO' | 'FEITA' | 'CANCELADA' | 'BLOQUEADA';
export type AcaoHistoricoPlanoAcao =
  | 'PLANO_CRIADO'
  | 'PLANO_CONCLUIDO'
  | 'PLANO_CANCELADO'
  | 'ETAPA_ADICIONADA'
  | 'ETAPA_STATUS_ALTERADO';

export interface PlanoAcaoEtapa {
  id: string;
  ordem: number;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  status: StatusEtapaPlanoAcao;
  // Calculado no backend (prazo vencido e ainda não FEITA/CANCELADA), nunca gravado.
  atrasada: boolean;
  responsavel?: { id: string; nome: string } | null;
  responsavel_externo_nome: string | null;
  responsavel_externo_contato: string | null;
  evidencia_obrigatoria: boolean;
  evidencia_texto: string | null;
  evidencia_arquivo_url: string | null;
  // Motivo do bloqueio/cancelamento atual — o histórico guarda todos.
  motivo: string | null;
  feita_em: string | null;
  feita_por?: { id: string; nome: string } | null;
  created_at: string;
  updated_at: string;
}

export interface PlanoAcaoHistorico {
  id: string;
  acao: AcaoHistoricoPlanoAcao;
  etapa_id: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  motivo: string | null;
  descricao: string;
  usuario: { id: string; nome: string } | null;
  created_at: string;
}

export interface PlanoAcao {
  id: string;
  titulo: string;
  descricao: string | null;
  origem_tipo: 'ALERTA' | 'LIVRE';
  origem?: {
    registro_id: string;
    visita_id: string | null;
    tipo_registro: { descricao: string; icone: string | null } | null;
    produto: string | null;
    observacao: string | null;
    ponto_venda: { id: string; fantasia: string } | null;
    promotor: string | null;
    registrado_em: string;
    alerta_resolvido_em: string | null;
  } | null;
  // Escopo opcional — loja (própria ou herdada do alerta) OU rede, ou nenhum.
  ponto_venda?: { id: string; fantasia: string; rede: { id: string; descricao: string } | null } | null;
  rede_loja?: { id: string; descricao: string } | null;
  status: StatusPlanoAcao;
  prazo: string | null;
  atrasado: boolean;
  etapas_resumo: { total: number; feitas: number; atrasadas: number; bloqueadas: number } | null;
  etapa_atual: PlanoAcaoEtapa | null;
  etapas?: PlanoAcaoEtapa[];
  historico?: PlanoAcaoHistorico[];
  criado_por?: { id: string; nome: string };
  concluido_em: string | null;
  concluido_por?: { id: string; nome: string } | null;
  cancelado_em: string | null;
  cancelado_por?: { id: string; nome: string } | null;
  motivo_cancelamento: string | null;
  created_at: string;
  updated_at: string;
}

// Galeria de Fotos — grade só de fotos (VisitaRegistro com ≥1 imagem), diferente do Atividades
// (que mistura eventos). Cada item embrulha o VisitaRegistroResource com loja/rede/ramo/
// promotor ao lado, já que o Resource sozinho não sabe da Visita dona. Ver
// docs/23-GALERIA-DE-FOTOS.md §3.3.
export interface FotoGaleria {
  id: string;
  ocorrido_em: string;
  ponto_venda: {
    id: string;
    fantasia: string;
    rede_loja: { id: string; descricao: string } | null;
    ramo_atividade: { id: string; descricao: string } | null;
  } | null;
  usuario: { id: string; nome: string; foto_url: string | null } | null;
  registro: VisitaRegistro;
}

// Feed do Painel de Atividades — mistura Visita (check-in/checkout) e VisitaRegistro-alerta
// num shape comum, discriminado por tipo_evento. Ver docs/19-PAINEL-ATIVIDADES.md.
export type TipoEventoAtividade = 'VISITA_INICIADA' | 'VISITA_FINALIZADA' | 'ALERTA' | 'COMENTARIO';

export interface AtividadeEvento {
  tipo_evento: TipoEventoAtividade;
  ocorrido_em: string;
  visita: { id: string };
  ponto_venda: { id: string; fantasia: string } | null;
  usuario: { id: string; nome: string; foto_url: string | null } | null;
  // Só em VISITA_INICIADA.
  localizacao?: { latitude: number; longitude: number; distancia_metros: number | null };
  // Só em VISITA_FINALIZADA — registros com foto coletados na visita, pro mosaico do card
  // (mesmo shape de VisitaRegistro, pra galeria mostrar a informação junto da imagem).
  resumo?: { registros: number; rupturas: number };
  imagens?: VisitaRegistro[];
  // Só em ALERTA.
  registro?: VisitaRegistro;
  // Só em COMENTARIO — resposta do promotor num feedback (docs/28 §3).
  comentario?: {
    id: string;
    texto: string;
    registro_id: string;
    tipo_registro: string | null;
    produto: string | null;
    comentarios_count: number;
    comentarios_novos: number;
  };
}

export interface Visita {
  id: string;
  ponto_venda?: {
    id: string;
    razao_social: string;
    fantasia: string;
    latitude?: number;
    longitude?: number;
    endereco?: string | null;
    fachada_url?: string | null;
  };
  usuario?: { id: string; nome: string; foto_url?: string | null };
  // Presente só quando a visita nasceu de uma OrdemServico direcionada — null/ausente pra
  // visita espontânea, que é o caso comum. Ver docs/07-ORDEM-DE-SERVICO.md.
  ordem_servico?: { id: string } | null;
  // Só quando havia exatamente uma campanha vigente no check-in (VisitaController::resolverCampanhaUnica).
  campanha?: { id: string; descricao: string } | null;
  status: StatusVisita;
  inicio_data: string;
  inicio_latitude: number;
  inicio_longitude: number;
  inicio_distancia_metros: number;
  fim_data: string | null;
  fim_latitude: number | null;
  fim_longitude: number | null;
  fim_distancia_metros: number | null;
  checkout_tipo: CheckoutTipo | null;
  registros?: VisitaRegistro[];
  // Só presente no GET /visitas/{uuid} — log de cancelamento / checkout forçado / correção de
  // horário feito por um gestor. Ver docs/15-INTERVENCAO-ADMINISTRATIVA-VISITA.md.
  intervencoes?: VisitaIntervencao[];
  created_at: string;
  updated_at: string;
}

export interface VisitaIntervencaoSnapshot {
  status: StatusVisita;
  inicio_data: string | null;
  fim_data: string | null;
  checkout_tipo: CheckoutTipo | null;
}

export interface VisitaIntervencao {
  id: string;
  acao: AcaoIntervencaoVisita;
  motivo: string;
  descricao: string;
  valores_anteriores: VisitaIntervencaoSnapshot;
  valores_novos: VisitaIntervencaoSnapshot;
  usuario?: { id: string; nome: string } | null;
  created_at: string;
}

// Tag colorida pra classificar uma OrdemServico (manual ou gerada por AgendaVisita) — ver
// docs/10-AGENDA-VISITA.md.
export interface TipoVisita {
  id: string;
  descricao: string;
  cor: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Motivo de negócio de uma OrdemServico (ex. "Reposição", "Negociação") — cadastro por empresa,
// mesmo desenho de TipoVisita mas sem cor (eixo diferente: tipo é classificação visual, objetivo
// é o motivo específico). Ver docs/13-AGENDA-MOBILE-E-AUTONOMIA.md.
export interface ObjetivoVisita {
  id: string;
  descricao: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

// Compromisso de visita que o gestor direciona a um promotor (ou deixa em fila aberta,
// usuario null) — separado de Visita de propósito. Ver docs/07-ORDEM-DE-SERVICO.md.
// Formulário exigido por uma OrdemServico específica — obrigatorio/calcula_percentual_compliance
// vêm do vínculo (docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md §2 decisão 9), não do TipoRegistro.
export interface FormularioOrdemServico {
  tipo_registro: { id: string; descricao: string };
  obrigatorio: boolean;
  calcula_percentual_compliance: boolean;
  respondido_em: string | null;
}

export interface OrdemServico {
  id: string;
  ponto_venda?: { id: string; fantasia: string };
  usuario: { id: string; nome: string } | null;
  origem: OrigemOrdemServico;
  campanha?: { id: string; descricao: string } | null;
  // Presente só em origem CONTRATO — ver docs/09-CONTRATO-METAS.md e
  // App\Console\Commands\GerarOrdensServicoPorContrato.
  contrato?: { id: string; tipo: TipoContrato } | null;
  // Presente só em origem DIRECIONAMENTO — ver docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md.
  direcionamento?: { id: string; descricao: string } | null;
  formularios?: FormularioOrdemServico[];
  // tipo/prioridade/horário valem pra qualquer origem, não só AGENDA — ver
  // docs/10-AGENDA-VISITA.md §3.3.
  tipo_visita?: TipoVisita | null;
  objetivo_visita?: ObjetivoVisita | null;
  agenda_visita?: { id: string } | null;
  prioridade: PrioridadeVisita | null;
  horario_previsto: string | null;
  obrigatoria: boolean;
  prazo_inicio: string;
  prazo_fim: string;
  // Só presentes durante REAGENDAMENTO_SOLICITADO — o prazo oficial acima continua intacto até
  // o gestor decidir. Ver docs/13-AGENDA-MOBILE-E-AUTONOMIA.md.
  prazo_inicio_proposto: string | null;
  prazo_fim_proposto: string | null;
  // Preenchido só quando o gestor rejeitou a solicitação mais recente — ver
  // docs/13-AGENDA-MOBILE-E-AUTONOMIA.md.
  motivo_rejeicao: string | null;
  status: StatusOrdemServico;
  visita: { id: string } | null;
  observacao: string | null;
  empresa?: Empresa;
  created_at: string;
  updated_at: string;
}

// Tipo de recorrência de uma AgendaVisita — ver docs/10-AGENDA-VISITA.md.
export type RecorrenciaAgendaVisita = 'SEMANAL' | 'DATA_UNICA';

// Molde que gera Ordem de Serviço em massa — ver docs/25-DIRECIONAMENTO-ORDEM-SERVICO.md.
export interface FormularioDirecionamento {
  tipo_registro: { id: string; descricao: string };
  obrigatorio: boolean;
  calcula_percentual_compliance: boolean;
}

export interface Direcionamento {
  id: string;
  descricao: string;
  vigencia_inicio: string;
  vigencia_fim: string;
  ativo: boolean;
  // Presente só na listagem (DirecionamentosListPage) — o resumo de progresso completo só vem
  // no detalhe (buscarDirecionamento).
  ordens_servico_count?: number | null;
  filtros: {
    pontos_venda: { id: string; fantasia: string }[];
    redes_loja: { id: string; descricao: string }[];
    promotores: { id: string; nome: string }[];
  };
  formularios: FormularioDirecionamento[];
  created_at: string;
  updated_at: string;
}

// "N expedidos, M preenchidos" — computado ao vivo, nunca um contador solto (ver
// App\Support\ProgressoDirecionamento).
export interface ProgressoDirecionamento {
  ordens_geradas: number;
  ordens_concluidas: number;
  ordens_pendentes: number;
  por_formulario: { tipo_registro_id: string; descricao: string; expedidos: number; preenchidos: number }[];
}

// Regra recorrente (semanal, num dia fixo) ou pontual (uma data específica) que define a rotina
// de um promotor num PDV — gera OrdemServico automaticamente (origem AGENDA). Ver
// docs/10-AGENDA-VISITA.md.
export interface AgendaVisita {
  id: string;
  ponto_venda?: { id: string; fantasia: string };
  usuario: { id: string; nome: string };
  tipo_visita: TipoVisita | null;
  objetivo_visita: ObjetivoVisita | null;
  prioridade: PrioridadeVisita;
  recorrencia: RecorrenciaAgendaVisita;
  // 0 (domingo) a 6 (sábado) — presente só quando recorrencia = SEMANAL.
  dia_semana: number | null;
  // Presente só quando recorrencia = DATA_UNICA.
  data: string | null;
  horario_previsto: string | null;
  obrigatoria: boolean;
  ativo: boolean;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

// Categoria de um item de custo dentro de um CentroCusto — ver docs/08-CENTRO-DE-CUSTO.md.
export type CategoriaCentroCustoItem = 'INDIVIDUAL' | 'GERAL';

export interface CentroCustoItem {
  id: string;
  categoria: CategoriaCentroCustoItem;
  descricao: string;
  valor_mensal: number;
  ordem: number;
}

// Nunca persistido no backend — sempre recalculado a partir dos itens + quantidade de
// promotores vinculados no momento da leitura. Ver App\Models\CentroCusto::resumoCusto.
export interface ResumoCentroCusto {
  qtd_promotores_ativos: number;
  custo_individual_mensal: number;
  custo_geral_mensal: number;
  custo_geral_por_promotor: number;
  custo_total_mensal_promotor: number;
  horas_mensais: number;
  custo_por_hora: number;
}

// Perfil de custo reutilizável atribuível a um ou mais promotores (Usuario.centro_custo) — não
// é o holerite de uma pessoa específica. Ver docs/08-CENTRO-DE-CUSTO.md.
export interface CentroCusto {
  id: string;
  descricao: string;
  carga_horaria_semanal: number;
  itens: CentroCustoItem[];
  resumo: ResumoCentroCusto;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// Referência visual de layout de prateleira/expositor — ver docs/22-PLANOGRAMA.md.
export interface PlanogramaBloco {
  id: string;
  posicao_inicio: number;
  largura: number;
  produto_auditoria: { id: string; descricao: string; imagem_url: string | null } | null;
}

export interface PlanogramaPrateleira {
  id: string;
  ordem: number;
  descricao: string | null;
  quantidade_blocos: number;
  blocos: PlanogramaBloco[];
}

export interface Planograma {
  id: string;
  descricao: string;
  foto_capa_url: string | null;
  ativo: boolean;
  prateleiras: PlanogramaPrateleira[];
  // Só vem preenchido pra quem pede como SUPERADMIN.
  empresa?: Empresa;
  created_at: string;
  updated_at: string;
}

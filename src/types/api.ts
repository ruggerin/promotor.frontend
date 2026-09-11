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
  | 'visitas.intervir';
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
export type TipoCampoRegistro = 'NUMERO' | 'TEXTO' | 'MOEDA' | 'MULTIPLA_ESCOLHA';
// visitas.tipo (PROGRAMADA/NAO_PROGRAMADA) foi removido — agendamento agora vive inteiro em
// OrdemServico, ver docs/07-ORDEM-DE-SERVICO.md e docs/10-AGENDA-VISITA.md. CONTRATO = gerada
// automaticamente por um comodato/ponto extra vencendo, ver GerarOrdensServicoPorContrato.
export type OrigemOrdemServico = 'MANUAL' | 'CAMPANHA' | 'AGENDA' | 'CONTRATO';

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
  // Promotores atribuídos a esta loja (regra de negócio 6, ver docs/02-API-BACKEND.md) — vazio
  // quando ninguém foi atribuído ainda (a loja fica visível a todos os promotores da empresa).
  promotores: { id: string; nome: string }[];
  // Só vem preenchido pra quem pede como SUPERADMIN (ver docs/02-API-BACKEND.md) — usado pra
  // escolher a loja certa ao cadastrar contrato de uma empresa que não é a própria.
  empresa?: Empresa;
  // Só carregado no detalhe (PontoVendaDetailPage), nunca na listagem. Ver
  // docs/14-SORTIMENTO-PONTO-VENDA.md.
  sortimento?: SortimentoPontoVenda[];
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

export interface CampoTipoRegistro {
  id: string;
  chave: string;
  rotulo: string;
  tipo_campo: TipoCampoRegistro;
  // Só preenchido quando tipo_campo = MULTIPLA_ESCOLHA.
  opcoes: string[] | null;
  obrigatorio: boolean;
  ordem: number;
}

// Substitui o antigo enum fixo TipoRegistroVisita (FOTO/RUPTURA/OBSERVACAO) — lista
// customizável por empresa, com campos extras próprios (ex.: "Ponto extra" pede quantidade e
// valor além da foto). Ver docs/01-MODELO-DE-DADOS.md#tipos-de-registro.
export type EscopoAcaoTipoRegistro = 'SEMPRE' | 'CAMPANHA' | 'CONTRATO';
export type GranularidadeResposta = 'LINHA' | 'PRODUTO';

export interface TipoRegistro {
  id: string;
  descricao: string;
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
  imagem_url: string | null;
  departamento?: { id: string; descricao: string } | null;
  secao?: { id: string; descricao: string } | null;
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

export interface VisitaRegistro {
  id: string;
  tipo_registro: { id: string; descricao: string };
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
  valores_campos: Record<string, string> | null;
  imagem_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Visita {
  id: string;
  ponto_venda?: { id: string; razao_social: string; fantasia: string };
  usuario?: { id: string; nome: string };
  // Presente só quando a visita nasceu de uma OrdemServico direcionada — null/ausente pra
  // visita espontânea, que é o caso comum. Ver docs/07-ORDEM-DE-SERVICO.md.
  ordem_servico?: { id: string } | null;
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
export interface OrdemServico {
  id: string;
  ponto_venda?: { id: string; fantasia: string };
  usuario: { id: string; nome: string } | null;
  origem: OrigemOrdemServico;
  campanha?: { id: string; descricao: string } | null;
  // Presente só em origem CONTRATO — ver docs/09-CONTRATO-METAS.md e
  // App\Console\Commands\GerarOrdensServicoPorContrato.
  contrato?: { id: string; tipo: TipoContrato } | null;
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

import type { PaginatedMeta, ProdutoAuditoria, Propriedade } from '../../types/api';
import { apiClient } from './client';

export interface ProdutosListResponse {
  produtos: ProdutoAuditoria[];
  meta: PaginatedMeta;
}

export async function listarProdutos(
  // empresa_uuid só tem efeito pra quem chama como SUPERADMIN — ver docs/02-API-BACKEND.md.
  params: {
    ativo?: boolean;
    departamento_uuid?: string;
    secao_uuid?: string;
    marca_uuid?: string;
    propriedade?: Propriedade;
    empresa_uuid?: string;
    busca?: string;
    page?: number;
    // "Colar lista de códigos": código externo OU de barras, casamento exato.
    codigos?: string[];
    por_pagina?: number;
    // Só produtos sem imagem_url (docs/89).
    sem_imagem?: boolean;
  } = {},
): Promise<ProdutosListResponse> {
  const { data } = await apiClient.get<ProdutosListResponse>('/produtos-auditoria', {
    params: {
      ativo: params.ativo === undefined ? undefined : params.ativo ? 1 : 0,
      departamento_uuid: params.departamento_uuid,
      secao_uuid: params.secao_uuid,
      marca_uuid: params.marca_uuid,
      propriedade: params.propriedade,
      page: params.page,
      empresa_uuid: params.empresa_uuid,
      busca: params.busca || undefined,
      codigos: params.codigos?.length ? params.codigos.join(',') : undefined,
      por_pagina: params.por_pagina,
      sem_imagem: params.sem_imagem ? 1 : undefined,
    },
  });
  return data;
}

export interface ProdutoPayload {
  descricao: string;
  codigo_barras?: string | null;
  codigo_externo?: string | null;
  imagem_url?: string | null;
  departamento_uuid?: string | null;
  secao_uuid?: string | null;
  marca_uuid?: string | null;
  nivel_exibicao_uuid?: string | null;
  produto_final?: boolean;
  produto_chave?: boolean;
  gerar_via_secoes_marcas?: boolean;
  peso_kg?: number | null;
  preco_tabela?: number | null;
  desconto_maximo_pct?: number | null;
  propriedade: Propriedade;
  ativo?: boolean;
}

export async function criarProduto(payload: ProdutoPayload): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.post<{ produto: ProdutoAuditoria }>('/produtos-auditoria', payload);
  return data;
}

export async function atualizarProduto(uuid: string, payload: Partial<ProdutoPayload>): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.put<{ produto: ProdutoAuditoria }>(`/produtos-auditoria/${uuid}`, payload);
  return data;
}

// Upload da foto (alternativa a colar URL) — o backend grava no storage e devolve o produto com
// imagem_url já apontando pra foto enviada. Ver ProdutoAuditoriaController::uploadImagem.
export async function enviarImagemProduto(uuid: string, imagem: File): Promise<{ produto: ProdutoAuditoria }> {
  const formData = new FormData();
  formData.append('imagem', imagem);
  const { data } = await apiClient.post<{ produto: ProdutoAuditoria }>(`/produtos-auditoria/${uuid}/imagem`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function desativarProduto(uuid: string): Promise<void> {
  await apiClient.delete(`/produtos-auditoria/${uuid}`);
}

// Painel de aprovação de produto cadastrado por promotor (self-service) — ver
// docs/14-SORTIMENTO-PONTO-VENDA.md §9.
export async function aprovarProduto(uuid: string): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.post<{ produto: ProdutoAuditoria }>(`/produtos-auditoria/${uuid}/aprovar`);
  return data;
}

export async function rejeitarProduto(uuid: string): Promise<{ produto: ProdutoAuditoria }> {
  const { data } = await apiClient.post<{ produto: ProdutoAuditoria }>(`/produtos-auditoria/${uuid}/rejeitar`);
  return data;
}

// Importação de imagens pelo nome do arquivo (docs/89-IMPORTACAO-DE-IMAGENS-DE-PRODUTOS.md). Espelha
// App\Support\ImportacaoImagensProdutos.
export type ChaveImagemProduto = 'codigo_barras' | 'codigo_externo';

export type SituacaoImagemProduto =
  | 'ok'
  | 'nao_encontrado'
  | 'ambiguo'
  | 'duplicado'
  | 'ja_tem_imagem'
  | 'formato_invalido'
  | 'gravado';

export interface ProdutoDaImagem {
  id: string;
  descricao: string;
  codigo_barras: string | null;
  codigo_externo: string | null;
  imagem_url: string | null;
  ativo: boolean;
}

export interface ResultadoImagemProduto {
  nome: string;
  situacao: SituacaoImagemProduto;
  mensagem?: string | null;
  produto?: ProdutoDaImagem;
  produtos?: ProdutoDaImagem[];
}

export interface RelatorioImagensProdutos {
  resultados: ResultadoImagemProduto[];
  resumo: Record<SituacaoImagemProduto, number>;
}

export async function simularImportacaoImagens(
  chave: ChaveImagemProduto,
  nomes: string[],
  substituir: boolean,
): Promise<RelatorioImagensProdutos> {
  const { data } = await apiClient.post<RelatorioImagensProdutos>('/produtos-auditoria/imagens/simular', {
    chave,
    nomes,
    substituir,
  });
  return data;
}

// Até 10 arquivos por chamada (limite do backend) — quem chama divide em lotes.
export async function importarImagensProdutos(
  chave: ChaveImagemProduto,
  imagens: File[],
  substituir: boolean,
): Promise<RelatorioImagensProdutos> {
  const formData = new FormData();
  formData.append('chave', chave);
  formData.append('substituir', substituir ? '1' : '0');
  for (const imagem of imagens) formData.append('imagens[]', imagem, imagem.name);
  const { data } = await apiClient.post<RelatorioImagensProdutos>('/produtos-auditoria/imagens/importar', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

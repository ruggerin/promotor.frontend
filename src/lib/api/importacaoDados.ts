import { apiClient } from './client';

// Importação de Dados (docs/42-IMPORTACAO-DE-DADOS.md) — Loja, Produto e Vínculo Loja × Produto.
// Mesmo contrato nas três: multipart `arquivo` + `simular` (valida e devolve o relatório sem
// gravar), tudo ou nada. Loja/Produto devolvem `atualizadas`; Vínculo devolve `ja_existentes`
// (vínculo não tem campo pra atualizar, só existe ou não).
export interface RelatorioImportacao {
  total: number;
  criadas: number;
  atualizadas?: number;
  ja_existentes?: number;
  erros: { linha: number; codigo_externo: string | null; mensagem: string }[];
  aplicado: boolean;
}

async function enviar(url: string, arquivo: File, simular: boolean): Promise<RelatorioImportacao> {
  const form = new FormData();
  form.append('arquivo', arquivo);
  form.append('simular', simular ? '1' : '0');
  const { data } = await apiClient.post<RelatorioImportacao>(url, form);
  return data;
}

export const importarPontosVenda = (arquivo: File, simular: boolean) => enviar('/pontos-venda/importar', arquivo, simular);
export const importarProdutos = (arquivo: File, simular: boolean) => enviar('/produtos-auditoria/importar', arquivo, simular);
export const importarSortimento = (arquivo: File, simular: boolean) => enviar('/sortimentos/importar', arquivo, simular);

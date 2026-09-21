/** Salva um Blob (ex.: PDF vindo de rota autenticada) como download, via <a download> temporário. */
export function baixarBlob(nomeArquivo: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Baixa uma tabela como CSV — separador ";" e BOM UTF-8, o par que o Excel em pt-BR abre certo
 * (acentos e colunas) sem assistente de importação. Gerado no navegador a partir do que a tela já
 * carregou, então o arquivo é sempre idêntico ao que está na tela.
 */
export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: (string | number | null)[][]): void {
  const celula = (valor: string | number | null) => {
    const texto = valor === null ? '' : String(valor);
    return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(celula).join(';')).join('\r\n');

  const url = URL.createObjectURL(new Blob(['﻿', conteudo], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  link.click();
  URL.revokeObjectURL(url);
}

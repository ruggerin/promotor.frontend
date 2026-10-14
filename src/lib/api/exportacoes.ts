import axios from 'axios';
import { apiClient } from './client';

// Exportação padronizada (docs/68): o servidor gera o arquivo a partir da MESMA consulta da tela;
// o navegador só diz qual rotina, quais filtros e qual formato.

export type FormatoExportacao = 'csv' | 'xlsx';

export interface PedidoExportacao {
  rotina: string;
  formato: FormatoExportacao;
  /** Os filtros da tela, no mesmo formato que a listagem já manda pra API. */
  filtros?: Record<string, string | string[] | number | boolean | null | undefined>;
  /** Texto humano dos filtros ("Loja: Mercado Central · Status: Aberto") — vai na aba "Sobre" do Excel. */
  descricaoFiltros?: string;
}

export interface ArquivoExportado {
  blob: Blob;
  nome: string;
  linhas: number;
}

function nomeDoCabecalho(disposicao: string | undefined, padrao: string): string {
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicao ?? '');
  return m ? decodeURIComponent(m[1]) : padrao;
}

export async function exportar(pedido: PedidoExportacao): Promise<ArquivoExportado> {
  const filtros = Object.fromEntries(Object.entries(pedido.filtros ?? {}).filter(([, v]) => v !== null && v !== undefined && v !== ''));

  try {
    const resposta = await apiClient.post<Blob>(
      '/exportacoes',
      { rotina: pedido.rotina, formato: pedido.formato, filtros, descricao_filtros: pedido.descricaoFiltros },
      { responseType: 'blob' },
    );
    return {
      blob: resposta.data,
      nome: nomeDoCabecalho(resposta.headers['content-disposition'] as string | undefined, `${pedido.rotina}.${pedido.formato}`),
      linhas: Number(resposta.headers['x-linhas-exportadas'] ?? 0),
    };
  } catch (erro) {
    // Com responseType blob o corpo do erro (JSON do Laravel) também chega como Blob.
    if (axios.isAxiosError(erro) && erro.response?.data instanceof Blob) {
      try {
        const corpo = JSON.parse(await erro.response.data.text()) as { message?: string };
        throw new Error(corpo.message ?? 'Não foi possível gerar o arquivo.');
      } catch (interno) {
        if (interno instanceof Error && interno.message !== 'Unexpected end of JSON input' && !(interno instanceof SyntaxError)) {
          throw interno;
        }
      }
    }
    throw new Error('Não foi possível gerar o arquivo. Tente de novo.');
  }
}

import type { ReactNode } from 'react';
import { importarPontosVenda, importarProdutos, importarSortimento, type RelatorioImportacao } from '../../lib/api/importacaoDados';
import type { Permissao } from '../../types/api';

// Configuração de cada tipo da Importação de Dados (docs/42-IMPORTACAO-DE-DADOS.md) — o
// ImportarDadosDialog é um só, parametrizado por isto. As colunas espelham o COLUNAS de cada
// App\Support\Importacao* no backend (mesma ordem).

export interface TipoImportacao {
  chave: 'lojas' | 'produtos' | 'sortimento';
  titulo: string;
  resumo: string;
  permissao: Permissao;
  colunas: string[];
  exemplo: string[][];
  arquivoModelo: string;
  ajuda: ReactNode;
  // Palavras do relatório ("3 loja(s) nova(s)").
  itemSingularPlural: string;
  importar: (arquivo: File, simular: boolean) => Promise<RelatorioImportacao>;
  // Chaves do React Query a invalidar depois de importar de verdade.
  invalidar: string[];
}

export const TIPOS_IMPORTACAO: TipoImportacao[] = [
  {
    chave: 'lojas',
    titulo: 'Lojas',
    resumo: 'Pontos de venda — cria as novas e atualiza as existentes pelo código externo.',
    permissao: 'pontos_venda.gerenciar',
    colunas: [
      'codigo_externo', 'cnpj', 'razao_social', 'fantasia', 'endereco', 'numero', 'bairro', 'cidade', 'cep', 'telefone',
      'email', 'latitude', 'longitude', 'rede', 'ramo_atividade', 'numero_checkouts', 'ativo',
    ],
    exemplo: [
      ['1001', '11.222.333/0001-44', 'Supermercado Exemplo LTDA', 'Super Exemplo Centro', 'Av. Eduardo Ribeiro', '520', 'Centro',
        'Manaus', '69010-001', '(92) 3333-0000', 'contato@exemplo.com.br', '-3,1316', '-60,0233', '', '', '6', 'sim'],
      ['1002', '', 'Mercadinho Bairro ME', 'Mercadinho do Bairro', 'Rua das Flores', '45', 'Aleixo', 'Manaus', '', '', '',
        '-3,0950', '-59,9950', '', '', '', 'sim'],
    ],
    arquivoModelo: 'modelo-importacao-lojas.csv',
    ajuda: (
      <>
        Loja nova precisa de razão social, fantasia, endereço, cidade, latitude e longitude. Rede e ramo de atividade vão
        pelo nome já cadastrado. Ativo: sim ou não.
      </>
    ),
    itemSingularPlural: 'loja(s)',
    importar: importarPontosVenda,
    invalidar: ['pontos-venda'],
  },
  {
    chave: 'produtos',
    titulo: 'Produtos',
    resumo: 'Catálogo — cria os novos e atualiza os existentes pelo código externo, inclusive preço.',
    permissao: 'catalogo.gerenciar',
    colunas: [
      'codigo_externo', 'descricao', 'codigo_barras', 'departamento', 'secao', 'marca', 'peso_kg', 'propriedade',
      'preco_tabela', 'desconto_maximo_pct', 'ativo',
    ],
    exemplo: [
      ['P1001', 'Lasanha Bolonhesa 600g', '7891234567890', 'Congelados', 'Lasanhas', 'Seara', '0,6', 'Própria', '12,90', '5', 'sim'],
      ['P1002', 'Lasanha Frango 600g', '', '', 'Lasanhas', 'Sadia', '0,6', 'Concorrente', '', '', 'sim'],
    ],
    arquivoModelo: 'modelo-importacao-produtos.csv',
    ajuda: (
      <>
        Produto novo precisa de descrição. Departamento, seção e marca vão pelo nome já cadastrado (seção sem departamento
        usa o departamento dela). Propriedade: Própria ou Concorrente. Preço e desconto máximo alimentam o Pedido de Venda.
      </>
    ),
    itemSingularPlural: 'produto(s)',
    importar: importarProdutos,
    invalidar: ['produtos'],
  },
  {
    chave: 'sortimento',
    titulo: 'Vínculo Loja × Produto',
    resumo: 'Mix de cada loja — uma linha por par loja + produto, pelos códigos externos.',
    permissao: 'pontos_venda.gerenciar',
    colunas: ['codigo_externo_loja', 'codigo_externo_produto'],
    exemplo: [
      ['1001', 'P1001'],
      ['1001', 'P1002'],
      ['1002', 'P1001'],
    ],
    arquivoModelo: 'modelo-importacao-vinculo-loja-produto.csv',
    ajuda: (
      <>
        <strong>Só adiciona</strong>: vínculo que já existe fica como está, e vínculo que não está no arquivo{' '}
        <strong>não é removido</strong> (desvincular continua sendo pela tela da loja). Vínculo pendente, criado por
        promotor, é aprovado. Até 50.000 linhas por arquivo.
      </>
    ),
    itemSingularPlural: 'vínculo(s)',
    importar: importarSortimento,
    invalidar: ['sortimento', 'pontos-venda'],
  },
];

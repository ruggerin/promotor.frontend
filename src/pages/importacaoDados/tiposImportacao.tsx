import type { ReactNode } from 'react';
import {
  importarPontosVenda,
  importarProdutos,
  importarCarteira,
  importarRotaVisitas,
  importarSortimento,
  importarSupervisores,
  importarVendedores,
  type RelatorioImportacao,
} from '../../lib/api/importacaoDados';
import type { Permissao } from '../../types/api';

// Configuração de cada tipo da Importação de Dados (docs/42-IMPORTACAO-DE-DADOS.md) — o
// ImportarDadosDialog é um só, parametrizado por isto. As colunas espelham o COLUNAS de cada
// App\Support\Importacao* no backend (mesma ordem).

export interface TipoImportacao {
  chave: 'lojas' | 'produtos' | 'sortimento' | 'supervisores' | 'vendedores' | 'carteira' | 'rota';
  titulo: string;
  resumo: string;
  permissao: Permissao;
  colunas: string[];
  exemplo: string[][];
  arquivoModelo: string;
  ajuda: ReactNode;
  // Palavras do relatório ("3 loja(s) nova(s)").
  itemSingularPlural: string;
  importar: (arquivo: File, simular: boolean, extras?: Record<string, string>) => Promise<RelatorioImportacao>;
  // Rota de visitas: campo "Promotor da rota", que vale pras linhas sem a coluna `promotor` (docs/78 §2.2).
  promotorDaRota?: boolean;
  // Switch "Substituir dados existentes" (docs/42 §4.3.1, docs/78 §4.1): manda `substituir=1`, e o
  // backend apaga/desativa o que não veio no arquivo, dentro do escopo descrito em `ajuda`.
  substituir?: { ajuda: string };
  // Texto do topo do diálogo, quando o padrão ("o código externo é a chave...") não serve.
  introducao?: ReactNode;
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
      'codigo_externo', 'cnpj', 'razao_social', 'fantasia', 'endereco', 'numero', 'bairro', 'cidade', 'uf', 'cep', 'telefone',
      'email', 'latitude', 'longitude', 'rede', 'ramo_atividade', 'numero_checkouts', 'ativo', 'vendedores',
    ],
    exemplo: [
      ['1001', '11.222.333/0001-44', 'Supermercado Exemplo LTDA', 'Super Exemplo Centro', 'Av. Eduardo Ribeiro', '520', 'Centro',
        'Manaus', 'AM', '69010-001', '(92) 3333-0000', 'contato@exemplo.com.br', '-3,1316', '-60,0233', '', '', '6', 'sim', '374|680'],
      ['1002', '', 'Mercadinho Bairro ME', 'Mercadinho do Bairro', 'Rua das Flores', '45', 'Aleixo', 'Manaus', 'AM', '', '', '',
        '-3,0950', '-59,9950', '', '', '', 'sim', '1234 - JOÃO'],
    ],
    arquivoModelo: 'modelo-importacao-lojas.csv',
    ajuda: (
      <>
        Loja nova precisa de razão social, fantasia, endereço, cidade, latitude e longitude. Rede e ramo de atividade vão
        pelo nome já cadastrado. Ativo: sim ou não. UF pela sigla (AM, SP...). <strong>vendedores</strong>: código do
        vendedor no ERP (aceita "1234 - JOÃO"), vários separados por |; preenchida substitui a carteira da loja, vazia não
        mexe.
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
        Por padrão <strong>só adiciona</strong>: vínculo que já existe fica como está, e vínculo que não está no
        arquivo <strong>não é removido</strong>. Vínculo pendente, criado por promotor, é aprovado. Até 50.000 linhas
        por arquivo; se dividir em partes, mantenha cada loja inteira num arquivo só.
      </>
    ),
    substituir: {
      ajuda:
        'Cada loja do arquivo fica só com os produtos listados: os outros vínculos de produto dela são removidos (inclusive os pendentes). Lojas que não estão no arquivo e vínculos por departamento, seção ou marca não mudam.',
    },
    itemSingularPlural: 'vínculo(s)',
    importar: importarSortimento,
    invalidar: ['sortimento', 'pontos-venda'],
  },
  {
    chave: 'supervisores',
    titulo: 'Supervisores',
    resumo: 'Supervisores de vendas do ERP — cria os novos e atualiza os existentes pelo código.',
    permissao: 'vendedores.gerenciar',
    colunas: ['codigo_externo', 'nome', 'telefone', 'email', 'ativo'],
    exemplo: [
      ['S10', 'Ana Souza', '(92) 99999-1000', 'ana.souza@exemplo.com.br', 'sim'],
      ['S20', 'Bruno Lima', '', '', 'sim'],
    ],
    arquivoModelo: 'modelo-importacao-supervisores.csv',
    ajuda: (
      <>
        Supervisor novo precisa de nome. Importe os supervisores <strong>antes</strong> dos vendedores. Quem saiu do ERP vai
        com ativo = não: o cadastro fica, só deixa de aparecer como ativo.
      </>
    ),
    itemSingularPlural: 'supervisor(es)',
    importar: importarSupervisores,
    invalidar: ['supervisores', 'vendedores'],
  },
  {
    chave: 'vendedores',
    titulo: 'Vendedores',
    resumo: 'Vendedores (RCA) do ERP, com o supervisor de cada um pelo codsupervisor.',
    permissao: 'vendedores.gerenciar',
    colunas: ['codigo_externo', 'nome', 'telefone', 'email', 'codsupervisor', 'ativo'],
    exemplo: [
      ['101', 'Carlos Pereira', '(92) 98888-0101', 'carlos@exemplo.com.br', 'S10', 'sim'],
      ['102', 'Dora Matos', '', '', 'S20', 'sim'],
    ],
    arquivoModelo: 'modelo-importacao-vendedores.csv',
    ajuda: (
      <>
        Vendedor novo precisa de nome. <strong>codsupervisor</strong> é o código do supervisor no ERP; se ele ainda não
        estiver cadastrado, o vendedor entra assim mesmo e é ligado ao supervisor quando ele for importado.
      </>
    ),
    itemSingularPlural: 'vendedor(es)',
    importar: importarVendedores,
    invalidar: ['vendedores', 'supervisores'],
  },
  {
    chave: 'carteira',
    titulo: 'Vínculo Loja × Vendedor',
    resumo: 'Carteira: quais vendedores atendem cada loja. Uma loja pode ter vários.',
    permissao: 'vendedores.gerenciar',
    colunas: ['codigo_externo_loja', 'codigo_externo_vendedor'],
    exemplo: [
      ['1001', '101'],
      ['1001', '102'],
      ['1002', '101'],
    ],
    arquivoModelo: 'modelo-importacao-vinculo-loja-vendedor.csv',
    ajuda: (
      <>
        Uma linha por par loja + vendedor. <strong>Cada loja do arquivo fica exatamente com os vendedores listados</strong>: quem
        não estiver no arquivo sai da carteira daquela loja. Lojas que não aparecem no arquivo não mudam. Importe os
        vendedores antes.
      </>
    ),
    itemSingularPlural: 'vínculo(s)',
    importar: importarCarteira,
    invalidar: ['vendedores', 'pontos-venda'],
  },
  {
    chave: 'rota',
    titulo: 'Rota de visitas',
    resumo: 'Dias de atendimento de cada promotor por loja — vira o planejamento semanal de visitas.',
    permissao: 'ordens_servico.gerenciar',
    colunas: ['codigo_externo_loja', 'promotor', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom', 'horario'],
    exemplo: [
      ['1001', 'promotor@exemplo.com.br', '', 'X', '', 'X', 'X', '', '', ''],
      ['1002', 'promotor@exemplo.com.br', 'X', '', '', '', '', '', '', '08:30'],
    ],
    arquivoModelo: 'modelo-importacao-rota-de-visitas.csv',
    promotorDaRota: true,
    introducao: (
      <>
        Cada linha é uma loja já cadastrada e o promotor que a visita; marque com <strong>X</strong> os dias de atendimento.
      </>
    ),
    ajuda: (
      <>
        Promotor pelo e-mail ou pelo código externo do usuário (ou escolha abaixo o promotor da rota, pras linhas sem
        ele). <strong>Cada loja do arquivo fica exatamente com os dias marcados pra aquele promotor</strong>: dia
        desmarcado sai da rota, e linha sem nenhum X tira a loja da rota dele. Outros promotores da loja não mudam. O
        promotor passa a ver a loja no app.
      </>
    ),
    substituir: {
      ajuda:
        'Cada promotor do arquivo fica só com as lojas listadas pra ele: as outras lojas saem da rota dele, a visita de hoje ainda não iniciada nelas é cancelada e a loja some do app dele. Outros promotores e visitas já feitas não mudam.',
    },
    itemSingularPlural: 'dia(s) de visita',
    importar: importarRotaVisitas,
    invalidar: ['agendas-visita', 'ordens-servico', 'pontos-venda'],
  },
];

// Montagem do pivot "Coleta por Formulário" (docs/39-RELATORIO-ANALITICO-PIVOT.md §4) — o backend
// devolve só a lista plana de células; aqui vira matriz conforme a orientação escolhida. Função
// pura (sem React) pra servir igual à tela, ao CSV e ao PDF, e pra ser testável.

export type TipoCampoColeta = 'NUMERO' | 'TEXTO' | 'MOEDA' | 'MULTIPLA_ESCOLHA' | 'BOOLEANO' | 'DATA';

export interface CampoColeta {
  chave: string;
  rotulo: string;
  tipo_campo: TipoCampoColeta;
}

export interface CelulaColeta {
  registro_id: string;
  visita_id: string | null;
  registrado_em: string;
  ponto_venda: { id: string; fantasia: string; rede: string | null } | null;
  promotor: string | null;
  produto: { id: string; descricao: string; codigo_externo: string | null } | null;
  campo: string;
  valor: string;
  valor_numerico: number | null;
}

export interface RelatorioColeta {
  tipo_registro: { id: string; descricao: string };
  periodo: { data_inicio: string; data_fim: string };
  total_registros: number;
  campos: CampoColeta[];
  celulas: CelulaColeta[];
}

export type EixoLinhas = 'loja' | 'produto';
// 'eixo' = Produto → Pergunta (ou Coleta → Pergunta, com linhas por produto); 'pergunta' = inverso.
export type Agrupamento = 'eixo' | 'pergunta';

export interface OpcoesPivot {
  linhas: EixoLinhas;
  agrupar: Agrupamento;
  // Chaves das perguntas que entram na matriz, na ordem do formulário.
  campos: string[];
}

export interface CelulaCabecalho {
  texto: string;
  colunas?: number;
  linhas?: number;
}

export interface CelulaMatriz {
  texto: string;
  numero?: boolean;
}

export interface Matriz {
  cabecalho: CelulaCabecalho[][];
  linhas: CelulaMatriz[][];
  rodape: CelulaMatriz[][];
  // Um rótulo "achatado" por coluna — pra CSV, que não tem cabeçalho em dois níveis.
  rotulosColunas: string[];
  // Quantas colunas à esquerda são de identificação (loja/data/promotor ou produto).
  colunasFixas: number;
}

const SEM_PRODUTO = '__sem_produto__';
export const ESTATISTICAS = ['Quantidade', 'Média', 'Moda', 'Mínimo', 'Máximo'] as const;

export function ehNumerico(campo: CampoColeta): boolean {
  return campo.tipo_campo === 'NUMERO' || campo.tipo_campo === 'MOEDA';
}

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarValor(campo: CampoColeta, valor: number): string {
  return campo.tipo_campo === 'MOEDA' ? moeda.format(valor) : valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

/** Valor que mais se repete (§6); null sem repetição. Empate → o menor. */
export function moda(valores: number[]): number | null {
  const contagem = new Map<number, number>();
  for (const v of valores) {
    const chave = Math.round(v * 100) / 100;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  let melhor: number | null = null;
  let vezes = 1;
  for (const [valor, n] of contagem) {
    if (n > vezes || (n === vezes && n > 1 && melhor !== null && valor < melhor)) {
      melhor = valor;
      vezes = n;
    }
  }
  return melhor;
}

export function estatisticas(valores: number[]): (number | null)[] {
  if (valores.length === 0) return [0, null, null, null, null];
  const soma = valores.reduce((a, b) => a + b, 0);
  return [valores.length, Math.round((soma / valores.length) * 100) / 100, moda(valores), Math.min(...valores), Math.max(...valores)];
}

function textoEstatistica(campo: CampoColeta, indice: number, valor: number | null): string {
  if (valor === null) return '—';
  return indice === 0 ? String(valor) : formatarValor(campo, valor);
}

interface Coleta {
  chave: string;
  loja: string;
  data: string;
  registradoEm: string;
  promotor: string;
}

interface Produto {
  chave: string;
  descricao: string;
}

/**
 * Coleta = visita (a loja num dia), não registro: com granularidade por produto cada registro é
 * UM produto, então linha por registro deixaria uma célula por linha. Duas visitas na mesma loja
 * viram duas coletas (§3, nunca mescla); se a MESMA visita tem dois registros do mesmo produto,
 * o segundo abre outra coleta em vez de sobrescrever o primeiro.
 */
function montarColetas(celulas: CelulaColeta[]): { coletas: Coleta[]; coletaDoRegistro: Map<string, string> } {
  const coletaDoRegistro = new Map<string, string>();
  const produtosPorColeta = new Map<string, Set<string>>();
  const coletas = new Map<string, Coleta>();

  for (const c of celulas) {
    if (coletaDoRegistro.has(c.registro_id)) continue;
    const visita = c.visita_id ?? c.registro_id;
    const produto = c.produto?.id ?? SEM_PRODUTO;

    let n = 0;
    let chave = `${visita}#${n}`;
    while (produtosPorColeta.get(chave)?.has(produto)) {
      n++;
      chave = `${visita}#${n}`;
    }
    if (!produtosPorColeta.has(chave)) produtosPorColeta.set(chave, new Set());
    produtosPorColeta.get(chave)!.add(produto);
    coletaDoRegistro.set(c.registro_id, chave);

    if (!coletas.has(chave)) {
      coletas.set(chave, {
        chave,
        loja: c.ponto_venda?.fantasia ?? '—',
        data: formatarData(c.registrado_em),
        registradoEm: c.registrado_em,
        promotor: c.promotor ?? '—',
      });
    }
  }

  const ordenadas = [...coletas.values()].sort(
    (a, b) => a.loja.localeCompare(b.loja, 'pt-BR') || a.registradoEm.localeCompare(b.registradoEm) || a.chave.localeCompare(b.chave),
  );
  return { coletas: ordenadas, coletaDoRegistro };
}

function montarProdutos(celulas: CelulaColeta[]): Produto[] {
  const produtos = new Map<string, Produto>();
  for (const c of celulas) {
    const chave = c.produto?.id ?? SEM_PRODUTO;
    if (!produtos.has(chave)) produtos.set(chave, { chave, descricao: c.produto?.descricao ?? 'Sem produto' });
  }
  return [...produtos.values()].sort((a, b) => a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

export function montarMatriz(dados: RelatorioColeta, opcoes: OpcoesPivot): Matriz {
  const perguntas = dados.campos.filter((c) => opcoes.campos.includes(c.chave));
  const chavesPerguntas = new Set(perguntas.map((p) => p.chave));
  const celulas = dados.celulas.filter((c) => chavesPerguntas.has(c.campo));

  const { coletas, coletaDoRegistro } = montarColetas(celulas);
  const produtos = montarProdutos(celulas);

  const valores = new Map<string, CelulaColeta>();
  for (const c of celulas) {
    valores.set(`${coletaDoRegistro.get(c.registro_id)}|${c.produto?.id ?? SEM_PRODUTO}|${c.campo}`, c);
  }
  const celula = (coleta: string, produto: string, campo: string) => valores.get(`${coleta}|${produto}|${campo}`);

  const porLoja = opcoes.linhas === 'loja';
  const eixoColunas: { chave: string; rotulo: string }[] = porLoja
    ? produtos.map((p) => ({ chave: p.chave, rotulo: p.descricao }))
    : coletas.map((c) => ({ chave: c.chave, rotulo: `${c.loja} · ${c.data}` }));
  const fixas = porLoja ? ['Loja', 'Data', 'Promotor'] : ['Produto'];

  // Folhas = colunas de dado, na ordem do agrupamento.
  const folhas: { eixo: string; campo: CampoColeta }[] =
    opcoes.agrupar === 'eixo' || perguntas.length === 1
      ? eixoColunas.flatMap((e) => perguntas.map((campo) => ({ eixo: e.chave, campo })))
      : perguntas.flatMap((campo) => eixoColunas.map((e) => ({ eixo: e.chave, campo })));

  const numericas = perguntas.filter(ehNumerico);
  const multiPergunta = perguntas.length > 1;
  const rotuloEixo = new Map(eixoColunas.map((e) => [e.chave, e.rotulo]));

  // Cabeçalho: 1 nível com uma pergunta só; 2 níveis (grupo em cima, folha embaixo) com várias.
  const cabecalho: CelulaCabecalho[][] = [];
  const niveis = multiPergunta ? 2 : 1;
  const topo: CelulaCabecalho[] = fixas.map((texto) => ({ texto, linhas: niveis }));
  const baixo: CelulaCabecalho[] = [];
  if (!multiPergunta) {
    topo.push(...eixoColunas.map((e) => ({ texto: e.rotulo })));
  } else if (opcoes.agrupar === 'eixo') {
    for (const e of eixoColunas) {
      topo.push({ texto: e.rotulo, colunas: perguntas.length });
      baixo.push(...perguntas.map((p) => ({ texto: p.rotulo })));
    }
  } else {
    for (const p of perguntas) {
      topo.push({ texto: p.rotulo, colunas: eixoColunas.length });
      baixo.push(...eixoColunas.map((e) => ({ texto: e.rotulo })));
    }
  }

  // Linhas por produto: estatística vira colunas extras à direita (§6).
  const estatisticaEmColunas = !porLoja && numericas.length > 0;
  if (estatisticaEmColunas) {
    // Mais de uma numérica implica multiPergunta — cabeçalho já tem 2 níveis.
    if (!multiPergunta) {
      topo.push(...ESTATISTICAS.map((texto) => ({ texto })));
    } else {
      for (const p of numericas) {
        topo.push({ texto: `${p.rotulo} (entre coletas)`, colunas: ESTATISTICAS.length });
        baixo.push(...ESTATISTICAS.map((texto) => ({ texto })));
      }
    }
  }
  cabecalho.push(topo);
  if (baixo.length) cabecalho.push(baixo);

  const rotulosColunas = [
    ...fixas,
    ...folhas.map((f) => (multiPergunta ? `${rotuloEixo.get(f.eixo)} — ${f.campo.rotulo}` : (rotuloEixo.get(f.eixo) ?? ''))),
    ...(estatisticaEmColunas ? numericas.flatMap((p) => ESTATISTICAS.map((e) => (numericas.length > 1 || multiPergunta ? `${p.rotulo} — ${e}` : e))) : []),
  ];

  const textoCelula = (c: CelulaColeta | undefined, campo: CampoColeta): CelulaMatriz => {
    if (!c) return { texto: '—' };
    if (ehNumerico(campo) && c.valor_numerico !== null) return { texto: formatarValor(campo, c.valor_numerico), numero: true };
    return { texto: c.valor };
  };

  const linhas: CelulaMatriz[][] = [];
  const rodape: CelulaMatriz[][] = [];

  if (porLoja) {
    for (const coleta of coletas) {
      linhas.push([
        { texto: coleta.loja },
        { texto: coleta.data },
        { texto: coleta.promotor },
        ...folhas.map((f) => textoCelula(celula(coleta.chave, f.eixo, f.campo.chave), f.campo)),
      ]);
    }
    // Rodapé: uma linha por estatística, célula por coluna (produto × pergunta numérica).
    if (numericas.length > 0 && coletas.length > 0) {
      const stats = folhas.map((f) =>
        ehNumerico(f.campo)
          ? estatisticas(
              coletas
                .map((c) => celula(c.chave, f.eixo, f.campo.chave)?.valor_numerico)
                .filter((v): v is number => v !== null && v !== undefined),
            )
          : null,
      );
      ESTATISTICAS.forEach((nome, i) => {
        rodape.push([
          { texto: nome },
          { texto: '' },
          { texto: '' },
          ...folhas.map((f, j) => {
            const s = stats[j];
            return s ? { texto: textoEstatistica(f.campo, i, s[i]), numero: true } : { texto: '' };
          }),
        ]);
      });
    }
  } else {
    for (const produto of produtos) {
      const linha: CelulaMatriz[] = [
        { texto: produto.descricao },
        ...folhas.map((f) => textoCelula(celula(f.eixo, produto.chave, f.campo.chave), f.campo)),
      ];
      if (estatisticaEmColunas) {
        for (const p of numericas) {
          const s = estatisticas(
            coletas
              .map((c) => celula(c.chave, produto.chave, p.chave)?.valor_numerico)
              .filter((v): v is number => v !== null && v !== undefined),
          );
          linha.push(...s.map((v, i) => ({ texto: textoEstatistica(p, i, v), numero: true })));
        }
      }
      linhas.push(linha);
    }
  }

  return { cabecalho, linhas, rodape, rotulosColunas, colunasFixas: fixas.length };
}

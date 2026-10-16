import type { QuandoAparece, SobreOQue } from './modelo';

// Textos das opções do editor de Formulário (protótipo "Formulário — revisão de UX") — num arquivo
// só de dados pra os componentes (Secoes.tsx, a página) importarem sem quebrar o fast refresh.

export const OPCOES_QUANDO: Record<QuandoAparece, { titulo: string; sub: string }> = {
  LIVRE: { titulo: 'Quando o promotor quiser', sub: 'Fica no menu "Registro geral", em qualquer loja.' },
  SO_CAMPANHAS: { titulo: 'Só dentro de campanhas', sub: 'Não aparece sozinho — entra como parte do formulário de uma campanha.' },
  SEMPRE: { titulo: 'Em toda visita', sub: 'Qualquer loja visitada.' },
  LOJA_REDE: { titulo: 'Em lojas ou redes específicas', sub: 'Só nas lojas escolhidas abaixo.' },
  LINHA_AUSENTE: {
    titulo: 'Onde a linha não está no Mix',
    sub: 'Levantamento de concorrência: aparece sozinho nas lojas sem a linha e some quando ela entra.',
  },
  CAMPANHA: { titulo: 'Numa campanha', sub: 'Só nas visitas ligadas à campanha escolhida.' },
  CONTRATO: { titulo: 'Em loja com contrato ativo', sub: 'Comodato de expositor, ponto extra etc.' },
};

export function rotuloQuando(q: QuandoAparece) {
  return OPCOES_QUANDO[q];
}

export const OPCOES_SOBRE: Record<SobreOQue, { titulo: string; sub: string }> = {
  VISITA: { titulo: 'A visita toda', sub: 'Sem produto. Ex.: foto da fachada.' },
  PRODUTO: { titulo: 'Cada produto', sub: 'Uma resposta por item. Ex.: preço de cada um.' },
  LINHA: { titulo: 'Cada seção / linha', sub: 'Uma resposta cobre a gôndola. Ex.: "seção organizada?"' },
  PROMOTOR_DECIDE: { titulo: 'O promotor decide', sub: 'Ele escolhe na hora se liga a produto ou seção.' },
  PROMOTOR_ESCOLHE_RECORTE: {
    titulo: 'Onde é o registro? — o promotor escolhe',
    sub: 'Departamento, seção ou marca. Opcional: filtrar a marca depois da seção.',
  },
};

// Caixinhas da opção "o promotor escolhe" (docs/79 decisão 1).
export const RECORTES_ESCOLHIVEIS: { nome: 'escolhe_marca' | 'escolhe_departamento' | 'escolhe_secao'; rotulo: string }[] = [
  { nome: 'escolhe_marca', rotulo: 'Pode escolher a marca inteira' },
  { nome: 'escolhe_departamento', rotulo: 'Pode escolher departamento' },
  { nome: 'escolhe_secao', rotulo: 'Pode escolher seção' },
];

// docs/82 §5.1 — "Lista mostrada" na tela "Onde é este registro?".
export const LISTAS_RECORTE: { valor: 'PRIMEIRO_DA_LOJA' | 'SO_DA_LOJA'; rotulo: string; ajuda: string }[] = [
  { valor: 'PRIMEIRO_DA_LOJA', rotulo: 'Primeiro o que a loja tem', ajuda: 'O que está no Mix aparece no topo; o resto fica abaixo, com busca.' },
  { valor: 'SO_DA_LOJA', rotulo: 'Só o que a loja tem', ajuda: 'Só o que está no Mix. Loja sem Mix cadastrado libera a lista inteira.' },
];

export function rotuloSobre(s: SobreOQue) {
  return OPCOES_SOBRE[s];
}

export const OPCOES_AVANCADAS: { nome: 'eh_ruptura' | 'eh_alerta' | 'usa_pontuacao'; titulo: string; sub: string; curto: string }[] = [
  {
    nome: 'eh_ruptura',
    titulo: 'Esta é a pergunta de Ruptura',
    sub: 'Produto marcado aqui como em falta some das outras perguntas da grade de coleta.',
    curto: 'ruptura',
  },
  {
    nome: 'eh_alerta',
    titulo: 'Avisar no Painel de Atividades',
    sub: 'Cada resposta aparece em destaque para o supervisor agir rápido (ruptura, avaria, validade).',
    curto: 'alerta no painel',
  },
  {
    nome: 'usa_pontuacao',
    titulo: 'Calcular nota de compliance (%)',
    sub: 'Dá uma nota de 0 a 100% com base nas perguntas Sim/Não e nos checklists de produtos.',
    curto: 'nota de compliance',
  },
];

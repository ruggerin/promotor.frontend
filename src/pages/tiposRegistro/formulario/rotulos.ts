import type { QuandoAparece, SobreOQue } from './modelo';

// Textos das opções do editor de Formulário (protótipo "Formulário — revisão de UX") — num arquivo
// só de dados pra os componentes (Secoes.tsx, a página) importarem sem quebrar o fast refresh.

export const OPCOES_QUANDO: Record<QuandoAparece, { titulo: string; sub: string }> = {
  LIVRE: { titulo: 'Quando o promotor quiser', sub: 'Fica no menu "Registro geral", em qualquer loja.' },
  SO_CAMPANHAS: { titulo: 'Só dentro de campanhas', sub: 'Não aparece sozinho — entra como parte do formulário de uma campanha.' },
  SEMPRE: { titulo: 'Em toda visita', sub: 'Qualquer loja visitada.' },
  LOJA_REDE: { titulo: 'Em lojas ou redes específicas', sub: 'Só nas lojas escolhidas abaixo.' },
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
};

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

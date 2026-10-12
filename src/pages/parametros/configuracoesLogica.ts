import type { AlteracaoConfiguracao, ItemConfiguracao } from '../../lib/api/parametros';

// Lógica pura da tela de Configurações (docs/62): o que está pendente, o que é inválido e o que
// vai pro PUT /parametros/lote. Fica fora do componente pra ser testada sem renderizar.

/** Edição pendente de um item; `semLimite` só existe pra CHECKIN_RAIO_METROS (ativo_significa). */
export interface Edicao {
  valor: string;
  semLimite: boolean;
}

export function edicaoDoServidor(item: ItemConfiguracao): Edicao {
  return { valor: item.valor, semLimite: item.ativo_significa === 'sem_limite' && !item.ativo };
}

export function edicaoPadrao(item: ItemConfiguracao): Edicao {
  return { valor: item.padrao, semLimite: false };
}

export function iguais(a: Edicao, b: Edicao): boolean {
  return a.semLimite === b.semLimite && (a.semLimite || a.valor === b.valor);
}

/** Mensagem de erro de validação (espelha o servidor, que é quem manda), ou null. */
export function erroDaEdicao(item: ItemConfiguracao, edicao: Edicao): string | null {
  if (item.tipo === 'numero_ou_sem_limite' && edicao.semLimite) return null;
  const v = edicao.valor.trim();

  switch (item.tipo) {
    case 'bool':
      return v === 'true' || v === 'false' ? null : 'Escolha ligado ou desligado.';
    case 'hora':
      return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : 'Informe a hora.';
    case 'lista':
      return item.opcoes?.some((o) => o.valor === v) ? null : 'Escolha uma opção.';
    default: {
      if (item.tipo === 'numero_ou_zero' && v === '0') return null;
      if (!/^\d+$/.test(v)) return 'Informe um número inteiro.';
      const n = Number(v);
      const min = item.min ?? 0;
      const max = item.max ?? Number.MAX_SAFE_INTEGER;
      return n < min || n > max ? `Use um valor de ${min} a ${max}${item.unidade ? ` ${item.unidade}` : ''}.` : null;
    }
  }
}

/** Opção ligada? (bool true, número > 0) — base de `depende_de`. */
export function estaLigado(item: ItemConfiguracao, edicao: Edicao): boolean {
  if (item.tipo === 'bool') return edicao.valor === 'true';
  if (item.tipo === 'numero_ou_sem_limite' && edicao.semLimite) return true;
  return Number(edicao.valor) > 0;
}

export function paraAlteracao(item: ItemConfiguracao, edicao: Edicao): AlteracaoConfiguracao {
  if (item.tipo === 'numero_ou_sem_limite' && edicao.semLimite) return { chave: item.chave, ativo: false };
  return { chave: item.chave, valor: edicao.valor.trim() };
}

/** Texto do "Padrão: …" ao lado do controle. */
export function textoDoValor(item: ItemConfiguracao, valor: string): string {
  switch (item.tipo) {
    case 'bool':
      return valor === 'true' ? 'Ligado' : 'Desligado';
    case 'lista':
      return item.opcoes?.find((o) => o.valor === valor)?.rotulo.split(' — ')[0] ?? valor;
    case 'numero_ou_zero':
      return valor === '0' ? 'Desligado' : `${valor}${item.unidade ? ` ${item.unidade}` : ''}`;
    case 'hora':
      return valor;
    default:
      return `${valor}${item.unidade ? ` ${item.unidade}` : ''}`;
  }
}

/** Sem acento e minúsculo, pra busca. */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

export function casaComBusca(item: ItemConfiguracao, areaRotulo: string, busca: string): boolean {
  const q = normalizar(busca.trim());
  if (!q) return true;
  return normalizar(`${item.rotulo} ${item.ajuda} ${item.chave} ${areaRotulo}`).includes(q);
}

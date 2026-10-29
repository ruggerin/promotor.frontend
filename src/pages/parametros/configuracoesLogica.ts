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

/**
 * Combinações do checkout que não fazem sentido (docs/92 §8). `valor(chave)` devolve o valor em
 * edição (ou o salvo); `null` quando a chave não existe na tela. As dependências de rastreamento já
 * travam pelo `depende_de` do catálogo, aqui ficam só as que comparam dois valores.
 */
export function avisoCombinacaoCheckout(chave: string, valor: (chave: string) => string | null): string | null {
  const numero = (c: string) => Number(valor(c) ?? 0) || 0;
  const raio = numero('CHECKOUT_RAIO_METROS');

  if (chave === 'CHECKOUT_RAIO_METROS') {
    const afastamento = numero('RASTREAMENTO_AFASTAMENTO_METROS');
    return raio > 0 && afastamento > 0 && raio > afastamento
      ? `Maior que a distância de afastamento do rastreamento (${afastamento} m): a saída é detectada antes de o promotor sair do raio, e o checkout pela saída não conta como dentro do raio.`
      : null;
  }
  if (chave === 'CHECKOUT_FORA_DO_RAIO') {
    return raio > 0 && valor('CHECKOUT_FORA_DO_RAIO') === 'BLOQUEIA' && valor('CHECKOUT_SUGERIR_SAIDA') !== 'true'
      ? 'Sem "sugerir a saída", quem esquecer o checkout e já estiver longe vai ter que voltar à loja ou pedir ao gestor.'
      : null;
  }
  if (chave === 'CHECKOUT_AUTOMATICO_MINUTOS') {
    const automatico = numero('CHECKOUT_AUTOMATICO_MINUTOS');
    const aviso = numero('CHECKOUT_AVISO_SAIDA_MINUTOS');
    return automatico > 0 && aviso > 0 && automatico <= aviso
      ? `Fecha a visita antes (ou junto) do aviso por push (${aviso} min): o promotor não chega a ser avisado.`
      : null;
  }
  return null;
}

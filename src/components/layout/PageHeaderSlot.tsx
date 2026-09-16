import { createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

// Espaço reservado no header (AppLayout) pra cada página colocar sua descrição/ação — em vez de
// repetir "título + frase explicando a tela" dentro do corpo de cada página, ocupando espaço
// vertical que relatório/tabela/feed poderiam usar. Ver docs/24-TEMA-ADMIN-WEB.md.
//
// Implementado via portal (não Context+state guardando o ReactNode em si): guardar o nó React
// em estado do AppLayout faria ele reexecutar o render a cada mudança, o que por sua vez
// re-renderiza a página (filha do <Outlet/>), gerando um nó novo de novo — loop de renders sem
// necessidade. Um portal não tem esse problema: a página só se re-renderiza no próprio ritmo, e
// o conteúdo simplesmente teleporta pro <div> do header a cada render dela.
export const HeaderSlotContext = createContext<HTMLDivElement | null>(null);

/**
 * Renderiza `conteudo` dentro do espaço do header. Precisa ser incluído em algum ponto do JSX
 * da própria página que chama o hook (o valor de retorno é o portal) — sem AppLayout montado
 * (ex. teste isolado do componente), devolve `null` e a página não perde nada, só não aparece.
 */
export function usePageHeader(conteudo: ReactNode): ReactNode {
  const slot = useContext(HeaderSlotContext);
  if (!slot) return null;
  return createPortal(conteudo, slot);
}

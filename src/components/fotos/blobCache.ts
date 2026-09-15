// Cache de blob URL por endpoint de imagem, compartilhado entre todo `AutenticatedImage` da
// aplicação (Atividades, Galeria de Fotos). Existe pra resolver um problema real de UX: o
// `VirtuosoGrid` desmonta card que sai da área virtualizada (é o ponto todo da virtualização,
// ver docs/23-GALERIA-DE-FOTOS.md §5.3) — sem este cache, cada card que volta a ficar visível
// (rolou pra baixo e voltou) teria que rebaixar a imagem do zero, piscando o esqueleto cinza de
// novo. Com o cache, o mesmo card remonta já com a imagem pronta, sem re-request nem flash.
//
// Tem um teto (LRU) de propósito — cachear sem limite nenhum devolveria exatamente o problema
// que a virtualização existe pra evitar (memória crescendo pra sempre numa sessão de scroll
// longa). `MAX_ENTRADAS` é grande o bastante pra cobrir bem mais que uma tela cheia de fotos
// (rolar um pouco pra cima/baixo nunca refaz o download), mas finito.
const MAX_ENTRADAS = 300;

// Map em JS preserva ordem de inserção — reinserir uma chave ao acessá-la (ver obterDoCache) é
// o que dá o comportamento de "mais recentemente usado" sem precisar de estrutura própria de LRU.
const cache = new Map<string, string>();

// Pedidos ainda em voo — sem isso, N componentes montando pra mesma URL ao mesmo tempo (o
// StrictMode do React já monta/desmonta/remonta 1x em dev só por si, e o VirtuosoGrid faz uma
// passada de medição antes de assentar) cada um vê o cache vazio e dispara o próprio download,
// duplicando a requisição de rede pro mesmo arquivo. Aqui, o segundo (e terceiro, quarto...)
// componente que pedir a mesma URL enquanto o primeiro ainda não voltou só espera a MESMA promise.
const emAndamento = new Map<string, Promise<string>>();

export function obterDoCache(url: string): string | undefined {
  const blobUrl = cache.get(url);
  if (blobUrl !== undefined) {
    cache.delete(url);
    cache.set(url, blobUrl);
  }
  return blobUrl;
}

function guardarNoCache(url: string, blobUrl: string): void {
  if (cache.has(url)) {
    cache.delete(url);
  }
  cache.set(url, blobUrl);

  if (cache.size > MAX_ENTRADAS) {
    const chaveMaisAntiga = cache.keys().next().value;
    if (chaveMaisAntiga !== undefined) {
      const blobMaisAntigo = cache.get(chaveMaisAntiga);
      cache.delete(chaveMaisAntiga);
      if (blobMaisAntigo) URL.revokeObjectURL(blobMaisAntigo);
    }
  }
}

/**
 * Busca a blob URL de `url`, reaproveitando cache e deduplicando requisições concorrentes pra
 * mesma URL. `buscar` só é chamado de fato quando não há nem cache nem requisição já em voo.
 */
export function buscarBlobComCache(url: string, buscar: () => Promise<Blob>): Promise<string> {
  const cacheado = obterDoCache(url);
  if (cacheado !== undefined) return Promise.resolve(cacheado);

  const jaEmAndamento = emAndamento.get(url);
  if (jaEmAndamento) return jaEmAndamento;

  const promise = buscar()
    .then((blob) => {
      const objectUrl = URL.createObjectURL(blob);
      guardarNoCache(url, objectUrl);
      return objectUrl;
    })
    .finally(() => {
      emAndamento.delete(url);
    });

  emAndamento.set(url, promise);
  return promise;
}

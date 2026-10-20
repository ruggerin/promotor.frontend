import { apiClient } from './api/client';

// Cache das fotos de perfil (UsuarioAvatar). Sem ele, cada avatar baixava a foto ao montar e
// descartava ao desmontar: em lista que rola (Painel de Atividades, Operação do Dia, Régua de XP)
// ou que atualiza sozinha, a foto aparecia, sumia e carregava de novo.
//
// Duas camadas:
// 1. Memória — o mesmo avatar remonta já com a foto, sem request nem pisca. Pedidos simultâneos
//    pra mesma URL esperam a mesma promise.
// 2. Cache Storage do navegador — sobrevive a recarregar a página. A URL da API já traz a versão
//    da foto (`?v=<updated_at>`): foto trocada é URL nova, então o cache nunca mostra foto velha.
//
// Separado do blobCache da galeria de propósito: aquele tem teto de 300 e seria esvaziado por
// quem rola fotos, levando os avatares junto.

const NOME_CACHE = 'horus-avatares-v1';
const MAX_EM_MEMORIA = 500;

const memoria = new Map<string, string>();
const emAndamento = new Map<string, Promise<string | null>>();

/** Blob URL já pronta (síncrono) — usado como estado inicial do avatar. */
export function avatarEmCache(url: string | null | undefined): string | undefined {
  return url ? memoria.get(url) : undefined;
}

function guardar(url: string, blobUrl: string): void {
  memoria.set(url, blobUrl);
  if (memoria.size > MAX_EM_MEMORIA) {
    const maisAntiga = memoria.keys().next().value;
    if (maisAntiga !== undefined) {
      URL.revokeObjectURL(memoria.get(maisAntiga)!);
      memoria.delete(maisAntiga);
    }
  }
}

async function lerPersistido(url: string): Promise<Blob | null> {
  try {
    if (typeof caches === 'undefined') return null;
    const resposta = await (await caches.open(NOME_CACHE)).match(url);
    return resposta ? await resposta.blob() : null;
  } catch {
    return null;
  }
}

async function persistir(url: string, blob: Blob): Promise<void> {
  try {
    if (typeof caches === 'undefined') return;
    await (await caches.open(NOME_CACHE)).put(url, new Response(blob, { headers: { 'Content-Type': blob.type || 'image/jpeg' } }));
  } catch {
    // Sem Cache Storage (contexto não seguro, cota cheia) — segue só com a memória.
  }
}

/** Blob URL da foto: memória → Cache Storage → API. `null` quando não deu (cai pras iniciais). */
export function carregarAvatar(url: string): Promise<string | null> {
  const pronta = memoria.get(url);
  if (pronta) return Promise.resolve(pronta);
  const voando = emAndamento.get(url);
  if (voando) return voando;

  const promessa = (async () => {
    let blob = await lerPersistido(url);
    if (!blob) {
      const resposta = await apiClient.get<Blob>(url, { responseType: 'blob' });
      blob = resposta.data;
      void persistir(url, blob);
    }
    const blobUrl = URL.createObjectURL(blob);
    guardar(url, blobUrl);
    return blobUrl;
  })()
    .catch(() => null)
    .finally(() => emAndamento.delete(url));

  emAndamento.set(url, promessa);
  return promessa;
}

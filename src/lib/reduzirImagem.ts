// Reduz a foto do produto no navegador antes de enviar (docs/89 §6): lado maior até 1200 px, JPEG
// qualidade 0,85 (PNG/WEBP com transparência continuam PNG). Feito aqui porque o servidor não tem GD.
// Foto de celular de 6 MB vira algumas centenas de KB — menos storage, envio mais rápido e app mais
// leve no 4G. Mantém o nome original (só troca a extensão se o formato mudou), porque na importação
// em massa o nome é o código do produto.

const LADO_MAXIMO = 1200;
const QUALIDADE_JPEG = 0.85;

function carregar(arquivo: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Imagem inválida'));
    };
    img.src = url;
  });
}

function temTransparencia(ctx: CanvasRenderingContext2D, largura: number, altura: number): boolean {
  const { data } = ctx.getImageData(0, 0, largura, altura);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

function trocarExtensao(nome: string, extensao: string): string {
  const ponto = nome.lastIndexOf('.');
  return `${ponto === -1 ? nome : nome.slice(0, ponto)}.${extensao}`;
}

/** Devolve o próprio arquivo se já é pequeno o bastante, ou se não deu pra decodificar. */
export async function reduzirImagem(arquivo: File): Promise<File> {
  let img: HTMLImageElement;
  try {
    img = await carregar(arquivo);
  } catch {
    return arquivo; // o backend recusa com a mensagem certa
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
  // Já pequena (em pixels e em bytes): não recomprime à toa.
  if (escala === 1 && arquivo.size <= 500 * 1024) return arquivo;

  const largura = Math.round(img.naturalWidth * escala);
  const altura = Math.round(img.naturalHeight * escala);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  if (!ctx) return arquivo;
  ctx.drawImage(img, 0, 0, largura, altura);

  const png = arquivo.type !== 'image/jpeg' && temTransparencia(ctx, largura, altura);
  const tipo = png ? 'image/png' : 'image/jpeg';
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, QUALIDADE_JPEG));
  if (!blob || blob.size >= arquivo.size) return arquivo;

  const nome = tipo === arquivo.type ? arquivo.name : trocarExtensao(arquivo.name, png ? 'png' : 'jpg');
  return new File([blob], nome, { type: tipo });
}

import type { VisitaRegistro } from '../../types/api';

// Um registro pode ter várias fotos (ver docs/21-EVIDENCIA-EM-FOTOS.md) — mosaico e galeria
// trabalham em cima de 1 entrada por FOTO, não por registro, carregando de volta o registro
// dono pra continuar mostrando tipo/vínculo/observação junto da imagem. Compartilhado entre
// AtividadesPage e GaleriaFotosPage — as duas telas exibem a mesma coisa (fotos de
// VisitaRegistro), só com fontes/filtros diferentes.
export interface FotoComRegistro {
  registro: VisitaRegistro;
  imagem: { id: string; url: string };
}

export function achatarFotos(registros: VisitaRegistro[]): FotoComRegistro[] {
  return registros.flatMap((registro) => registro.imagens.map((imagem) => ({ registro, imagem })));
}

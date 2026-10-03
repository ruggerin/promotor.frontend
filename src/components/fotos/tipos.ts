import type { VisitaRegistro } from '../../types/api';

// Um registro pode ter várias fotos (ver docs/21-EVIDENCIA-EM-FOTOS.md) — mosaico e galeria
// trabalham em cima de 1 entrada por FOTO, não por registro, carregando de volta o registro
// dono pra continuar mostrando tipo/vínculo/observação junto da imagem. Compartilhado entre
// AtividadesPage e GaleriaFotosPage — as duas telas exibem a mesma coisa (fotos de
// VisitaRegistro), só com fontes/filtros diferentes.
//
// `usuario` é opcional — quem registrou o card (só a Galeria de Fotos tem esse dado prontinho
// por foto, ver FotoGaleria; no Atividades já aparece no cabeçalho do card, então o `GaleriaDialog`
// só mostra a linha "Por Fulano" quando ele vem preenchido, sem quebrar o outro consumidor).
export interface FotoComRegistro {
  registro: VisitaRegistro;
  imagem: { id: string; url: string };
  usuario?: { id: string; nome: string; foto_url: string | null };
}

export function achatarFotos(registros: VisitaRegistro[]): FotoComRegistro[] {
  return registros.flatMap((registro) => registro.imagens.map((imagem) => ({ registro, imagem })));
}

// Texto alternativo da foto (leitor de tela), montado com o que o registro já traz: tipo e
// produto/seção/marca vinculados — ex.: "Foto — Ruptura — Detergente Clear 500ml".
export function descricaoDaFoto({ registro }: FotoComRegistro): string {
  const vinculo = registro.produto_auditoria?.descricao ?? registro.secao?.descricao ?? registro.marca?.descricao ?? registro.departamento?.descricao;
  return ['Foto', registro.tipo_registro.descricao, vinculo].filter(Boolean).join(' — ');
}

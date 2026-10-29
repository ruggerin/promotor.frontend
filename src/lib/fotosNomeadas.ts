import type { FotoRegistro, VisitaRegistro } from '../types/api';

// Fotos nomeadas (docs/98): agrupa as fotos do registro pela pergunta FOTO que respondem, na
// ordem do formulário ("Antes", "Depois"...). Foto sem pergunta fica em "Outras fotos".

export interface GrupoFotos {
  chave: string;
  rotulo: string;
  fotos: FotoRegistro[];
}

export function agruparFotos(registro: Pick<VisitaRegistro, 'imagens' | 'perguntas_foto'>): { grupos: GrupoFotos[]; livres: FotoRegistro[] } {
  const perguntas = registro.perguntas_foto ?? [];
  const grupos: GrupoFotos[] = perguntas.map((p) => ({ chave: p.chave, rotulo: p.rotulo, fotos: [] }));
  const livres: FotoRegistro[] = [];

  for (const foto of registro.imagens) {
    if (!foto.campo_chave) {
      livres.push(foto);
      continue;
    }
    let grupo = grupos.find((g) => g.chave === foto.campo_chave);
    // Pergunta apagada do formulário depois (ou campos não carregados): mostra pela chave.
    if (!grupo) {
      grupo = { chave: foto.campo_chave, rotulo: foto.campo_chave, fotos: [] };
      grupos.push(grupo);
    }
    grupo.fotos.push(foto);
  }

  return { grupos: grupos.filter((g) => g.fotos.length > 0), livres };
}

/** "Tirada às 09:12 · reaproveitada desta visita" — o rodapé de cada foto. */
export function legendaFoto(foto: FotoRegistro): string {
  const partes: string[] = [];
  if (foto.capturada_em) {
    const d = new Date(foto.capturada_em);
    partes.push(
      foto.origem === 'HISTORICO'
        ? `Tirada em ${d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
        : `Tirada às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    );
  }
  if (foto.origem === 'VISITA') partes.push('reaproveitada desta visita');
  if (foto.origem === 'HISTORICO') partes.push('de uma visita anterior');
  return partes.join(' · ');
}

/** Distância só quando a foto foi tirada longe da loja (acima de `raio` metros). */
export function textoDistancia(metros: number | null | undefined): string | null {
  if (metros === null || metros === undefined) return null;
  return metros < 1000 ? `${metros} m da loja` : `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km da loja`;
}

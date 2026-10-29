// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { areaSlugs } from "@/lib/areas";

// As capas dos cadernos: as cores do cartaz e as dos panos (anil, turquesa, rosa, laranja, roxo do ipê, barro), escurecidas
// até o creme das letras ter contraste de leitura (4,5:1) em todas, sem dois tons quase iguais. Cada disciplina tem a sua,
// com passo 5 sobre 13 cores, para vizinhas na estante quase nunca repetirem.
export const CAPAS = ["#6e1f1a", "#23408e", "#2f5d34", "#a6491a", "#1f1a14", "#b5375e", "#166e6a", "#8a5f1c", "#c21f16", "#5b3a8c", "#23485c", "#7a4a2a", "#6b3b5a"];
const COR_DA_AREA = new Map<string, string>(areaSlugs.map((slug, i) => [slug, CAPAS[(i * 5) % CAPAS.length]]));

/** A cor da capa de uma disciplina: a mesma nas estantes, na página da disciplina e no celular. */
export function corDaCapa(slug: string): string {
  return COR_DA_AREA.get(slug) ?? CAPAS[[...slug].reduce((soma, letra) => soma + letra.charCodeAt(0), 0) % CAPAS.length];
}

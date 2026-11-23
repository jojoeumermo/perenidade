// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As pessoas do Memorial que entram na parede que gira da entrada da Alumia (P5, A1; a parte pura está em rotacao.ts). Só quem tem
// foto guardada no próprio site (/imagens/memorial), com autor, fonte e licença livre (domínio público, CC0, CC BY, CC BY-SA): a
// mesma foto e o mesmo crédito da página do Memorial. Todas as pessoas do Memorial já morreram (a ficha exige a data); nenhuma
// pessoa viva entra por aqui. Só no servidor (lê os arquivos de content/memorial).
import { getTributes } from "@/lib/content";
import type { FiguraDaEntrada } from "./figuras";
import { licencaLivre } from "./rotacao";

export function figurasDoMemorial(): FiguraDaEntrada[] {
  return getTributes("pt")
    .filter((p) => p.photo && p.photoSource && p.photoAuthor && licencaLivre(p.photoLicense) && p.died)
    .map((p) => ({
      id: `memorial-${p.slug}`,
      nome: p.name,
      src: p.photo!.replace(/^\//, ""),
      credito: { autor: p.photoAuthor!, licenca: p.photoLicense!, licencaUrl: p.photoLicenseUrl ?? null, fonte: p.photoSource!, derivada: p.photoCredit ?? "" },
    }));
}

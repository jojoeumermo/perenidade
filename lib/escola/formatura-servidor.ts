// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Do lado do servidor (páginas da formatura): os cursos da Escola no formato que as telas recebem por props. Usa só
// carregarCursos() e minutosDaAula, que já existem; nenhum fs novo aqui.

import { carregarCursos, minutosDaAula } from "./cursos-servidor";
import { patronoDo } from "./cursos-vista";
import { aulasDoCurso } from "./cursos";
import type { CursoParaFormatura } from "./formatura";

export function cursosParaFormatura(): CursoParaFormatura[] {
  return carregarCursos().map((c) => {
    const aulas = aulasDoCurso(c);
    return {
      slug: c.slug,
      titulo: c.titulo,
      aulas,
      minutos: aulas.map((a) => minutosDaAula(a)),
      projetoFinal: c.projetoFinal,
      sensivel: Boolean(c.sensivel),
      patrono: patronoDo(c)?.nome ?? null,
    };
  });
}

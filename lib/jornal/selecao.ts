// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quais matérias do Jornal aparecem onde. Recebe a lista já em ordem (a mais nova primeiro, como getArticles devolve) e
// não lê arquivo nenhum, para o teste (scripts/testar-jornal.mjs) conferir sem montar o site.

interface Item {
  slug: string;
  featured: boolean;
}

/** A matéria que /jornal abre inteira: a última publicada. */
export function ultimaMateria<T extends Item>(materias: readonly T[]): T | undefined {
  return materias[0];
}

/** "Leia também": as `quantas` mais recentes que não são a matéria aberta. */
export function leiaTambem<T extends Item>(materias: readonly T[], atual: string, quantas = 3): T[] {
  return materias.filter((m) => m.slug !== atual).slice(0, quantas);
}

/** A matéria em destaque fixo ("destaque: true"): a mais nova delas, se houver mais de uma. */
export function materiaEmDestaque<T extends Item>(materias: readonly T[]): T | undefined {
  return materias.find((m) => m.featured);
}

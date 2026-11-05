// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
// A escolha da "aula do dia" (components/app/AulaDoDia.tsx). Pura: sem React, sem disco, testada em scripts/testar-app-casca.mjs.

export interface AulaSugerida {
  /** Sem o idioma: "/trilhas/<trilha>/<aula>". */
  href: string;
  titulo: string;
  trilha: string;
  minutos: number;
}

/** O número do dia no calendário local (dias desde 1970 pelo relógio da pessoa), para a escolha não mudar à meia-noite de outro fuso. */
export const numeroDoDia = (agora: Date): number => Math.floor(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()) / 86_400_000);

/** O id que o site grava em "aulas feitas": "<trilha>/<aula>" (o href sem "/trilhas/"). */
const idDaAula = (aula: AulaSugerida) => aula.href.replace(/^\/trilhas\//, "");

/** A aula do dia: a do índice (dia mod quantidade); se já foi feita, a próxima ainda não feita; se todas foram, a do índice. */
export function escolherAulaDoDia(aulas: readonly AulaSugerida[], agora: Date, feitas: ReadonlySet<string> = new Set()): AulaSugerida | null {
  if (aulas.length === 0) return null;
  const inicio = numeroDoDia(agora) % aulas.length;
  for (let passo = 0; passo < aulas.length; passo++) {
    const aula = aulas[(inicio + passo) % aulas.length];
    if (!feitas.has(idDaAula(aula))) return aula;
  }
  return aulas[inicio];
}

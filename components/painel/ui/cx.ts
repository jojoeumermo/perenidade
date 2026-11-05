// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).

/** Junta classes, pulando as vazias (no lugar de clsx e tailwind-merge: o painel não precisa de mais que isso). */
export function cx(...partes: (string | false | null | undefined | 0)[]): string {
  return partes.filter(Boolean).join(" ");
}

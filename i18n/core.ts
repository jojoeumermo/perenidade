// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Dict } from "./types";

// Só os textos usados em todas as páginas viajam para o navegador. Os de uma página específica
// (comunidade, ferramentas, formulários) chegam como propriedade do componente daquela página,
// para ninguém baixar o que não vai usar.
export const coreSections = ["common", "nav", "areas", "groups", "stages", "tracks", "lesson", "library", "search", "a11y", "notFound", "errors", "radio"] as const;
export type CoreDict = Pick<Dict, (typeof coreSections)[number]>;

export function pickCore(t: Dict): CoreDict {
  return Object.fromEntries(coreSections.map((section) => [section, t[section]])) as CoreDict;
}

/** Mensagem para um código de erro do serviço ("invalido:titulo" vira "Confira o campo: titulo."). */
export function errorText(t: CoreDict, code: string): string {
  const [kind, field] = code.split(":");
  const messages = t.errors as Record<string, string>;
  if (kind === "invalido") return messages.invalido.replace("{campo}", field ?? "");
  return messages[kind] ?? messages.falha;
}

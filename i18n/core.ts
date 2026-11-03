// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Dict } from "./types";

// Só os textos usados em todas as páginas viajam para o navegador. Os de uma página específica
// (comunidade, ferramentas, formulários) chegam como propriedade do componente daquela página,
// para ninguém baixar o que não vai usar.
export const coreSections = ["common", "nav", "areas", "groups", "stages", "tracks", "lesson", "library", "search", "a11y", "notFound", "errors", "radio", "lists", "labs", "blocks", "celular"] as const;
export type CoreSection = (typeof coreSections)[number];
export type CoreDict = Pick<Dict, CoreSection>;

// As seções do núcleo que não vão em toda página: o layout não as manda, e cada rota que tem componente do navegador
// lendo uma delas a acrescenta com um <I18nProvider> aninhado (o texto continua saindo pronto no HTML do servidor).
// "areas" (os nomes e as descrições das disciplinas) é a maior do núcleo e a aula não a usa no navegador.
// Rotas que a acrescentam hoje: acervo, ao-vivo, ao-vivo/sala, comunidade, contribuir, entrar, estantes/[area], gaveta,
// glossario, painel, questoes, reforco, trilhas, videoaulas e voluntarios. Componente novo que lê t.areas pelo
// useI18n precisa da rota nessa lista (em desenvolvimento, o useI18n avisa com o nome da seção que faltou).
export const extraSections = ["areas"] as const satisfies readonly CoreSection[];
export type ExtraSection = (typeof extraSections)[number];
export const baseSections = coreSections.filter((s): s is Exclude<CoreSection, ExtraSection> => !(extraSections as readonly string[]).includes(s));

/** Só as seções pedidas do dicionário, para mandar ao navegador. */
export function pickSections<S extends keyof Dict>(t: Dict, sections: readonly S[]): Pick<Dict, S> {
  return Object.fromEntries(sections.map((section) => [section, t[section]])) as Pick<Dict, S>;
}

/** O núcleo inteiro (todas as seções comuns, inclusive as que o layout deixa para as rotas). */
export function pickCore(t: Dict): CoreDict {
  return pickSections(t, coreSections);
}

/** O que o layout manda em toda página: o núcleo menos as seções extras. */
export function pickBase(t: Dict) {
  return pickSections(t, baseSections);
}

/** Mensagem para um código de erro do serviço ("invalido:titulo" vira "Confira o campo: titulo."). */
export function errorText(t: CoreDict, code: string): string {
  const [kind, field] = code.split(":");
  const messages = t.errors as Record<string, string>;
  if (kind === "invalido") return messages.invalido.replace("{campo}", field ?? "");
  return messages[kind] ?? messages.falha;
}

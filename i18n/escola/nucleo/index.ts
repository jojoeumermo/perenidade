// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos do núcleo da Escola de Formação (F4: tela do núcleo, kit de quem facilita, banca de passagem e o painel da
// coordenação; docs/plano-2026-11/PLANO-ESCOLA.md), nos 6 idiomas. São textos de interface, públicos: nenhum dado de
// militante mora aqui. A página do núcleo importa no servidor e passa a parte de cada componente por propriedade; o
// painel (só para a coordenação, carregado sob demanda) importa os seis porque escolhe o idioma no navegador.

export type TextosDoNucleo = typeof pt;
/** O que a tela do núcleo recebe: sem os textos do painel da coordenação (não vão ao navegador de quem não é dela). */
export type TextosDaTelaDoNucleo = Omit<TextosDoNucleo, "painel">;

export const TEXTOS_DO_NUCLEO = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDoNucleo>;

export function textosDoNucleo(lang: string): TextosDoNucleo {
  return escolher(TEXTOS_DO_NUCLEO, lang);
}

/** Os textos da tela do núcleo, sem os do painel. */
export function textosDaTelaDoNucleo(lang: string): TextosDaTelaDoNucleo {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { painel, ...tela } = textosDoNucleo(lang);
  return tela;
}

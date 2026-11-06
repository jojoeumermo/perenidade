// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da Frente Revolucionária Lúcia na Escola Revolucionária Lúcia Maria (T15, docs/escola-revolucionaria/LEIA-ME.md),
// nos 6 idiomas: o cartaz da entrada, o chamado de voluntários militantes (/escola/militantes) e a moldura do manifesto
// (/escola/manifesto). Só o servidor importa este arquivo; componente de cliente importa daqui só o tipo.

export type TextosDaFrente = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaFrente>;

export function textosDaFrente(lang: string): TextosDaFrente {
  return escolher(TEXTOS, lang);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// F7 da Escola (docs/plano-2026-11/PLANO-ESCOLA.md, prancha Mapa): os textos do que saiu de /escola e voltou ao site
// aberto (os cursos e a vida real), como aparecem na lista do "Mais" e em /explorar (lib/secoes-do-site.ts), nos 6 idiomas.

export type TextosDaReorganizacao = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaReorganizacao>;

export function textosDaReorganizacao(lang: string): TextosDaReorganizacao {
  return escolher(TEXTOS, lang);
}

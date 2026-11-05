// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da página /jogos e dos jogos de treino e infantis, nos 6 idiomas. Só o português é texto final; en, es, fr, ru
// e zh são rascunho até a revisão (docs/jogos/PAGINA.md). Os termos e as definições dos jogos vêm do glossário, que está em
// português, e a página avisa disso. Os jogos de formação (Rumos, Greve!) seguem usando t.labs.jogos.

export type TextosDosJogos = typeof pt;

const TEXTOS: Record<Locale, TextosDosJogos> = { pt, en, es, fr, zh, ru };

export function textosDosJogos(lang: Locale): TextosDosJogos {
  return TEXTOS[lang] ?? pt;
}

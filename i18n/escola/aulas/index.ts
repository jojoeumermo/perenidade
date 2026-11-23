// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos das aulas abertas da Escola (P5, B2: Teoria revolucionária e Lutas do povo em /escola/aulas), nos 6 idiomas. Só o
// servidor importa este arquivo. Traduções para en, es, fr, ru e zh são rascunho [A REVISAR PELA COORDENAÇÃO].

export type TextosDasAulasAbertas = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDasAulasAbertas>;

export function textosDasAulasAbertas(lang: string): TextosDasAulasAbertas {
  return escolher(TEXTOS, lang);
}

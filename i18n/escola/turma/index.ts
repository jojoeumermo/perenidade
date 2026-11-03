// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos das turmas por curso da Escola (Etapa 4, pacote E4-15), nos 6 idiomas. Só o servidor importa este arquivo: a
// página escolhe o idioma e passa a parte de cada componente por props. Componente de cliente importa daqui só o tipo.

export type TextosDaTurma = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<
  string,
  TextosDaTurma
>;

export function textosDaTurma(lang: string): TextosDaTurma {
  return escolher(TEXTOS, lang);
}

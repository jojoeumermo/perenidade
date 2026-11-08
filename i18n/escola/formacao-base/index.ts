// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da Escola de Formação (F1: a porta vermelha, a casca e a tela Hoje; docs/plano-2026-11/PLANO-ESCOLA.md),
// nos 6 idiomas. São textos de interface, públicos: nenhum dado de militante mora aqui. Só o servidor importa este
// arquivo; componente de cliente importa daqui só o tipo e recebe os textos por propriedade.

export type TextosDaFormacaoBase = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaFormacaoBase>;

export function textosDaFormacaoBase(lang: string): TextosDaFormacaoBase {
  return escolher(TEXTOS, lang);
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos das aulas ao vivo da Escola (F3: a sala, o bate-papo, a aula gravada no caderno e a caixa "Só para a
// Escola" do painel), nos 6 idiomas. Só texto de interface, público. As páginas de servidor escolhem o idioma e passam
// por propriedade; o painel (componente de cliente que já carrega os seus dicionários) escolhe aqui pelo idioma dele.

export type TextosDoAoVivo = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDoAoVivo>;

export function textosDoAoVivo(lang: string): TextosDoAoVivo {
  return escolher(TEXTOS, lang);
}

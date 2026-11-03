// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da vida real da Escola (Etapa 4, pacote E4-11), nos 6 idiomas. Só o servidor importa este arquivo: a página
// escolhe o idioma e passa a parte de cada componente por props. Componente de cliente importa daqui só o tipo. O bloco
// "documento" das aulas importa os seis JSON no próprio pedaço que baixa só quando a aula o usa (components/blocos).

export type TextosDaVida = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaVida>;

export function textosDaVida(lang: string): TextosDaVida {
  return escolher(TEXTOS, lang);
}

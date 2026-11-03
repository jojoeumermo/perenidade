// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos do acompanhante do estudante (Etapa 4, E4-10), nos 6 idiomas. Só o servidor importa este arquivo: as
// páginas de /escola/acompanhante escolhem o idioma e passam os textos por props. Os componentes que entram em páginas
// que não são deste pacote (a faixa da aula e o cartão de exercício) baixam só o idioma da página, quando aparecem
// (components/escola/acompanhante/textos.ts). Componente de cliente importa daqui só o tipo.

export type TextosDoAcompanhante = typeof pt;

const TEXTOS: Record<string, TextosDoAcompanhante> = { pt, en, es, fr, zh, ru };

export function textosDoAcompanhante(lang: string): TextosDoAcompanhante {
  return TEXTOS[lang] ?? pt;
}

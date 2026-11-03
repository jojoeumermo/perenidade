// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos do Som do campus (Etapa 4, pacote E4-06: continuar a rádio, som para estudar, Hoje no campus e o cordel da
// aula), nos 6 idiomas. Só o servidor importa este arquivo e passa a parte de cada componente por props. O tocador do
// layout (components/RadioPlayer.tsx) não recebe props: ele pede só o idioma da página com components/radio/textos-do-som.ts.

export type TextosDoSom = typeof pt;

const TEXTOS: Record<string, TextosDoSom> = { pt, en, es, fr, zh, ru };

export function textosDoSom(lang: string): TextosDoSom {
  return TEXTOS[lang] ?? pt;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da leveza e do alcance da aula (Etapa 4, pacote E4-17): convite do modo pacote, Libras, estudar mais leve,
// levar esta aula e medidor, nos 6 idiomas. Só o servidor importa este arquivo: a página escolhe o idioma e passa por
// props. Componente de cliente importa daqui só o tipo (import type). Traduções para en, es, fr, ru e zh são rascunho
// [A REVISAR PELA COORDENAÇÃO].

export type TextosDaLeveza = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaLeveza>;

export function textosDaLeveza(lang: string): TextosDaLeveza {
  return escolher(TEXTOS, lang);
}

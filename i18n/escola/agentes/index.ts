// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos dos agentes de trabalho, turma e equipe da Escola (Etapa 4, pacote E4-16), nos 6 idiomas. Só o servidor
// importa este arquivo: as páginas de /escola/agentes escolhem o idioma e passam a fatia de cada agente por props.
// Componente de cliente importa daqui só o tipo. Os textos escritos para este pacote levam "em revisão".

export type TextosDosAgentes = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDosAgentes>;

export function textosDosAgentes(lang: string): TextosDosAgentes {
  return escolher(TEXTOS, lang);
}

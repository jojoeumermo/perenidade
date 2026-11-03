// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos de interface dos cursos da Escola (Etapa 4, pacote E4-07), nos 6 idiomas. O conteúdo dos cursos (títulos,
// resumos, tarefas) fica em português, em content/escola/cursos. Só o servidor importa este arquivo: a página escolhe o
// idioma e passa a parte de cada componente por props. Componente de cliente importa daqui só o tipo (import type).
// Sem "@/" de propósito: lib/escola/indice.ts usa estes textos e roda no Node nos testes.

export type TextosDosCursos = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDosCursos>;

export function textosDosCursos(lang: string): TextosDosCursos {
  return escolher(TEXTOS, lang);
}

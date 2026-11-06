// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { escolher } from "../../../lib/escola/textos";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos de interface do projeto final, da formatura e da caderneta da Escola (Etapa 4, pacote E4-14;
// docs/escola/formatura.md), nos 6 idiomas. Só o servidor importa este arquivo: a página escolhe o idioma e passa a
// parte de cada componente por props. Componente de cliente importa daqui só o tipo (import type). Sem "@/" de propósito.

export type TextosDaFormatura = typeof pt;

const TEXTOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaFormatura>;

export function textosDaFormatura(lang: string): TextosDaFormatura {
  return escolher(TEXTOS, lang);
}

/** Os textos do aviso de matrícula ("comum"): as páginas de fora da formatura passam só este pedaço ao ConviteDeMatricula. */
export type TextosDoAvisoDeMatricula = Pick<
  TextosDaFormatura["comum"],
  "semMatriculaTitulo" | "semMatriculaTexto" | "rotuloOQueE" | "semMatriculaOQueE" | "rotuloOQueDa" | "semMatriculaOQueDa" | "rotuloOQuePede" | "semMatriculaOQuePede" | "matricular"
>;

/**
 * O pedaço do aviso, tirado dos textos da formatura (páginas da carteirinha e do plano). Mora aqui, e não no
 * ConviteDeMatricula, porque aquele arquivo é "use client": a página de servidor não pode chamar função dele (o build
 * de produção para em "Attempted to call avisoDeMatricula() from the server").
 */
export const avisoDeMatricula = (c: TextosDaFormatura["comum"]): TextosDoAvisoDeMatricula => ({
  semMatriculaTitulo: c.semMatriculaTitulo,
  semMatriculaTexto: c.semMatriculaTexto,
  rotuloOQueE: c.rotuloOQueE,
  semMatriculaOQueE: c.semMatriculaOQueE,
  rotuloOQueDa: c.rotuloOQueDa,
  semMatriculaOQueDa: c.semMatriculaOQueDa,
  rotuloOQuePede: c.rotuloOQuePede,
  semMatriculaOQuePede: c.semMatriculaOQuePede,
  matricular: c.matricular,
});

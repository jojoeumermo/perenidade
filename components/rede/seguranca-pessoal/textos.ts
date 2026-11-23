// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da segurança pessoal (Prompt 4, itens 10 a 12): i18n/rede/seguranca-pessoal/{pt,en,es,fr,ru,zh}.json (pt é o texto
// final; os outros têm "_rascunho" até a revisão e, até lá, a tela fica em português). Um idioma por vez, por import dinâmico; o hook fica em usarTextos.ts.
import type pt from "../../../i18n/rede/seguranca-pessoal/pt.json";
import { prontoOu } from "../../../lib/rede/textos-prontos";

export type TextosDaSegurancaPessoal = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDaSegurancaPessoal(lang: string): Promise<TextosDaSegurancaPessoal> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  try {
    return prontoOu(((await import(`../../../i18n/rede/seguranca-pessoal/${l}.json`)) as { default: TextosDaSegurancaPessoal }).default, async () => ((await import("../../../i18n/rede/seguranca-pessoal/pt.json")) as { default: TextosDaSegurancaPessoal }).default);
  } catch {
    return ((await import("../../../i18n/rede/seguranca-pessoal/pt.json")) as { default: TextosDaSegurancaPessoal }).default;
  }
}

/** Troca {chave} pelo valor (texto ou número). */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** Uma data "AAAA-MM-DD" (lida como dia, sem fuso) no idioma da página: "15 de jan." */
export function diaNoIdioma(lang: string, dia: string | null | undefined): string {
  if (!dia) return "";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dia) ? new Date(`${dia}T12:00:00`) : new Date(dia);
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { day: "numeric", month: "short" }).format(d);
  } catch {
    return dia.slice(0, 10);
  }
}

/** O texto de um erro: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function textoDoErro(erros: Record<string, string>, erro: unknown): string {
  const codigo = erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string"
    ? (erro as { code: string }).code
    : erro instanceof Error ? erro.message : String(erro ?? "");
  return erros[codigo] ?? erros[codigo.split(":")[0]] ?? erros.generico;
}

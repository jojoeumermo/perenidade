// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do "Perto" (Prompt 4, lote perto: itens 2, 7, 8, 22, 23, 24 e 25): i18n/rede/p4-perto/{pt,en,es,fr,ru,zh}.json (pt é o
// texto final; os outros têm "_rascunho" até a revisão e, até lá, a tela fica em português). Um idioma por vez, por import dinâmico.
import type pt from "../../../i18n/rede/p4-perto/pt.json";
import { prontoOu } from "../../../lib/rede/textos-prontos";

export type TextosDoPerto = typeof pt;

const IDIOMAS = ["pt", "en", "es", "fr", "ru", "zh"] as const;

export async function carregarTextosDoPerto(lang: string): Promise<TextosDoPerto> {
  const l = (IDIOMAS as readonly string[]).includes(lang) ? lang : "pt";
  const portugues = async () => ((await import("../../../i18n/rede/p4-perto/pt.json")) as { default: TextosDoPerto }).default;
  try {
    return prontoOu(((await import(`../../../i18n/rede/p4-perto/${l}.json`)) as { default: TextosDoPerto }).default, portugues);
  } catch {
    return portugues();
  }
}

/** Troca {chave} pelo valor. */
export function por(texto: string, valores: Record<string, string | number>): string {
  return texto.replace(/\{(\w+)\}/g, (inteiro, chave: string) => (chave in valores ? String(valores[chave]) : inteiro));
}

/** O texto de um erro: o código inteiro, depois o prefixo antes de ":", depois o genérico. */
export function textoDoErro(erros: Record<string, string>, erro: unknown): string {
  const bruto = erro && typeof erro === "object" && "code" in erro && typeof (erro as { code: unknown }).code === "string" ? (erro as { code: string }).code : erro instanceof Error ? erro.message : String(erro ?? "");
  return erros[bruto] ?? erros[bruto.split(":")[0]] ?? erros.generico;
}

/** "12:40" no idioma da página. */
export function horaNoIdioma(lang: string, ms: number): string {
  try {
    return new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
  } catch {
    return new Date(ms).toISOString().slice(11, 16);
  }
}

/** "4 min 05 s" / "1 h 20 min" (curto, sem depender de idioma). */
export function tempoCurto(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(s % 60).padStart(2, "0")} s`;
  return `${s} s`;
}

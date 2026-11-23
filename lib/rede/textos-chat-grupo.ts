// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da conversa em grupo (recurso "alumia-chat-grupo"): i18n/rede/chat-grupo/{pt,en,es,fr,ru,zh}.json (pt é o final; os
// outros cinco são rascunho marcado e mostram o português até a revisão). Carrega só o idioma pedido, sob demanda.
// Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/rede/chat-grupo/pt.json";
import { carregarPronto } from "./textos-prontos";

export type TextosDoChatGrupo = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/chat-grupo/pt.json"),
  en: () => import("../../i18n/rede/chat-grupo/en.json"),
  es: () => import("../../i18n/rede/chat-grupo/es.json"),
  fr: () => import("../../i18n/rede/chat-grupo/fr.json"),
  ru: () => import("../../i18n/rede/chat-grupo/ru.json"),
  zh: () => import("../../i18n/rede/chat-grupo/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoChatGrupo(lang: string): Promise<TextosDoChatGrupo> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDoChatGrupo;
}

/** A frase de um erro dos grupos (o código do erro, ou a frase genérica). */
export function erroDoGrupo(t: TextosDoChatGrupo, e: unknown): string {
  const codigo = String((e as { code?: unknown })?.code ?? (e as { message?: unknown })?.message ?? "");
  const erros = t.erros as Record<string, string>;
  return erros[codigo] ?? t.erros.generico;
}

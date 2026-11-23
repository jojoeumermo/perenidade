// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da sala de vídeo pelo LiveKit (Prompt 4, item 141, atrás de "sala-livekit"): i18n/sala-livekit/{pt,en,es,fr,ru,zh}.json
// (pt é o final; os outros cinco são rascunho marcado e mostram o português até a revisão). Carrega só o idioma pedido.
// Sem "@/" de propósito (roda no Node nos testes).
import type pt from "../../i18n/sala-livekit/pt.json";
import { carregarPronto } from "../rede/textos-prontos";

export type TextosDaSala = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/sala-livekit/pt.json"),
  en: () => import("../../i18n/sala-livekit/en.json"),
  es: () => import("../../i18n/sala-livekit/es.json"),
  fr: () => import("../../i18n/sala-livekit/fr.json"),
  ru: () => import("../../i18n/sala-livekit/ru.json"),
  zh: () => import("../../i18n/sala-livekit/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDaSala(lang: string): Promise<TextosDaSala> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDaSala;
}

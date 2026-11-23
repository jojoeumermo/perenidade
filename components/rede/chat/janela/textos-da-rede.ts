// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da Alumia (i18n/rede/<idioma>.json) para a janela flutuante do chat, carregados no navegador só quando a janela
// abre, e só o idioma pedido (lib/rede/textos.ts é do servidor e traz os seis de uma vez). As peças da conversa usam deles os
// erros e os estados. O rascunho cai no português, como em todo pacote da Alumia (lib/rede/textos-prontos.ts).
import type { TextosDaRede } from "@/lib/rede/textos";
import { carregarPronto } from "@/lib/rede/textos-prontos";

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("@/i18n/rede/pt.json"),
  en: () => import("@/i18n/rede/en.json"),
  es: () => import("@/i18n/rede/es.json"),
  fr: () => import("@/i18n/rede/fr.json"),
  ru: () => import("@/i18n/rede/ru.json"),
  zh: () => import("@/i18n/rede/zh.json"),
};

export async function carregarTextosDaRede(lang: string): Promise<TextosDaRede> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDaRede;
}

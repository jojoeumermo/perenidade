// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos das telas que fecharam a Faixa 1 (aparência e leitura, pastas dos salvos, buscas salvas, posts que se repetem, linha
// dos #temas e o aviso de dentro do aplicativo): i18n/rede/acabamento/{pt,en,es,fr,ru,zh}.json. Só um idioma chega ao navegador.
// Sem "@/" de propósito (roda no Node nos testes: scripts/testar-alumia-acabamento.mjs).
import type pt from "../../i18n/rede/acabamento/pt.json";
import { carregarPronto } from "./textos-prontos";

export type TextosDoAcabamento = typeof pt;

const CARREGAR: Record<string, () => Promise<{ default: unknown }>> = {
  pt: () => import("../../i18n/rede/acabamento/pt.json"),
  en: () => import("../../i18n/rede/acabamento/en.json"),
  es: () => import("../../i18n/rede/acabamento/es.json"),
  fr: () => import("../../i18n/rede/acabamento/fr.json"),
  ru: () => import("../../i18n/rede/acabamento/ru.json"),
  zh: () => import("../../i18n/rede/acabamento/zh.json"),
};

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export async function carregarTextosDoAcabamento(lang: string): Promise<TextosDoAcabamento> {
  return (await carregarPronto(CARREGAR, lang)) as TextosDoAcabamento;
}

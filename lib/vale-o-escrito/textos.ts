// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos de interface do Vale o Escrito: i18n/vale-o-escrito/{pt,en,es,fr,ru,zh}.json. O português é o texto final;
// os outros cinco são rascunho até a revisão (ESPEC, seção 8). Só o servidor (páginas do observatório) importa este
// módulo; componente de cliente recebe a parte que usa por props. Para o menu use lib/vale-o-escrito/menu.ts.
// Sem os atalhos "@/" de propósito (roda no Node nos testes).

import en from "../../i18n/vale-o-escrito/en.json";
import es from "../../i18n/vale-o-escrito/es.json";
import fr from "../../i18n/vale-o-escrito/fr.json";
import pt from "../../i18n/vale-o-escrito/pt.json";
import ru from "../../i18n/vale-o-escrito/ru.json";
import zh from "../../i18n/vale-o-escrito/zh.json";

export type TextosDoObservatorio = typeof pt;

export const TEXTOS_DO_OBSERVATORIO: Record<string, TextosDoObservatorio> = { pt, en, es, fr, ru, zh };

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export const textosDoObservatorio = (lang: string): TextosDoObservatorio => TEXTOS_DO_OBSERVATORIO[lang] ?? pt;

/** Troca {nome} pelo valor (mesma convenção do resto do site). */
export const preencherTexto = (texto: string, valores: Record<string, string | number>): string =>
  texto.replace(/\{(\w+)\}/g, (inteiro, nome: string) => (nome in valores ? String(valores[nome]) : inteiro));

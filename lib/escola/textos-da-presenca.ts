// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da presença somada (E4-02), num módulo só de textos. O layout raiz (pelo campus, E4-09) e a página inicial
// os usam: se viessem de lib/escola/matricula-servidor.ts, que lê o disco (cursos, aulas, exercícios), o rastreio de
// arquivos da Vercel levaria o projeto inteiro em quase todas as funções, e o envio do deploy passava de 45 min.
import presencaEn from "@/i18n/escola/presenca/en.json";
import presencaEs from "@/i18n/escola/presenca/es.json";
import presencaFr from "@/i18n/escola/presenca/fr.json";
import presencaPt from "@/i18n/escola/presenca/pt.json";
import presencaRu from "@/i18n/escola/presenca/ru.json";
import presencaZh from "@/i18n/escola/presenca/zh.json";
import { escolher } from "./textos";

/** Os textos da presença somada (E4-02), que o "quem volta" e o quadro de avisos mostram. */
export const textosDaPresenca = (lang: string): typeof presencaPt => escolher({ pt: presencaPt, en: presencaEn, es: presencaEs, fr: presencaFr, ru: presencaRu, zh: presencaZh }, lang);

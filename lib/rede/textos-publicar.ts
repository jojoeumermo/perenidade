// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote publicar: i18n/rede/publicar/{pt,en,es,fr,ru,zh}.json (pt é o texto final; os outros cinco são rascunho
// marcado com "_rascunho"). Este módulo carrega os seis e serve ao servidor e aos testes; o navegador usa
// components/rede/publicar/textos.ts, que baixa só o idioma da pessoa. Sem "@/" de propósito.
import en from "../../i18n/rede/publicar/en.json";
import es from "../../i18n/rede/publicar/es.json";
import fr from "../../i18n/rede/publicar/fr.json";
import pt from "../../i18n/rede/publicar/pt.json";
import ru from "../../i18n/rede/publicar/ru.json";
import zh from "../../i18n/rede/publicar/zh.json";

export type TextosPublicar = typeof pt;

const TEXTOS: Record<string, TextosPublicar> = { pt, en, es, fr, ru, zh } as unknown as Record<string, TextosPublicar>;

export const textosPublicar = (lang: string): TextosPublicar => TEXTOS[lang] ?? pt;
export const IDIOMAS_PUBLICAR = Object.keys(TEXTOS);

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote "consertos": i18n/rede/consertos/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros cinco são rascunho
// marcado). Só o servidor importa este módulo; o navegador recebe os textos de UM idioma por props (ConsertosProvider).
import en from "../../i18n/rede/consertos/en.json";
import es from "../../i18n/rede/consertos/es.json";
import fr from "../../i18n/rede/consertos/fr.json";
import pt from "../../i18n/rede/consertos/pt.json";
import ru from "../../i18n/rede/consertos/ru.json";
import zh from "../../i18n/rede/consertos/zh.json";

export type TextosDosConsertos = typeof pt;

const TEXTOS: Record<string, TextosDosConsertos> = { pt, en, es, fr, ru, zh } as unknown as Record<string, TextosDosConsertos>;

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export const textosDosConsertos = (lang: string): TextosDosConsertos => TEXTOS[lang] ?? pt;

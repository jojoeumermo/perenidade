// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos do pacote "comunidades": i18n/rede/comunidades/{pt,en,es,fr,ru,zh}.json (pt é o final; os outros cinco são rascunho
// marcado). Só o servidor (as páginas) importa este módulo. `comTextos(lang)` devolve os textos da Rede com os desta tela sob a
// chave `comunidades`: o componente de cliente recebe UM idioma só, por props. Sem "@/" de propósito (roda no Node nos testes).
import en from "../../i18n/rede/comunidades/en.json";
import es from "../../i18n/rede/comunidades/es.json";
import fr from "../../i18n/rede/comunidades/fr.json";
import pt from "../../i18n/rede/comunidades/pt.json";
import ru from "../../i18n/rede/comunidades/ru.json";
import zh from "../../i18n/rede/comunidades/zh.json";
import { type TextosDaRede, textosDaRede } from "./textos";

export type TextosDeComunidades = typeof pt;
/** Os textos da Rede com os do pacote em `comunidades`. */
export type TextosComComunidades = TextosDaRede & { comunidades: TextosDeComunidades };

const TEXTOS: Record<string, TextosDeComunidades> = { pt, en, es, fr, ru, zh } as unknown as Record<string, TextosDeComunidades>;

/** Os textos do pacote no idioma pedido; idioma desconhecido cai no português. */
export const textosDeComunidades = (lang: string): TextosDeComunidades => TEXTOS[lang] ?? pt;

/** Os textos da Rede (um idioma) mais os do pacote: é o que as rotas do pacote passam à Rede. */
export const comTextos = (lang: string): TextosComComunidades => ({ ...textosDaRede(lang), comunidades: textosDeComunidades(lang) });

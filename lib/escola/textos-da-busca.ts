// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos da busca viva, do histórico, dos três passos e do modo seguro (i18n/escola/busca), nos 6 idiomas.
// Este arquivo NÃO lê o disco, de propósito: o layout raiz, o rodapé e várias páginas importam daqui. Quem lê arquivos
// (os cursos, em lib/escola/cursos-servidor.ts) fica em lib/escola/indice.ts, que só a busca do servidor importa. Se o
// layout importasse um arquivo que lê o disco, o rastreio de arquivos da Vercel levaria o projeto inteiro em CADA
// função, e o envio do deploy passaria dos 45 minutos (foi o que derrubou o deploy da segunda onda da Escola).
// Sem os atalhos "@/" de propósito (lib testável no Node).
import { escolher } from "./textos";
import en from "../../i18n/escola/busca/en.json";
import es from "../../i18n/escola/busca/es.json";
import fr from "../../i18n/escola/busca/fr.json";
import pt from "../../i18n/escola/busca/pt.json";
import ru from "../../i18n/escola/busca/ru.json";
import zh from "../../i18n/escola/busca/zh.json";

export type TextosDaBusca = typeof pt;

const DICIONARIOS = { pt, en, es, fr, ru, zh } satisfies Record<string, TextosDaBusca>;

/** Os textos da busca viva, do histórico, dos três passos e do modo seguro no idioma pedido (desconhecido cai no pt). */
export function textosDaBusca(lang: string): TextosDaBusca {
  return escolher(DICIONARIOS, lang);
}

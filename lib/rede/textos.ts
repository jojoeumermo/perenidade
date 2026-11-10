// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Os textos de interface da Rede v2: i18n/rede/{pt,en,es,fr,ru,zh}.json. O português é o texto final; os outros cinco são
// rascunho marcado (campo "_rascunho") até a revisão. Só o servidor (as páginas) importa este módulo; o componente de cliente
// recebe os textos de UM idioma por props, para o navegador não baixar os seis. Cada pacote acrescenta as suas chaves nos seis
// arquivos (docs/rede/V2.md). Sem os atalhos "@/" de propósito (roda no Node nos testes).
import en from "../../i18n/rede/en.json";
import es from "../../i18n/rede/es.json";
import fr from "../../i18n/rede/fr.json";
import pt from "../../i18n/rede/pt.json";
import ru from "../../i18n/rede/ru.json";
import zh from "../../i18n/rede/zh.json";

export type TextosDaRede = typeof pt;

const TEXTOS: Record<string, TextosDaRede> = { pt, en, es, fr, ru, zh } as unknown as Record<string, TextosDaRede>;

/** Os textos do idioma pedido; idioma desconhecido cai no português. */
export const textosDaRede = (lang: string): TextosDaRede => TEXTOS[lang] ?? pt;

export { preencher } from "./preencher";

/**
 * O <title> de uma tela da Alumia: "Explorar · Alumia" (o layout do site completa com " — Instituto Lúcia"). Só o nome da tela,
 * nunca um trecho de conteúdo; cada aba e cada entrada do histórico se distingue, e o leitor de tela anuncia a troca de página.
 */
export function tituloDaTela(lang: string, tela: keyof TextosDaRede["menu"]): string {
  const s = textosDaRede(lang);
  return `${s.menu[tela]} · ${s.marca}`;
}

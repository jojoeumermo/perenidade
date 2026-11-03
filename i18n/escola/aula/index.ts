// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos dos controles novos da aula (Etapa 4, pacote E4-03: próximo passo, partes, retomar, letra, seleção, uma mão,
// ouvir o parágrafo, versão fácil e nível de leitura), nos 6 idiomas. Só o servidor importa este arquivo: a página da
// aula escolhe o idioma e passa a parte de cada componente por props, para o navegador não baixar os 6 dicionários. Componente de cliente
// importa daqui só o tipo (import type), nunca os valores.

export type TextosDaAula = typeof pt;

const TEXTOS: Record<Locale, TextosDaAula> = { pt, en, es, fr, zh, ru };

export function textosDaAula(lang: Locale): TextosDaAula {
  return TEXTOS[lang] ?? pt;
}


// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos da página /plantao (Plantão de dúvidas, Etapa 3), nos 6 idiomas. A página não inventa canal nem horário: só
// reúne os que já existem e usa, para dizer o que cada um é, os textos que as páginas deles já têm (t.tutoring, t.community,
// t.live, t.studyGroup, t.salaLivre). Aqui ficam só o título, o aviso de que não há horário fixo e o "como funciona" de
// cada canal. Só o servidor importa este arquivo.

export type TextosDoPlantao = typeof pt;

const TEXTOS: Record<Locale, TextosDoPlantao> = { pt, en, es, fr, zh, ru };

export function textosDoPlantao(lang: Locale): TextosDoPlantao {
  return TEXTOS[lang] ?? pt;
}

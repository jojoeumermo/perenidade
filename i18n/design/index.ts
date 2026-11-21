// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Locale } from "@/i18n/config";
import en from "./en.json";
import es from "./es.json";
import fr from "./fr.json";
import pt from "./pt.json";
import ru from "./ru.json";
import zh from "./zh.json";

// Os textos do redesign (Prompt 5, E1): a opção "Contornos fortes" do botão de acessibilidade, que só aparece com o recurso
// "design-novo" ligado. Só o servidor importa este arquivo e passa o idioma certo para o botão (app/[lang]/layout.tsx).
// As traduções levam "_rascunho" até alguém revisar; na falta de uma chave, vale o português.

export type TextosDoDesign = { fortes: string; fortesDica: string };

const TEXTOS: Record<Locale, Partial<TextosDoDesign>> = { pt, en, es, fr, zh, ru };

export function textosDoDesign(lang: Locale): TextosDoDesign {
  return { ...pt, ...(TEXTOS[lang] ?? {}) };
}

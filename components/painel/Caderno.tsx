// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/i18n/config";
import pt from "@/i18n/pt.json";
import { CadernoDeEstudos, type NotebookStrings } from "../caderno/Caderno";
import { useI18n } from "../I18n";

/** Os textos do caderno nos outros idiomas, carregados só quando o painel está em outro idioma. */
const textos: Partial<Record<Locale, () => Promise<NotebookStrings>>> = {
  en: () => import("@/i18n/en.json").then((d) => d.default.notebook),
  es: () => import("@/i18n/es.json").then((d) => d.default.notebook),
  fr: () => import("@/i18n/fr.json").then((d) => d.default.notebook),
  ru: () => import("@/i18n/ru.json").then((d) => d.default.notebook),
  zh: () => import("@/i18n/zh.json").then((d) => d.default.notebook),
};

/**
 * O caderno de estudos dentro do painel, para preparar aulas (e, no podcast, episódios). É o mesmo do site, com os
 * textos no idioma do painel; as fontes que a pessoa junta ficam como estão (data-original).
 */
export function CadernoNoPainel({ modo = "painel" }: { modo?: "painel" | "podcast" }) {
  const { lang } = useI18n();
  const [carregado, setCarregado] = useState<{ lang: Locale; s: NotebookStrings } | null>(null);
  useEffect(() => {
    const carregar = textos[lang];
    if (!carregar) return;
    let ativo = true;
    void carregar().then((s) => {
      if (ativo) setCarregado({ lang, s });
    });
    return () => {
      ativo = false;
    };
  }, [lang]);
  const s = carregado?.lang === lang ? carregado.s : pt.notebook;
  return (
    <div className="-mt-6">
      <p className="max-w-3xl text-ink-soft">
        {modo === "podcast"
          ? "Junte as fontes do episódio (aulas e obras do site, textos, arquivos) e o caderno extrai o resumo, as palavras que precisam ser explicadas, a linha do tempo e um esboço de roteiro no gabarito do programa. Tudo fica neste navegador."
          : "Junte as fontes da aula que vai escrever (aulas vizinhas, obras do acervo, textos seus) e o caderno extrai resumo, palavras-chave, cartões, questionário, mapa e linha do tempo. É a mesma sala de estudo do site, em institutolucia.org/caderno, aberta a todos."}
      </p>
      <div data-original>
        <CadernoDeEstudos s={s} modo={modo} />
      </div>
    </div>
  );
}

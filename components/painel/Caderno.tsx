// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import pt from "@/i18n/pt.json";
import { CadernoDeEstudos } from "../caderno/Caderno";

/** O caderno de estudos dentro do painel, para preparar aulas (e, no podcast, episódios). O mesmo do site, em português. */
export function CadernoNoPainel({ modo = "painel" }: { modo?: "painel" | "podcast" }) {
  return (
    <div className="-mt-6">
      <p className="max-w-3xl text-ink-soft">
        {modo === "podcast"
          ? "Junte as fontes do episódio (aulas e obras do site, textos, arquivos) e o caderno extrai o resumo, as palavras que precisam ser explicadas, a linha do tempo e um esboço de roteiro no gabarito do programa. Tudo fica neste navegador."
          : "Junte as fontes da aula que vai escrever (aulas vizinhas, obras do acervo, textos seus) e o caderno extrai resumo, palavras-chave, cartões, questionário, mapa e linha do tempo. É a mesma sala de estudo do site, em institutolucia.org/caderno, aberta a todos."}
      </p>
      <CadernoDeEstudos s={pt.notebook} modo={modo} />
    </div>
  );
}

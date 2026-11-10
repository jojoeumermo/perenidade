// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { TextosDaOrg } from "@/lib/rede/textos-org";
import { Icone } from "../publicar/alumia2/icones";

// Os painéis do site (components/A11yWidget.tsx e assistente/BotaoDoAssistente.tsx) escutam estes eventos, como na casca.
const alternarAcessibilidade = () => window.dispatchEvent(new Event("lucia:alternar-acessibilidade"));
const alternarAjuda = () => window.dispatchEvent(new Event("lucia:alternar-assistente"));

/**
 * Acessibilidade e perguntas frequentes no alto das páginas públicas da F4 (fora da casca). No celular os redondos flutuantes do
 * site somem nessas páginas (org.css) porque cobriam o texto; os painéis continuam abrindo daqui.
 */
export function BotoesDoSiteDaOrg({ t }: { t: TextosDaOrg }) {
  return (
    <span className="al-org-botoes-site">
      <button type="button" className="al-org-botao-site" data-alterna-acessibilidade="" onClick={alternarAcessibilidade} aria-label={t.marca.acessibilidade} title={t.marca.acessibilidade}>
        <Icone nome="acessibilidade" className="h-5 w-5" />
      </button>
      <button type="button" className="al-org-botao-site" onClick={alternarAjuda} aria-label={t.marca.ajuda} title={t.marca.ajuda}>
        <Icone nome="ajuda" className="h-5 w-5" />
      </button>
    </span>
  );
}

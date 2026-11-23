// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import type { TextosDaOrg } from "@/lib/rede/textos-org";
import { Icone } from "../publicar/alumia2/icones";

// O painel de acessibilidade do site (components/A11yWidget.tsx) escuta este evento, como na casca. A ajuda é a da Alumia (P5, A5).
const alternarAcessibilidade = () => window.dispatchEvent(new Event("lucia:alternar-acessibilidade"));

/**
 * Acessibilidade e perguntas frequentes no alto das páginas públicas da F4 (fora da casca). No celular os redondos flutuantes do
 * site somem nessas páginas (org.css) porque cobriam o texto; os painéis continuam abrindo daqui.
 */
export function BotoesDoSiteDaOrg({ t, lang }: { t: TextosDaOrg; lang: string }) {
  return (
    <span className="al-org-botoes-site">
      <button type="button" className="al-org-botao-site" data-alterna-acessibilidade="" onClick={alternarAcessibilidade} aria-label={t.marca.acessibilidade} title={t.marca.acessibilidade}>
        <Icone nome="acessibilidade" className="h-5 w-5" />
      </button>
      <Link href={localePath(lang, "/alumia/ajuda")} className="al-org-botao-site" aria-label={t.marca.ajuda} title={t.marca.ajuda}>
        <Icone nome="ajuda" className="h-5 w-5" />
      </Link>
    </span>
  );
}

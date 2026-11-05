// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import type { ChecagemParaJogo } from "@/lib/jogos-proprios/regras";

// Cada jogo é carregado só quando a pessoa o abre (dynamic import), para a página de Jogos continuar leve.
const Carregando = () => <p className="p-4 text-sm" role="status">Carregando o jogo…</p>;
const LinhaDeMontagem = dynamic(() => import("./LinhaDeMontagem"), { loading: Carregando });
const QuemEODono = dynamic(() => import("./QuemEODono"), { loading: Carregando });
const ConquistasEGreves = dynamic(() => import("./ConquistasEGreves"), { loading: Carregando });
const Orcamento = dynamic(() => import("./Orcamento"), { loading: Carregando });
const FatoOuBoato = dynamic(() => import("./FatoOuBoato"), { loading: Carregando });
const DetetiveDeFakeNews = dynamic(() => import("./DetetiveDeFakeNews"), { loading: Carregando });
const CatracaERelogio = dynamic(() => import("./CatracaERelogio"), { loading: Carregando });
const NegociacaoColetiva = dynamic(() => import("./NegociacaoColetiva"), { loading: Carregando });

/** Abre o jogo pelo slug de registro.ts. `checagens` só é usado por "fato-ou-boato" (a página lê o disco e passa a lista). */
export function JogoProprio({ slug, checagens = [] }: { slug: string; checagens?: ChecagemParaJogo[] }) {
  switch (slug) {
    case "linha-de-montagem": return <LinhaDeMontagem />;
    case "quem-e-o-dono": return <QuemEODono />;
    case "conquistas-e-greves": return <ConquistasEGreves />;
    case "orcamento": return <Orcamento />;
    case "fato-ou-boato": return <FatoOuBoato checagens={checagens} />;
    case "detetive-de-fake-news": return <DetetiveDeFakeNews />;
    case "catraca-e-relogio": return <CatracaERelogio />;
    case "negociacao-coletiva": return <NegociacaoColetiva />;
    default: return null;
  }
}

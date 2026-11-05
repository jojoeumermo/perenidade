// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// Cada jogo da parte 2 é baixado só quando a pessoa o abre. Os import() ficam escritos aqui (e não em registro.ts) para que
// a lista de cartões não puxe os dados dos jogos junto: o registro só entra no servidor.
const Carregando = () => <p className="p-4 text-sm" role="status">Carregando o jogo…</p>;
const QuemConstruiu = dynamic(() => import("./QuemConstruiu"), { loading: Carregando, ssr: false });
const ZoneamentoPopular = dynamic(() => import("./ZoneamentoPopular"), { loading: Carregando, ssr: false });
const TransicaoEnergetica = dynamic(() => import("./TransicaoEnergetica"), { loading: Carregando, ssr: false });
const MapaDaSaude = dynamic(() => import("./MapaDaSaude"), { loading: Carregando, ssr: false });
const QuadroDeDisjuntores = dynamic(() => import("./QuadroDeDisjuntores"), { loading: Carregando, ssr: false });
const AjusteOPonto = dynamic(() => import("./AjusteOPonto"), { loading: Carregando, ssr: false });
const BugNaMemoria = dynamic(() => import("./BugNaMemoria"), { loading: Carregando, ssr: false });
const RedundanciaDeServidores = dynamic(() => import("./RedundanciaDeServidores"), { loading: Carregando, ssr: false });

/** Abre o jogo pelo `id` de registro.ts (JOGOS_PROPRIOS_2). */
export function JogoProprio2({ id }: { id: string }) {
  switch (id) {
    case "quem-construiu-a-cidade": return <QuemConstruiu />;
    case "zoneamento-popular": return <ZoneamentoPopular />;
    case "transicao-energetica-justa": return <TransicaoEnergetica />;
    case "mapa-da-saude-popular": return <MapaDaSaude />;
    case "quadro-de-disjuntores": return <QuadroDeDisjuntores />;
    case "ajuste-o-ponto": return <AjusteOPonto />;
    case "o-bug-na-memoria": return <BugNaMemoria />;
    case "redundancia-de-servidores": return <RedundanciaDeServidores />;
    default: return null;
  }
}

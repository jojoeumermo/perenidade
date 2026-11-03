// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// O aprender ativo na aula (Etapa 4, E4-13; docs/escola/avaliacao.md): o "lembra?" do começo e o "explique com suas
// palavras" do fim. Carga tardia e só no navegador: o código só é baixado com o recurso "escola" ligado, não pesa no
// orçamento da aula (scripts/orcamento-peso.mjs) e lê o aparelho sem diferença de HTML na hidratação.
export const LembraDaAnteriorSobDemanda = dynamic(() => import("./LembraDaAnterior").then((m) => m.LembraDaAnterior), { ssr: false });
export const ExpliqueComSuasPalavrasSobDemanda = dynamic(() => import("./ExpliqueComSuasPalavras").then((m) => m.ExpliqueComSuasPalavras), { ssr: false });

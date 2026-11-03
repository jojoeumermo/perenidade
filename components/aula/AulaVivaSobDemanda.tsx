// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// As peças da aula por dentro (Etapa 4, E4-03), cada uma num arquivo à parte: o código só é baixado quando a peça
// aparece, com o recurso "escola" ligado. Importadas direto pela página, iriam para todas as aulas mesmo desligadas e
// pesariam no orçamento da aula (scripts/orcamento-peso.mjs). As que mexem no texto já montado não rodam no servidor.
export const ProximoPassoSobDemanda = dynamic(() => import("./ProximoPasso").then((m) => m.ProximoPasso), { ssr: false });
export const FatiasSobDemanda = dynamic(() => import("./Fatias").then((m) => m.Fatias), { ssr: false });
export const RetomarAquiSobDemanda = dynamic(() => import("./RetomarAqui").then((m) => m.RetomarAqui), { ssr: false });
export const BarraDeSelecaoSobDemanda = dynamic(() => import("./BarraDeSelecao").then((m) => m.BarraDeSelecao), { ssr: false });
export const OuvirParagrafoSobDemanda = dynamic(() => import("./OuvirParagrafo").then((m) => m.OuvirParagrafo), { ssr: false });
export const TamanhoDaLetraSobDemanda = dynamic(() => import("./TamanhoDaLetra").then((m) => m.TamanhoDaLetra), { ssr: false });
export const VersaoFacilSobDemanda = dynamic(() => import("./VersaoFacil").then((m) => m.VersaoFacil));

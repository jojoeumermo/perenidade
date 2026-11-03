// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// A leveza da aula (E4-17) por carga tardia, como o E4-03 fez: o código só é baixado quando a aula mostra a peça, com o
// recurso "escola" ligado. Importada direto pela página, iria para todas as aulas e pesaria no orçamento (700 KiB).
export const LevezaDaAulaSobDemanda = dynamic(() => import("./LevezaDaAula").then((m) => m.LevezaDaAula), { ssr: false });

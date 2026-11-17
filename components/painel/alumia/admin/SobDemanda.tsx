// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

/**
 * O painel de admin da Alumia só é baixado por quem abre a seção (a coordenação). O código é público (o repositório é aberto);
 * o que protege o painel é o banco, que confere a coordenação e o segundo fator em cada função.
 */
export const PainelUnicoSobDemanda = dynamic(() => import("./PainelUnico").then((m) => m.PainelUnico), {
  ssr: false,
  loading: () => (
    <p role="status" className="p-6 font-mono text-xs">
      Abrindo o painel de admin da Alumia…
    </p>
  ),
});

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

/**
 * O painel de controle da Alumia só é baixado por quem abre a seção (a coordenação e o admin da Alumia): o código dele, a folha
 * de estilo e a letra da Alumia não pesam no painel de mais ninguém. O código é público (o repositório é aberto); o que protege
 * o painel é o banco, que confere o papel em cada função.
 */
export const PainelDaAlumiaSobDemanda = dynamic(() => import("./PainelDaAlumia").then((m) => m.PainelDaAlumia), {
  ssr: false,
  loading: () => (
    <p role="status" className="p-6 font-mono text-xs">
      Abrindo o painel da Alumia…
    </p>
  ),
});

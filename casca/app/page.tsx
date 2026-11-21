// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";

// Tudo roda no aparelho: a página estática só carrega a casca.
const Casca = dynamic(() => import("./Casca"), { ssr: false });

export default function Pagina() {
  return <Casca />;
}

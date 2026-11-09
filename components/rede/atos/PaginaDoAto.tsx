// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** A página de um ato (prancha celular-modo-atos) (/alumia/ato/[id]). Esboço da F0: "em construção" até a F2 pôr a tela de verdade. */
export default function PaginaDoAto(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="ato" />;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** A tela dos atos (prancha celular-modo-atos) (/alumia/atos). Esboço da F0: "em construção" até a F2 pôr a tela de verdade. */
export default function TelaDosAtos(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="atos" />;
}

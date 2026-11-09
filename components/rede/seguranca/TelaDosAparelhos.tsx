// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** Os aparelhos conectados (/alumia/aparelhos). Esboço da F0: "em construção" até a F6 pôr a tela de verdade. */
export default function TelaDosAparelhos(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="aparelhos" />;
}

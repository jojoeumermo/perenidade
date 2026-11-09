// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** As listas (linhas com regras da própria pessoa) (/alumia/listas). Esboço da F0: "em construção" até a F9 pôr a tela de verdade. */
export default function TelaDasListas(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="listas" />;
}

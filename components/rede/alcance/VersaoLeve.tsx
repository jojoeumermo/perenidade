// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** A versão leve (só texto) (/alumia/leve). Esboço da F0: "em construção" até a F9 pôr a tela de verdade. */
export default function VersaoLeve(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="leve" />;
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** O relatório de transparência (/alumia/transparencia). Esboço da F0: "em construção" até a F8 pôr a tela de verdade. */
export default function TelaDaTransparencia(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="transparencia" />;
}

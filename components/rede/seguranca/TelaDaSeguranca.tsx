// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** A segurança pessoal (modo ato, Fui detido, Estou bem) (/alumia/seguranca). Esboço da F0: "em construção" até a F6 pôr a tela de verdade. */
export default function TelaDaSeguranca(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="seguranca" />;
}

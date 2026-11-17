// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import TelaLeve from "../leve/TelaLeve";
import type { PropsDaTelaDoPacote } from "../registro";

/** Leve e no seu tempo (/alumia/leve), frente 13D da onda 13: a tela mora em components/rede/leve/. */
export default function VersaoLeve(props: PropsDaTelaDoPacote) {
  return <TelaLeve {...props} />;
}

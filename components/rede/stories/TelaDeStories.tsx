// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { EmConstrucao } from "../onda5/EmConstrucao";
import type { PropsDaTelaDoPacote } from "../registro";

/** Os stories (pranchas celular-stories-na-linha, celular-criar-story, celular-ver-story) (/alumia/stories). Esboço da F0: "em construção" até a F5 pôr a tela de verdade. */
export default function TelaDeStories(props: PropsDaTelaDoPacote) {
  return <EmConstrucao {...props} nome="stories" />;
}

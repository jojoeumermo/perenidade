// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { ligado } from "@/lib/recursos";

// O "Não entendi" da faixa da aula (E4-10) num pedaço à parte: com o recurso "escola" desligado, nada é baixado; ligado,
// o botão chega depois da hidratação, e a conversa (que é a parte pesada) só quando a folha abre.
const NaoEntendi = dynamic(() => import("./NaoEntendi").then((m) => m.NaoEntendi), { ssr: false });

export function NaoEntendiSobDemanda(props: { aula: string; className?: string }) {
  if (!ligado("escola")) return null;
  return <NaoEntendi {...props} />;
}

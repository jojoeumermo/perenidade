// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { carimbarConclusoes } from "@/lib/meu-estudo";
import { useCompleted } from "@/lib/progress";

/** Mantém as datas de conclusão em dia com a lista de aulas feitas (para a meta da semana do "Meu estudo"). Não desenha nada. */
export function RegistroDeConclusao() {
  const feitas = useCompleted();
  useEffect(() => {
    carimbarConclusoes(feitas);
  }, [feitas]);
  return null;
}

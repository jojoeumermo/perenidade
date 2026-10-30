// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { diasAte } from "@/lib/enem";

interface Textos {
  faltam: string;
  faltaUm: string;
  faltamDia2: string;
  ehHoje: string;
  jaFoi: string;
}

/** O texto do dia, separado para os testes: depende só das duas datas e de quantos dias faltam para cada uma. */
export function textoDaContagem(ate1: number, ate2: number, d: { d1: string; d2: string; ano: number; gabarito: string }, s: Textos): string {
  if (ate1 === 0 || ate2 === 0) return s.ehHoje;
  if (ate1 > 1) return fill(s.faltam, { n: ate1, data: d.d1 });
  if (ate1 === 1) return fill(s.faltaUm, { data: d.d1 });
  if (ate2 > 0) return fill(s.faltamDia2, { n: ate2, data: d.d2 });
  return fill(s.jaFoi, { ano: d.ano, gabarito: d.gabarito });
}

/**
 * Quanto falta para a prova, contado no aparelho (a página é montada uma vez; o dia de hoje é o de quem lê).
 * Sem contagem de sequência nem nada que pressione: só a distância até as datas do edital.
 */
export function FaltamDias({ dia1, dia2, d, s }: { dia1: string; dia2: string; d: { d1: string; d2: string; ano: number; gabarito: string }; s: Textos }) {
  const [texto, setTexto] = useState<string | null>(null);
  useEffect(() => {
    const hoje = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o dia de hoje é o do aparelho de quem lê, não o da montagem
    setTexto(textoDaContagem(diasAte(dia1, hoje), diasAte(dia2, hoje), d, s));
  }, [dia1, dia2, d, s]);
  return texto ? <p className="font-serif text-2xl">{texto}</p> : null;
}

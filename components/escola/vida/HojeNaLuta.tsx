// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { baixar } from "@/components/estudo/guardado";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { icsDaLuta, type Luta, proximaLuta } from "@/lib/escola/lutas";
import { hojeEmBrasilia } from "@/lib/escola/tempo";

/** Destaca a data de hoje e a próxima (pelo relógio do aparelho, em Brasília). Pequeno: só links para os cartões da página. */
export function HojeNaLuta({ lutas, s }: { lutas: Luta[]; s: Pick<TextosDaVida["lutas"], "hoje" | "proxima"> }) {
  const [quando, setQuando] = useState<{ hoje: Luta | null; proxima: { luta: Luta; data: string } | null } | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const hoje = hojeEmBrasilia();
      setQuando({ hoje: lutas.find((l) => l.feriado && l.dia === hoje.slice(5)) ?? null, proxima: proximaLuta(lutas, hoje, true) });
    }, 0);
    return () => window.clearTimeout(id);
  }, [lutas]);
  if (!quando || (!quando.hoje && !quando.proxima)) return null;
  const proxima = quando.proxima && quando.proxima.luta !== quando.hoje ? quando.proxima : null;
  return (
    <p className="vida-aviso" role="status" data-hoje-na-luta="">
      {quando.hoje ? (
        <>
          <span className="font-semibold">{s.hoje}:</span>{" "}
          <a className="underline" href={`#luta-${quando.hoje.dia}`} lang="pt">
            {quando.hoje.nome}
          </a>
        </>
      ) : null}
      {quando.hoje && proxima ? " · " : null}
      {proxima ? (
        <>
          <span className="font-semibold">{s.proxima}:</span> {proxima.data.split("-").reverse().slice(0, 2).join("/")}{" "}
          <a className="underline" href={`#luta-${proxima.luta.dia}`} lang="pt">
            {proxima.luta.nome}
          </a>
        </>
      ) : null}
    </p>
  );
}

/** "Pôr na agenda": o .ics da próxima ocorrência, feito no aparelho (evento único, sem recorrência). Sem JavaScript não aparece. */
export function PorNaAgenda({ luta, texto }: { luta: Luta; texto: string }) {
  return (
    <button
      type="button"
      className="vida-botao-claro"
      onClick={() => {
        const ics = icsDaLuta(luta, hojeEmBrasilia(), window.location.href.split("#")[0]);
        if (ics) baixar(`luta-${luta.dia}.ics`, ics, "text/calendar;charset=utf-8");
      }}
    >
      {texto}
    </button>
  );
}
// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";

interface Fato {
  ano: number;
  texto: string;
  link: string;
}

/**
 * "Neste dia": três fatos que a Wikipédia destaca para a data de hoje. Vem do nosso próprio servidor
 * (/api/neste-dia), que consulta a Wikipédia por conta dele; se não houver resposta, o quadro não aparece.
 */
export function NesteDia({ s, lang }: { s: Dict["home"]; lang: string }) {
  const [fatos, setFatos] = useState<Fato[] | null>(null);
  const [dia, setDia] = useState("");

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/neste-dia?lang=${lang}`)
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados: { dia?: string; fatos?: Fato[] } | null) => {
        if (cancelado || !dados?.fatos?.length) return;
        setFatos(dados.fatos.slice(0, 3));
        setDia(dados.dia ?? "");
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  }, [lang]);

  if (!fatos) return null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="neste-dia">
      <div className="border border-rule bg-parchment-deep p-6 sm:p-8">
        <h2 id="neste-dia" className="text-3xl font-semibold">
          {s.onThisDay} <span className="font-normal text-ink-soft">· {dia}</span>
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-3">
          {fatos.map((fato) => (
            <li key={`${fato.ano}${fato.texto.slice(0, 20)}`} className="border-t-2 border-oxblood pt-3">
              <p className="font-sans text-sm font-semibold text-oxblood">{fato.ano}</p>
              <p className="mt-1">
                <a href={fato.link} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-oxblood">
                  {fato.texto}
                </a>
              </p>
            </li>
          ))}
        </ol>
        <p className="mt-5 font-sans text-xs text-ink-soft">{s.onThisDaySource}</p>
      </div>
    </section>
  );
}

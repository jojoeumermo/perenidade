// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";

type Nucleo = { nome: string; cidade: string; uf: string; tipo: string; encontros: string; ponto: string; contato: string };

/** Os núcleos que a coordenação pôs no mapa público, por estado. Só lugar público e contato do próprio núcleo. */
export function NucleosPublicos({ s }: { s: Dict["nucleos"] }) {
  const [nucleos, setNucleos] = useState<Nucleo[] | null>(null);
  const [uf, setUf] = useState<string | null>(null);
  useEffect(() => {
    if (!hasBackend) {
      queueMicrotask(() => setNucleos([]));
      return;
    }
    rpc<Nucleo[]>("nucleos_publicos")
      .then(setNucleos)
      .catch(() => setNucleos([]));
  }, []);

  if (nucleos === null) return <p className="font-sans text-ink-soft">{s.carregando}</p>;
  if (nucleos.length === 0) return <p className="border-l-4 border-gold pl-4 font-serif text-xl">{s.nenhum}</p>;

  const estados = [...new Set(nucleos.map((n) => n.uf))].sort();
  const vistos = nucleos.filter((n) => !uf || n.uf === uf);
  const tipos = s.tipos as Record<string, string>;
  const chip = (ativo: boolean) => `cursor-pointer border-2 px-3 py-1 font-sans text-sm font-semibold ${ativo ? "border-ink bg-ink text-parchment" : "border-ink/40 hover:border-ink"}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={s.estados}>
        <button type="button" className={chip(uf === null)} aria-pressed={uf === null} onClick={() => setUf(null)}>{s.todos} · {nucleos.length}</button>
        {estados.map((sigla) => (
          <button key={sigla} type="button" className={chip(uf === sigla)} aria-pressed={uf === sigla} onClick={() => setUf(sigla)}>
            {sigla === "EX" ? s.exterior : sigla} · {nucleos.filter((n) => n.uf === sigla).length}
          </button>
        ))}
      </div>
      <ul className="mt-6 grid gap-6 sm:grid-cols-2">
        {vistos.map((n, i) => (
          <li key={`${n.uf}-${n.cidade}-${n.nome}`} className={`p-5 ${i % 2 ? "cartao-v" : "cartao"}`}>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-prelo-texto">{n.cidade} · {n.uf === "EX" ? s.exterior : n.uf} · {tipos[n.tipo] ?? n.tipo}</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold leading-tight">{n.nome}</h2>
            <dl className="mt-3 space-y-1 font-sans text-sm">
              {n.encontros && <div><dt className="inline font-semibold">{s.quando} </dt><dd className="inline">{n.encontros}</dd></div>}
              {n.ponto && <div><dt className="inline font-semibold">{s.onde} </dt><dd className="inline">{n.ponto}</dd></div>}
            </dl>
            {n.contato && (
              <a href={n.contato} target="_blank" rel="noopener noreferrer nofollow" className="mt-3 inline-block font-sans text-sm font-semibold underline hover:text-oxblood">
                {s.contato} →
              </a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

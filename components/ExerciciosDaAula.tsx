// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";
import { EDITORES, enderecoDo } from "@/lib/estudio";
import { L } from "./I18n";

interface Exercicio {
  id: string;
  titulo: string;
  objetivo: string;
  programa: "filmcraft" | "effectcraft" | "photocraft";
  materiais: { titulo: string; url: string; credito: string }[];
  passos: string;
  criterios: string;
  autor: string;
}

/** Os exercícios de prática que o educador ligou a esta aula: abrir no estúdio, o material e a entrega pela Gaveta. */
export function ExerciciosDaAula({ aula, s }: { aula: string; s: Dict["practiceStudio"]["exercises"] }) {
  const [lista, setLista] = useState<Exercicio[]>([]);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<Exercicio[]>("exercicios_listar", { p_aula: aula })
      .then((r) => vivo && setLista(Array.isArray(r) ? r : []))
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, [aula]);
  if (lista.length === 0) return null;
  return (
    <section className="no-print mt-10 space-y-4" aria-label={s.title}>
      {lista.map((x) => {
        const editor = EDITORES.find((e) => e.id === x.programa);
        const endereco = enderecoDo(x.programa);
        return (
          <article key={x.id} className="border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.title} · {editor?.nome}</p>
            <h2 className="mt-1 font-serif text-2xl font-semibold" lang="pt-BR">{x.titulo}</h2>
            <p className="mt-2" lang="pt-BR"><strong>{s.objective}:</strong> {x.objetivo}</p>
            {x.materiais.length > 0 && (
              <div className="mt-3">
                <p className="font-semibold">{s.materials}</p>
                <ul className="mt-1 space-y-1">
                  {x.materiais.map((m) => (
                    <li key={m.url}>
                      <a href={m.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{m.titulo} ↗</a>
                      {m.credito && <span className="text-xs text-ink-soft"> · {m.credito}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3">
              <p className="font-semibold">{s.steps}</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-5" lang="pt-BR">
                {x.passos.split("\n").map((p) => p.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean).map((p) => <li key={p}>{p}</li>)}
              </ol>
            </div>
            <p className="mt-3" lang="pt-BR"><strong>{s.criteria}:</strong> {x.criterios}</p>
            <p className="mt-4 flex flex-wrap items-center gap-3">
              {endereco ? (
                <a href={endereco} target="_blank" rel="noopener noreferrer" className="bg-oxblood px-4 py-2 font-semibold text-parchment hover:bg-ink">{s.open}: {editor?.nome} ↗</a>
              ) : (
                <L href="/estudio-de-pratica" className="bg-oxblood px-4 py-2 font-semibold text-parchment hover:bg-ink">{s.open}</L>
              )}
              <L href={`/gaveta?exercicio=${x.id}#publicar`} className="border-2 border-ink px-4 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood">{s.deliver}</L>
            </p>
            <p className="mt-2 text-xs text-ink-soft">{s.deliverHint}</p>
          </article>
        );
      })}
    </section>
  );
}

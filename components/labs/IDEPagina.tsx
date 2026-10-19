// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import exerciciosJs from "@/content/laboratorios/js.json";
import exerciciosPython from "@/content/laboratorios/python.json";
import exerciciosSql from "@/content/laboratorios/sql.json";
import exerciciosWeb from "@/content/laboratorios/web.json";
import { type Exercicio, type Perfil, PERFIS } from "@/lib/laboratorios";
import { L, useI18n } from "../I18n";
import { IDE } from "./IDE";

const EXERCICIOS: Record<Perfil, Exercicio[]> = {
  python: exerciciosPython as Exercicio[],
  php: [],
  web: exerciciosWeb as Exercicio[],
  js: exerciciosJs as Exercicio[],
  sql: exerciciosSql as Exercicio[],
  ts: [],
  cpp: [],
  ruby: [],
  lua: [],
};
const CHAVE_PROGRESSO = "lucia:lab:concluidos";
const lerConcluidos = (): string[] => {
  try {
    return JSON.parse(window.localStorage.getItem(CHAVE_PROGRESSO) ?? "[]") as string[];
  } catch {
    return [];
  }
};

/** A IDE com o seletor de perfil e a lista de exercícios; o progresso fica só neste navegador. */
export function IDEPagina({ perfilInicial }: { perfilInicial?: Perfil }) {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const pedido = params.get("p") as Perfil | null;
  const [perfil, setPerfil] = useState<Perfil>(perfilInicial ?? (pedido && pedido in PERFIS ? pedido : "python"));
  const [exercicio, setExercicio] = useState<string | null>(params.get("ex"));
  // Lido uma vez na montagem (a página é só do navegador).
  const [concluidos, setConcluidos] = useState<string[]>(() => (typeof window === "undefined" ? [] : lerConcluidos()));
  const lista = EXERCICIOS[perfil];
  const atual = lista.find((e) => e.id === exercicio) ?? null;
  const concluir = (id: string) => {
    const novos = [...new Set([...lerConcluidos(), id])];
    try {
      window.localStorage.setItem(CHAVE_PROGRESSO, JSON.stringify(novos));
    } catch {
      // sem armazenamento
    }
    setConcluidos(novos);
  };
  return (
    <div className="mt-6 font-sans text-sm">
      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Perfil">
        {(Object.keys(PERFIS) as Perfil[]).map((p) => (
          <button key={p} type="button" role="tab" aria-selected={perfil === p} onClick={() => { setPerfil(p); setExercicio(null); }} className={`cursor-pointer border-2 px-3 py-1.5 font-semibold ${perfil === p ? "border-ink bg-ink text-parchment" : "border-rule hover:border-ink"}`}>{PERFIS[p].nome}</button>
        ))}
        <L href="/laboratorios" className="ml-auto text-xs underline hover:text-oxblood">{t.labs.voltar}</L>
      </div>
      {lista.length > 0 && (
        <details className="mt-4 border border-rule bg-parchment-deep p-3" open={!atual}>
          <summary className="cursor-pointer font-semibold">{t.labs.exercicios} ({concluidos.filter((id) => lista.some((e) => e.id === id)).length}/{lista.length}){lang !== "pt" ? ` · ${t.labs.ptOnly}` : ""}</summary>
          <ol className="mt-2 grid gap-1 sm:grid-cols-2" lang="pt-BR">
            <li><button type="button" onClick={() => setExercicio(null)} className={`cursor-pointer text-left underline hover:text-oxblood ${!atual ? "font-semibold" : ""}`}>{t.labs.livre}</button></li>
            {lista.map((e, i) => (
              <li key={e.id}>
                <button type="button" onClick={() => setExercicio(e.id)} className={`cursor-pointer text-left underline hover:text-oxblood ${atual?.id === e.id ? "font-semibold" : ""}`}>
                  {i + 1}. {e.titulo} <span className="font-mono text-[0.65rem] text-ink-soft">{"●".repeat(e.nivel)}</span>{concluidos.includes(e.id) && <span className="ml-1 text-ok">✓</span>}
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
      <IDE key={`${perfil}-${atual?.id ?? "livre"}`} perfil={perfil} exercicio={atual ?? undefined} aoConcluir={concluir} />
    </div>
  );
}

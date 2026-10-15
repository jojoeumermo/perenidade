// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/types";

type S = Dict["factCheck"]["steps"];

/**
 * O que cada opção de cada passo quer dizer, na ordem em que aparecem nos dicionários. Os quatro primeiros passos:
 * confere, não confere, não sei. O quinto tem "não tem imagem". O sexto é o que as agências disseram; não achar
 * checagem nenhuma não pesa contra (a maior parte do que circula nunca foi checada).
 */
const SENTIDOS = [
  ["ok", "problema", "duvida"],
  ["ok", "problema", "duvida"],
  ["ok", "problema", "duvida"],
  ["ok", "problema", "duvida"],
  ["ok", "problema", "duvida", "ok"],
  ["ok", "checado_falso", "ok"],
] as const;

type Resultado = keyof S["results"];

/** Do conjunto de respostas para um resultado sugerido. Uma checagem que já desmentiu vale mais que tudo. */
function sugerir(respostas: number[]): Resultado {
  const sentido = respostas.map((r, i) => SENTIDOS[i][r]);
  if (sentido[5] === "checado_falso") return "checadores";
  const semBase = sentido[0] === "problema" && sentido[1] === "problema";
  if (semBase || (sentido[1] === "problema" && sentido[3] === "problema")) return "falso";
  if (sentido[2] === "problema" || sentido[4] === "problema") return "contexto";
  if (sentido.every((x) => x === "ok")) return "confiavel";
  return "duvida";
}

/** "Como checar em 6 passos": tudo fica no aparelho; nada é enviado nem guardado. */
export function ComoChecar({ s }: { s: S }) {
  const [alegacao, setAlegacao] = useState("");
  const [respostas, setRespostas] = useState<(number | null)[]>(() => s.items.map(() => null));
  const [copiado, setCopiado] = useState(false);
  const completas = respostas.every((r): r is number => r !== null);
  const resultado = completas ? sugerir(respostas as number[]) : null;

  function marcar(passo: number, opcao: number) {
    setRespostas((atual) => atual.map((r, i) => (i === passo ? opcao : r)));
    setCopiado(false);
  }

  async function copiar() {
    if (!resultado) return;
    const linhas = [
      alegacao.trim() && `${s.claim}: ${alegacao.trim()}`,
      ...s.items.map((item, i) => `${i + 1}. ${item.q} ${item.options[respostas[i] ?? 0]}`),
      `${s.result}: ${s.results[resultado]}`,
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(linhas.join("\n"));
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <section aria-labelledby="como-checar" className="no-print mt-10 border-2 border-ink p-5 font-sans text-sm">
      <h2 id="como-checar" className="font-serif text-2xl font-semibold">{s.title}</h2>
      <p className="mt-1 text-ink-soft">{s.lead}</p>
      <label className="mt-4 block">
        {s.claim}
        <textarea value={alegacao} onChange={(e) => setAlegacao(e.target.value)} rows={3} maxLength={2000} placeholder={s.claimPlaceholder} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
      </label>
      <ol className="mt-5 space-y-5">
        {s.items.map((item, passo) => (
          <li key={item.q}>
            <fieldset>
              <legend className="font-semibold">
                <span className="font-mono text-gold">{passo + 1}.</span> {item.q}
              </legend>
              <p className="mt-0.5 text-ink-soft">{item.help}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.options.map((opcao, i) => (
                  <label key={opcao} className={`cursor-pointer border px-3 py-1.5 focus-within:outline focus-within:outline-2 ${respostas[passo] === i ? "border-ink bg-ink text-parchment" : "border-rule bg-parchment-deep hover:border-ink"}`}>
                    <input type="radio" name={`passo-${passo}`} className="sr-only" checked={respostas[passo] === i} onChange={() => marcar(passo, i)} />
                    {opcao}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div role="status" aria-live="polite" className="mt-6 border-t border-rule pt-4">
        {resultado ? (
          <>
            <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.result}</p>
            <p className="mt-1 text-lg font-semibold">{s.results[resultado]}</p>
          </>
        ) : (
          <p className="text-ink-soft">{s.pending}</p>
        )}
      </div>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        <button type="button" disabled={!resultado} onClick={() => void copiar()} className="cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
          {copiado ? s.copied : s.copy}
        </button>
        <button
          type="button"
          onClick={() => {
            setAlegacao("");
            setRespostas(s.items.map(() => null));
            setCopiado(false);
          }}
          className="cursor-pointer underline hover:text-oxblood"
        >
          {s.reset}
        </button>
      </p>
      <p className="mt-3 text-xs text-ink-soft">{s.note}</p>
    </section>
  );
}

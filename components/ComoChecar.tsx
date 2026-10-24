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

  const opcao = (ativa: boolean) =>
    `flex min-h-11 cursor-pointer items-center border-2 border-ink px-4 py-2 text-[0.95rem] leading-snug focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--gold)] ${
      ativa ? "bg-ink text-parchment shadow-[3px_3px_0_var(--prelo)]" : "bg-parchment text-ink hover:shadow-[3px_3px_0_var(--prelo)]"
    }`;

  return (
    <section aria-labelledby="como-checar-titulo" id="como-checar" className="cartao no-print scroll-mt-40 p-6 font-sans sm:p-9">
      <p className="rotulo">{s.kicker}</p>
      <h2 id="como-checar-titulo" className="mt-2 font-serif text-[2.2rem] font-medium leading-[1.05] sm:text-5xl">
        {s.title}
      </h2>
      <p className="mt-3 max-w-2xl font-serif text-xl leading-snug text-ink-soft">{s.lead}</p>
      <label className="mt-7 block text-sm font-semibold">
        {s.claim}
        <textarea value={alegacao} onChange={(e) => setAlegacao(e.target.value)} rows={3} maxLength={2000} placeholder={s.claimPlaceholder} className="mt-2 block w-full border-2 border-ink bg-parchment px-4 py-3 font-serif text-lg text-ink outline-none placeholder:text-ink-soft focus:shadow-[4px_4px_0_var(--prelo)]" />
      </label>
      <ol className="mt-8 flex flex-col">
        {s.items.map((item, passo) => (
          <li key={item.q} className="grid grid-cols-[3rem_minmax(0,1fr)] gap-x-4 border-t-2 border-ink py-6 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-x-6">
            <span aria-hidden className={`font-serif text-5xl font-semibold leading-none sm:text-6xl ${respostas[passo] !== null ? "text-ink" : "text-prelo-texto"}`}>
              {passo + 1}
            </span>
            <fieldset className="min-w-0">
              <legend className="font-serif text-[1.45rem] font-semibold leading-tight">
                <span className="sr-only">{passo + 1}. </span>
                {item.q}
              </legend>
              <p className="mt-1.5 leading-snug text-ink-soft">{item.help}</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {item.options.map((texto, i) => (
                  <label key={texto} className={opcao(respostas[passo] === i)}>
                    <input type="radio" name={`passo-${passo}`} className="sr-only" checked={respostas[passo] === i} onChange={() => marcar(passo, i)} />
                    {texto}
                  </label>
                ))}
              </div>
            </fieldset>
          </li>
        ))}
      </ol>
      <div role="status" aria-live="polite" className={resultado ? "cartao-preto p-6 sm:p-7" : "border-2 border-dashed border-ink p-6"}>
        {resultado ? (
          <>
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-[#e0837a]">{s.result}</p>
            <p className="mt-2 font-serif text-2xl leading-snug sm:text-[1.7rem]">{s.results[resultado]}</p>
          </>
        ) : (
          <p className="text-lg text-ink-soft">{s.pending}</p>
        )}
      </div>
      <p className="mt-6 flex flex-wrap items-center gap-4">
        <button type="button" disabled={!resultado} onClick={() => void copiar()} className="botao botao-tinta">
          {copiado ? s.copied : s.copy}
        </button>
        <button
          type="button"
          onClick={() => {
            setAlegacao("");
            setRespostas(s.items.map(() => null));
            setCopiado(false);
          }}
          className="botao botao-papel"
        >
          {s.reset}
        </button>
      </p>
      <p className="mt-4 text-sm text-ink-soft">{s.note}</p>
    </section>
  );
}

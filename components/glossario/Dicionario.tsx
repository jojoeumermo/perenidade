// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { normalize } from "@/lib/text";

interface Resultado {
  palavra: string;
  sentidos?: { classe: string; definicoes: { texto: string }[] }[];
  fonte?: string;
  link?: string;
  licenca?: string;
  erro?: string;
}

/**
 * O dicionário do glossário: qualquer palavra do português, com as definições do Wikcionário (e, quando ele não tem a
 * palavra, do Dicionário Aberto), sempre com a fonte e a licença. A consulta passa pelo próprio site (/api/dicionario):
 * o navegador de quem procura não fala com ninguém de fora. Se a palavra também é termo do glossário, o verbete
 * do instituto aparece junto.
 */
export function Dicionario({ s, termos }: { s: Dict["glossary"]["dict"]; termos: Record<string, { slug: string; term: string }> }) {
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"parado" | "buscando" | "pronto" | "erro">("parado");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  async function procurar(evento: React.FormEvent) {
    evento.preventDefault();
    const palavra = texto.trim();
    if (!palavra) return;
    setEstado("buscando");
    try {
      const resposta = await fetch(`/api/dicionario?lingua=pt&palavra=${encodeURIComponent(palavra)}`);
      const dados = (await resposta.json()) as Resultado;
      setResultado(dados);
      setEstado(dados.erro ? "erro" : "pronto");
    } catch {
      setEstado("erro");
    }
  }

  const doGlossario = resultado ? termos[normalize(resultado.palavra)] : undefined;
  const sentidos = resultado?.sentidos ?? [];

  return (
    <section id="dicionario" aria-labelledby="dicionario-titulo" className="no-print mt-8 scroll-mt-24 border-2 border-ink bg-folha p-5 shadow-[5px_5px_0_var(--sombra)] max-sm:p-4">
      <p className="font-mono text-[0.68rem] uppercase tracking-[0.2em] text-prelo-texto">{s.kicker}</p>
      <h2 id="dicionario-titulo" className="mt-1 font-serif text-2xl font-semibold leading-tight">{s.title}</h2>
      <p className="mt-2 text-ink-soft">{s.lead}</p>
      <form role="search" onSubmit={procurar} className="mt-4 flex border-2 border-ink bg-parchment">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          aria-label={s.label}
          placeholder={s.placeholder}
          maxLength={40}
          lang="pt-BR"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 font-sans text-base outline-none placeholder:text-ink-soft"
        />
        <button type="submit" className="cursor-pointer border-l-2 border-ink bg-ink px-5 font-sans text-sm font-bold uppercase tracking-wide text-parchment">
          {s.button}
        </button>
      </form>
      <div aria-live="polite" className="mt-4">
        {estado === "buscando" && <p className="font-sans text-sm text-ink-soft">{s.loading}</p>}
        {estado === "erro" && <p className="font-sans text-sm text-prelo-texto">{s.error}</p>}
        {estado === "pronto" && resultado && (
          <div lang="pt-BR">
            {doGlossario && (
              <p className="mb-3 border-l-4 border-prelo-texto pl-3 font-sans text-sm">
                {s.inGlossary}{" "}
                <a href={`#${doGlossario.slug}`} className="font-semibold underline underline-offset-4 hover:text-prelo-texto">
                  {doGlossario.term}
                </a>
              </p>
            )}
            {sentidos.length === 0 ? (
              <p className="font-sans text-sm text-ink-soft">{fill(s.none, { p: resultado.palavra })}</p>
            ) : (
              <>
                <h3 className="font-serif text-2xl font-semibold">{resultado.palavra}</h3>
                {sentidos.map((sentido, i) => (
                  <div key={`${sentido.classe}-${i}`} className="mt-3">
                    {sentido.classe && <p className="font-sans text-xs font-bold uppercase tracking-[0.12em] text-ink-soft">{sentido.classe}</p>}
                    <ol className="mt-1 list-decimal space-y-1 pl-6 leading-snug">
                      {sentido.definicoes.map((d, j) => (
                        <li key={j}>{d.texto}</li>
                      ))}
                    </ol>
                  </div>
                ))}
                {resultado.link && (
                  <p className="mt-4 border-t border-rule pt-2 font-mono text-[0.7rem] text-ink-soft">
                    {s.source}:{" "}
                    <a href={resultado.link} target="_blank" rel="noopener noreferrer" className="underline hover:text-prelo-texto">
                      {resultado.fonte}
                    </a>
                    {resultado.licenca && ` · ${s.license} ${resultado.licenca}`}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

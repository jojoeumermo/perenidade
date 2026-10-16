// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import type { Dict } from "@/i18n/types";
import { classes, ErroDeEstatistica, lerNumeros, resumir } from "@/lib/ferramentas/estatistica";
import { ErroDeLogica, tabelaVerdade } from "@/lib/ferramentas/logica";

type T = Dict["tools"];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";
const numero = (lang: string, v: number, casas = 4) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang, { maximumFractionDigits: casas }).format(v);

// ───────────── Estatística ─────────────

export function Estatistica({ s, lang }: { s: T["stats"]; lang: string }) {
  const [texto, setTexto] = useState("7,5; 8; 6; 9,5; 7; 8; 5,5");
  const calculo = useMemo(() => {
    try {
      const numeros = lerNumeros(texto);
      return { r: resumir(numeros), c: classes(numeros) };
    } catch (falha) {
      return falha instanceof ErroDeEstatistica ? (falha.codigo === "numero" ? s.errors.numero.replace("{x}", falha.detalhe) : s.errors.vazio) : s.errors.vazio;
    }
  }, [texto, s]);
  const linhas: [string, string][] =
    typeof calculo === "string"
      ? []
      : [
          [s.n, String(calculo.r.n)],
          [s.sum, numero(lang, calculo.r.soma)],
          [s.mean, numero(lang, calculo.r.media)],
          [s.median, numero(lang, calculo.r.mediana)],
          [s.mode, calculo.r.modas.length ? calculo.r.modas.map((m) => numero(lang, m)).join("; ") : s.noMode],
          [s.min, numero(lang, calculo.r.minimo)],
          [s.max, numero(lang, calculo.r.maximo)],
          [s.range, numero(lang, calculo.r.amplitude)],
          [s.q1, numero(lang, calculo.r.q1)],
          [s.q3, numero(lang, calculo.r.q3)],
          [s.varPop, numero(lang, calculo.r.varianciaPopulacional)],
          [s.sdPop, numero(lang, calculo.r.desvioPopulacional)],
          [s.varSample, calculo.r.varianciaAmostral === null ? "—" : numero(lang, calculo.r.varianciaAmostral)],
          [s.sdSample, calculo.r.desvioAmostral === null ? "—" : numero(lang, calculo.r.desvioAmostral)],
        ];
  const maior = typeof calculo === "string" ? 1 : Math.max(...calculo.c.map((c) => c.vezes));
  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <label className="block">
        {s.numbers}
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder={s.placeholder} spellCheck={false} className={`${field} font-mono`} />
      </label>
      <p className="mt-2 text-ink-soft">{s.help}</p>
      {typeof calculo === "string" ? (
        <p role="status" className="mt-4 text-oxblood">{calculo}</p>
      ) : (
        <>
          <dl className="mt-5 grid gap-x-6 sm:grid-cols-2">
            {linhas.map(([nome, valor]) => (
              <div key={nome} className="flex justify-between gap-4 border-b border-rule py-1.5">
                <dt>{nome}</dt>
                <dd className="font-mono">{valor}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-ink-soft">{s.whichSd}</p>
          <p className="mt-1 text-ink-soft">{s.quartiles}</p>
          <p className={`mt-6 ${rotulo}`}>{s.histogram} · {s.classes}</p>
          <div className="mt-2 space-y-1">
            {calculo.c.map((c, i) => (
              <div key={i} className="grid grid-cols-[9rem_1fr_2rem] items-center gap-2">
                <span className="font-mono text-xs">
                  {numero(lang, c.de, 2)} ⊢ {numero(lang, c.ate, 2)}
                </span>
                <span className="block h-5 bg-oxblood" style={{ width: `${(c.vezes / maior) * 100}%`, minWidth: c.vezes ? 4 : 0 }} />
                <span className="font-mono">{c.vezes}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-soft">{s.classesNote}</p>
        </>
      )}
    </div>
  );
}

// ───────────── Tabela-verdade ─────────────

const TECLAS = ["p", "q", "r", "s", "¬", "∧", "∨", "⊕", "→", "↔", "(", ")"];

export function TabelaVerdade({ s }: { s: T["truth"] }) {
  const [texto, setTexto] = useState("(p → q) ∧ p → q");
  const tabela = useMemo(() => {
    try {
      return tabelaVerdade(texto);
    } catch (falha) {
      return (s.errors as Record<string, string>)[falha instanceof ErroDeLogica ? falha.codigo : "simbolo"];
    }
  }, [texto, s]);
  const vf = (v: boolean) => (v ? s.true : s.false);
  return (
    <div className="mt-8 max-w-3xl font-sans text-sm">
      <label className="block">
        {s.formula}
        <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={s.placeholder} spellCheck={false} autoComplete="off" className={`${field} font-mono text-lg`} />
      </label>
      <p className="mt-2 flex flex-wrap gap-1.5">
        {TECLAS.map((tecla) => (
          <button key={tecla} type="button" onClick={() => setTexto((v) => `${v}${/[a-z()¬]/.test(tecla) ? tecla : ` ${tecla} `}`)} className="min-w-9 cursor-pointer border border-rule bg-parchment-deep px-2 py-1.5 font-mono hover:border-gold">
            {tecla}
          </button>
        ))}
        <button type="button" onClick={() => setTexto("")} className="cursor-pointer border border-rule bg-parchment-deep px-3 py-1.5 hover:border-gold">{s.clear}</button>
      </p>
      <p className="mt-2 text-ink-soft">{s.help}</p>
      {typeof tabela === "string" ? (
        <p role="status" className="mt-4 text-oxblood">{tabela}</p>
      ) : (
        <>
          <p role="status" className="mt-5 border-l-2 border-oxblood pl-3 font-medium">{(s.result as Record<string, string>)[tabela.classificacao]}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="border-collapse text-center font-mono">
              <thead>
                <tr className="border-b-2 border-ink">
                  {tabela.variaveis.map((v) => (
                    <th key={v} scope="col" className="px-3 py-1.5">{v}</th>
                  ))}
                  {tabela.colunas.map((c, i) => (
                    <th key={c} scope="col" className={`px-3 py-1.5 ${i === tabela.colunas.length - 1 ? "bg-parchment-deep" : "font-normal text-ink-soft"}`}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tabela.linhas.map((linha, i) => (
                  <tr key={i} className="border-b border-rule">
                    {linha.valores.map((v, j) => (
                      <td key={j} className="px-3 py-1">{vf(v)}</td>
                    ))}
                    {linha.resultados.map((v, j) => (
                      <td key={j} className={`px-3 py-1 ${j === linha.resultados.length - 1 ? `bg-parchment-deep font-semibold ${v ? "" : "text-oxblood"}` : "text-ink-soft"}`}>{vf(v)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

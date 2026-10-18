// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill, type Locale } from "@/i18n/config";
import { dataCurta, nomeDoMes, reais, type Relatorio } from "@/lib/apoio";
import { hasBackend, rpc } from "@/lib/backend";
import type { Dict } from "@/i18n/types";
import { L } from "../I18n";

/** Gráfico de barras simples (entradas e saídas de cada mês). A tabela logo abaixo diz o mesmo para leitor de tela. */
function Grafico({ relatorios, lang, rotulos }: { relatorios: Relatorio[]; lang: Locale; rotulos: { titulo: string; entradas: string; saidas: string } }) {
  const meses = [...relatorios].reverse().slice(-12);
  const maior = Math.max(1, ...meses.flatMap((r) => [Number(r.dados.total_entradas), Number(r.dados.total_saidas)]));
  const largura = Math.max(320, meses.length * 70);
  return (
    <figure className="mt-6 overflow-x-auto">
      <svg viewBox={`0 0 ${largura} 220`} className="h-56 min-w-full" aria-hidden>
        {meses.map((r, i) => {
          const x = 20 + i * 70;
          const he = (170 * Number(r.dados.total_entradas)) / maior;
          const hs = (170 * Number(r.dados.total_saidas)) / maior;
          return (
            <g key={r.mes}>
              <rect x={x} y={190 - he} width={22} height={he} className="fill-ok" />
              <rect x={x + 26} y={190 - hs} width={22} height={hs} className="fill-oxblood" />
              <text x={x + 24} y={208} textAnchor="middle" className="fill-ink-soft font-mono" fontSize="11">{r.mes.slice(5, 7)}/{r.mes.slice(2, 4)}</text>
            </g>
          );
        })}
        <line x1={10} x2={largura - 10} y1={190} y2={190} className="stroke-rule" />
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-4 font-sans text-sm">
        <span>{rotulos.titulo}:</span>
        <span><span className="mr-1 inline-block h-3 w-3 bg-ok align-middle" aria-hidden />{rotulos.entradas}</span>
        <span><span className="mr-1 inline-block h-3 w-3 bg-oxblood align-middle" aria-hidden />{rotulos.saidas}</span>
      </figcaption>
      <span className="sr-only">{lang}</span>
    </figure>
  );
}

/** A prestação de contas pública: só relatórios publicados, com histórico das correções. Nenhum dado de pessoa. */
export function Contas({ lang, p }: { lang: Locale; p: Dict["support"]["page"] }) {
  const a = p.accounts;
  const [lista, setLista] = useState<Relatorio[] | null>(hasBackend ? null : []);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<Relatorio[]>("apoio_relatorios_publicos")
      .then((r) => vivo && setLista(Array.isArray(r) ? r : []))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, []);
  const r = (v: number) => reais(Number(v), lang);
  if (lista === null) return <p className="mt-8 text-ink-soft" role="status">…</p>;
  if (lista.length === 0) return <p className="mt-8 text-lg text-ink-soft">{a.empty}</p>;
  return (
    <>
      <Grafico relatorios={lista} lang={lang} rotulos={{ titulo: a.chart, entradas: p.income, saidas: p.expenses }} />
      <table className="mt-6 w-full max-w-3xl text-left font-sans">
        <caption className="sr-only">{a.chart}</caption>
        <thead className="text-sm text-ink-soft">
          <tr className="border-b border-rule"><th scope="col" className="py-2 font-normal">{a.month}</th><th scope="col" className="text-right font-normal">{p.income}</th><th scope="col" className="text-right font-normal">{p.expenses}</th><th scope="col" className="text-right font-normal">{p.balance}</th></tr>
        </thead>
        <tbody className="divide-y divide-rule">
          {lista.map((x) => (
            <tr key={x.mes}>
              <th scope="row" className="py-2 font-semibold capitalize">{nomeDoMes(x.mes, lang)}</th>
              <td className="text-right">{r(x.dados.total_entradas)}</td>
              <td className="text-right">{r(x.dados.total_saidas)}</td>
              <td className="text-right font-semibold">{r(x.dados.saldo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-10 space-y-8">
        {lista.map((x) => (
          <article key={x.mes} className="border-t border-rule pt-6" aria-labelledby={`mes-${x.mes}`}>
            <h2 id={`mes-${x.mes}`} className="text-2xl font-semibold capitalize">{nomeDoMes(x.mes, lang)}</h2>
            <p className="font-mono text-xs text-ink-soft">{fill(a.published, { data: dataCurta(x.publicado_em, lang) })}</p>
            <div className="mt-3 grid gap-4 font-sans sm:grid-cols-2">
              {([[a.byIncome, x.dados.entradas], [a.byExpense, x.dados.saidas]] as const).map(([rotulo, grupos]) => (
                <div key={rotulo}>
                  <h3 className="font-semibold">{rotulo}</h3>
                  <ul className="mt-1 text-sm">
                    {Object.entries(grupos).map(([categoria, valor]) => <li key={categoria} className="flex justify-between border-b border-rule py-1"><span lang={lang === "pt" ? undefined : "pt-BR"}>{categoria}</span><span>{r(valor)}</span></li>)}
                    {Object.keys(grupos).length === 0 && <li className="text-ink-soft">—</li>}
                  </ul>
                </div>
              ))}
            </div>
            {x.nota && (
              <p className="mt-3 border-l-4 border-gold pl-3 font-sans text-sm" lang={lang === "pt" ? undefined : "pt-BR"}>
                <span className="font-semibold">{a.note}: </span>{x.nota}
              </p>
            )}
            {(x.historico?.length ?? 0) > 0 && (
              <details className="mt-3 font-sans text-sm">
                <summary className="cursor-pointer underline">{a.corrections} ({x.historico!.length})</summary>
                <ul className="mt-2 space-y-2">
                  {x.historico!.map((h) => (
                    <li key={h.corrigido_em}>
                      <p>{fill(a.corrected, { data: dataCurta(h.corrigido_em, lang), motivo: h.motivo })}</p>
                      <p className="text-ink-soft">{fill(a.previousVersion, { e: r(h.dados.total_entradas), s: r(h.dados.total_saidas), b: r(h.dados.saldo) })}</p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        ))}
      </div>
      <p className="mt-10 font-sans text-sm"><L href="/apoie" className="underline hover:text-oxblood">← {a.back}</L></p>
    </>
  );
}

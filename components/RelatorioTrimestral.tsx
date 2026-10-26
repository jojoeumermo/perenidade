// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill, type Locale } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";

type Numeros = {
  contas: number; voluntarios: number; contribuicoes: number; tarefas: number; nucleos: number; nucleos_ativos: number;
  posts: number; certificados: number; turma: number; contas_meses: number; entradas: number; saidas: number;
};

/** Os trimestres desde o começo do instituto até o atual, do mais novo para o mais velho. */
function trimestres(): { ano: number; tri: number }[] {
  const [ano, mes] = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()).split("-").map(Number);
  const lista = [];
  for (let a = ano, t = Math.ceil(mes / 3); a > 2025 || (a === 2025 && t >= 1); t === 1 ? ((a -= 1), (t = 4)) : (t -= 1)) lista.push({ ano: a, tri: t });
  return lista;
}

/**
 * O relatório do trimestre: o que o instituto fez, em contagens que qualquer pessoa confere. Os números vêm do banco
 * (public.relatorio_trimestral) e nunca trazem nome de ninguém; o dinheiro soma só os meses com relatório publicado.
 */
export function RelatorioTrimestral({ lang, s }: { lang: Locale; s: Dict["relatorio"] }) {
  const opcoes = trimestres();
  const [escolha, setEscolha] = useState(0);
  const [numeros, setNumeros] = useState<Numeros | null>(null);
  const [falhou, setFalhou] = useState(false);
  const { ano, tri } = opcoes[escolha];

  useEffect(() => {
    if (!hasBackend) return;
    let vale = true;
    rpc<Numeros>("relatorio_trimestral", { p_ano: ano, p_tri: tri }).then(
      (r) => vale && (setNumeros(r), setFalhou(false)),
      () => vale && setFalhou(true),
    );
    return () => {
      vale = false;
    };
  }, [ano, tri]);

  const n = (v: number) => new Intl.NumberFormat(lang).format(v);
  const reais = (v: number) => new Intl.NumberFormat(lang, { style: "currency", currency: "BRL" }).format(v);
  const linhas: [keyof Numeros, string][] = [
    ["contas", s.contas], ["voluntarios", s.voluntarios], ["contribuicoes", s.contribuicoes], ["tarefas", s.tarefas],
    ["nucleos", s.nucleos], ["posts", s.posts], ["certificados", s.certificados], ["turma", s.turma],
  ];

  return (
    <div>
      <label className="flex flex-wrap items-center gap-3 font-sans font-semibold">
        {s.escolha}
        <select className="border-2 border-ink bg-parchment px-3 py-2" value={escolha} onChange={(e) => (setNumeros(null), setEscolha(Number(e.target.value)))}>
          {opcoes.map((o, i) => (
            <option key={`${o.ano}-${o.tri}`} value={i}>{fill(s.trimestre, { tri: o.tri, ano: o.ano })}</option>
          ))}
        </select>
      </label>

      {!hasBackend || falhou ? (
        <p className="mt-8 border-l-4 border-gold pl-4 font-serif text-xl">{s.semDados}</p>
      ) : !numeros ? (
        <p className="mt-8 font-sans text-ink-soft">{s.carregando}</p>
      ) : (
        <>
          <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {linhas.map(([chave, rotulo]) => (
              <div key={chave} className="cartao min-w-0 p-4">
                <dt className="font-sans text-sm text-ink-soft">{rotulo}</dt>
                <dd className="mt-1 font-serif text-[2.4rem] font-semibold leading-none">{n(numeros[chave])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 font-sans text-sm text-ink-soft">{fill(s.nucleosAtivos, { n: n(numeros.nucleos_ativos) })}</p>

          <section className="mt-10 border-t-[3px] border-ink pt-5" aria-labelledby="relatorio-dinheiro">
            <h2 id="relatorio-dinheiro" className="font-serif text-2xl font-semibold">{s.dinheiroTitulo}</h2>
            {numeros.contas_meses === 0 ? (
              <p className="mt-3 font-sans text-ink-soft">{s.semContas}</p>
            ) : (
              <>
                <dl className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div><dt className="font-sans text-sm text-ink-soft">{s.entradas}</dt><dd className="font-serif text-3xl font-semibold text-ok">{reais(numeros.entradas)}</dd></div>
                  <div><dt className="font-sans text-sm text-ink-soft">{s.saidas}</dt><dd className="font-serif text-3xl font-semibold text-oxblood">{reais(numeros.saidas)}</dd></div>
                  <div><dt className="font-sans text-sm text-ink-soft">{s.saldo}</dt><dd className="font-serif text-3xl font-semibold">{reais(numeros.entradas - numeros.saidas)}</dd></div>
                </dl>
                <p className="mt-3 font-sans text-sm text-ink-soft">{fill(s.mesesComContas, { n: numeros.contas_meses })}</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}

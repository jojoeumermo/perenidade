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

/** Os semestres desde o começo do instituto até o atual, do mais novo para o mais velho. */
function semestres(): { ano: number; sem: 1 | 2 }[] {
  const [ano, mes] = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date()).split("-").map(Number);
  const lista: { ano: number; sem: 1 | 2 }[] = [];
  for (let a = ano, s: 1 | 2 = mes <= 6 ? 1 : 2; a >= 2025; s === 1 ? ((a -= 1), (s = 2)) : (s = 1)) lista.push({ ano: a, sem: s });
  return lista;
}

/** As contagens que se somam de um trimestre para o outro (os núcleos ativos são os do fim do semestre). */
const SOMAM: (keyof Numeros)[] = ["contas", "voluntarios", "contribuicoes", "tarefas", "nucleos", "posts", "certificados", "turma", "contas_meses", "entradas", "saidas"];

/**
 * O relatório do semestre: o que o instituto fez, em contagens que qualquer pessoa confere. O banco responde por
 * trimestre (public.relatorio_trimestral): cada semestre soma os dois dele, sem mudar nada no banco. Os números nunca
 * trazem nome de ninguém; o dinheiro soma só os meses com relatório publicado.
 */
export function RelatorioSemestral({ lang, s }: { lang: Locale; s: Dict["relatorio"] }) {
  const opcoes = semestres();
  const [escolha, setEscolha] = useState(0);
  const [numeros, setNumeros] = useState<Numeros | null>(null);
  const [falhou, setFalhou] = useState(false);
  const { ano, sem } = opcoes[escolha];

  useEffect(() => {
    if (!hasBackend) return;
    let vale = true;
    const tris = sem === 1 ? [1, 2] : [3, 4];
    Promise.all(tris.map((tri) => rpc<Numeros>("relatorio_trimestral", { p_ano: ano, p_tri: tri }))).then(
      ([primeiro, segundo]) => {
        if (!vale) return;
        const soma = { ...segundo };
        for (const chave of SOMAM) soma[chave] = Number(primeiro[chave]) + Number(segundo[chave]);
        setNumeros(soma);
        setFalhou(false);
      },
      () => vale && setFalhou(true),
    );
    return () => {
      vale = false;
    };
  }, [ano, sem]);

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
            <option key={`${o.ano}-${o.sem}`} value={i}>{fill(s.semestres[o.sem - 1], { ano: o.ano })}</option>
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

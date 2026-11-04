// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "@/components/Link";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import { preencher } from "@/lib/rede/preencher";
import { enderecos } from "@/lib/rede/tipos";
import { enderecosDescoberta, normalizarTag, tagOk, type OrdemDaBusca, type PaginaOrdenada, type ResultadoDaBusca } from "@/lib/rede/tipos-descoberta";
import type { PropsDaTelaDoPacote } from "../registro";
import { ListaOrdenada } from "./ListaOrdenada";
import { useTextosDescoberta } from "./textos";

/**
 * A busca da Rede (/comunidade/buscar?q=): posts, pessoas e comunidades, em português e sem depender de acento. O que aparece
 * já vem filtrado pelo banco (matriz de visibilidade, silenciados, perfil invisível); a tela só mostra.
 */
export default function Buscar({ lang, s, situacao, aoEscrever }: PropsDaTelaDoPacote) {
  const d = useTextosDescoberta(lang);
  const pesquisa = useSearchParams();
  const q = (pesquisa.get("q") ?? "").trim().slice(0, 200);
  const ordemPedida = pesquisa.get("ordem") === "novos" ? "novos" : "relevancia";
  const [achados, setAchados] = useState<{ q: string; r: ResultadoDaBusca } | null>(null);
  if (!d) return <p role="status" className="px-[18px] py-6 font-sans text-ink-soft">{s.estados.carregando}</p>;
  const b = d.buscar;
  const tag = q.startsWith("#") ? normalizarTag(q) : "";
  const r = achados?.q === q ? achados.r : null;
  return (
    <div>
      <header className="border-b border-rule px-[18px] py-4 font-sans">
        <h1 className="font-serif text-2xl font-extrabold">{b.titulo}</h1>
        <form action={`/${lang}/comunidade/buscar`} method="get" role="search" className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor="rede-buscar-q">{b.rotulo}</label>
          <input id="rede-buscar-q" name="q" type="search" defaultValue={q} maxLength={200} placeholder={b.rotulo} className="min-h-11 min-w-0 flex-1 rounded-full border border-rule bg-folha px-4" />
          <button type="submit" className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14]">
            {b.botao}
          </button>
        </form>
        <p className="mt-2 text-xs text-ink-soft">{b.dica}</p>
        {!situacao.logado && <p className="mt-1 text-xs text-ink-soft">{b.visitante}</p>}
        {tagOk(tag) && (
          <Link href={enderecosDescoberta.tag(lang, tag)} className="mt-2 inline-block text-sm font-bold underline">
            {preencher(b.irParaTag, { tag })}
          </Link>
        )}
      </header>

      {q.length === 0 ? null : q.length < 2 ? (
        <p className="px-[18px] py-6 font-sans text-ink-soft">{b.curta}</p>
      ) : (
        <>
          {r && r.so_comuns && <p className="px-[18px] py-4 font-sans text-ink-soft">{b.soComuns}</p>}
          {r && r.pessoas.length > 0 && (
            <section className="border-b border-rule px-[18px] py-3 font-sans" aria-labelledby="busca-pessoas">
              <h2 id="busca-pessoas" className="font-serif text-lg font-semibold">{b.pessoas}</h2>
              <ul className="mt-1 flex flex-wrap gap-2">
                {r.pessoas.map((p) => (
                  <li key={p.handle}>
                    <Link href={enderecos.perfil(lang, p.handle)} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rule px-3 hover:border-ink">
                      <span className="font-bold">{p.codinome}</span>
                      <span className="text-sm text-ink-soft">@{p.handle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {r && r.comunidades.length > 0 && (
            <section className="border-b border-rule px-[18px] py-3 font-sans" aria-labelledby="busca-comunidades">
              <h2 id="busca-comunidades" className="font-serif text-lg font-semibold">{b.comunidades}</h2>
              <ul className="mt-1 flex flex-wrap gap-2">
                {r.comunidades.map((c) => (
                  <li key={c.slug}>
                    <Link href={enderecos.comunidade(lang, c.slug)} className="inline-flex min-h-11 items-center rounded-full border border-rule px-3 font-bold hover:border-ink">
                      {c.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <h2 className="px-[18px] pt-3 font-serif text-lg font-semibold">{b.posts}</h2>
          <ListaOrdenada
            lang={lang}
            s={s}
            d={d}
            logado={situacao.logado}
            chave={`busca:${q}`}
            ordens={["relevancia", "novos"]}
            ordemInicial={ordemPedida}
            carregar={(ordem, cursor) => redeDescoberta.buscar(q, ordem as OrdemDaBusca, cursor)}
            aoPagina={(p: PaginaOrdenada) => setAchados({ q, r: p as ResultadoDaBusca })}
            vazio={b.vazio}
            aoResponder={aoEscrever}
          />
        </>
      )}
    </div>
  );
}

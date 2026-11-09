// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { redeDescoberta } from "@/lib/rede/cliente-descoberta";
import { preencher } from "@/lib/rede/preencher";
import { ORDENS, enderecosDescoberta, tagOk, type Ordem, type PaginaDaTag, type PaginaOrdenada } from "@/lib/rede/tipos-descoberta";
import type { PropsDaTelaDoPacote } from "../registro";
import { ListaOrdenada } from "./ListaOrdenada";
import { useTextosDescoberta } from "./textos";

/** A página de uma hashtag (/alumia/tag/[tag]): os posts que a trazem, na ordem escolhida, só os que a pessoa pode ver. */
export default function Tag({ lang, s, situacao, params, aoEscrever }: PropsDaTelaDoPacote) {
  const d = useTextosDescoberta(lang);
  const tag = params.tag ?? "";
  const [linha, setLinha] = useState<PaginaDaTag["linha"]>(null);
  if (!d) return <p role="status" className="px-[18px] py-6 font-sans text-ink-soft">{s.estados.carregando}</p>;
  if (!tagOk(tag)) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.naoEncontrado}</p>;
  return (
    <div>
      <header className="border-b border-rule px-[18px] py-4 font-sans">
        <h1 className="font-serif text-2xl font-extrabold">{preencher(d.tag.titulo, { tag })}</h1>
        {linha && <p className="mt-1 text-sm text-ink-soft">{preencher(d.tag.regraDaLinha, { titulo: linha.titulo, regra: linha.regra })}</p>}
        <Link href={enderecosDescoberta.explorar(lang)} className="mt-2 inline-block text-sm underline">
          {d.tag.voltar}
        </Link>
      </header>
      <ListaOrdenada
        lang={lang}
        s={s}
        d={d}
        logado={situacao.logado}
        chave={`tag:${tag}`}
        ordens={ORDENS}
        ordemInicial="novos"
        carregar={(ordem, cursor) => redeDescoberta.tag(tag, ordem as Ordem, cursor)}
        aoPagina={(p: PaginaOrdenada) => setLinha((p as PaginaDaTag).linha ?? null)}
        vazio={d.tag.vazio}
        aoResponder={aoEscrever}
      />
    </div>
  );
}

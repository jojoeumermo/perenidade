// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { comunidades } from "@/lib/rede/cliente-comunidades";
import { enderecos } from "@/lib/rede/tipos";
import { enderecosCom, type ItemDaLista, type SituacaoNaComunidade } from "@/lib/rede/tipos-comunidades";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { AcoesDaComunidade } from "./AcoesDaComunidade";
import { erroCom, textosDe, useCarregar } from "./util";

const ORDEM: ItemDaLista["categoria"][] = ["lutas", "disciplinas", "instituto"];

/**
 * A tela "Comunidades" (/comunidade/comunidades): todas as que a pessoa pode ver, em Lutas, Disciplinas e Instituto, com o botão de
 * entrar em cada uma. Visitante vê só as das disciplinas (decisão 2 da ESPEC). Nenhuma contagem de membros: quem é de uma luta
 * pode estar revelando opinião política (LGPD art. 5º, II e art. 11).
 */
export default function Lista({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const sc = textosDe(s);
  const { dado, erro, pronto } = useCarregar(() => comunidades.lista(), "lista");
  const [mudancas, setMudancas] = useState<Record<string, SituacaoNaComunidade>>({});
  if (!sc) return <p className="px-[18px] py-8 font-sans text-ink-soft">{s.estados.emBreve}</p>;
  if (!pronto) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={4} />;
  if (!dado) return <p role="alert" className="px-[18px] py-8 font-sans text-ink-soft">{erro ? erroCom(s, sc, erro) : s.estados.erro}</p>;
  const pode = situacao.logado && situacao.membro;
  const nomes = sc.lista as Record<string, string>;
  return (
    <div className="font-sans">
      <header className="border-b border-rule px-[18px] py-4">
        <h1 className="font-serif text-2xl font-extrabold">{sc.lista.titulo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{sc.lista.intro}</p>
        <p className="mt-3 flex flex-wrap gap-4 text-sm">
          {pode && <Link href={enderecosCom.propor(lang)} className="font-bold underline">{sc.lista.propor}</Link>}
          {pode && <Link href={enderecosCom.nucleos(lang)} className="font-bold underline">{sc.lista.turma}</Link>}
        </p>
      </header>
      {dado.itens.length === 0 && <p className="px-[18px] py-6 text-ink-soft">{sc.lista.vazio}</p>}
      {ORDEM.map((categoria) => {
        const itens = dado.itens.filter((i) => i.categoria === categoria);
        if (itens.length === 0) return null;
        return (
          <section key={categoria} aria-labelledby={`cat-${categoria}`} className="border-b border-rule">
            <h2 id={`cat-${categoria}`} className="px-[18px] pt-4 font-serif text-xl font-semibold">{nomes[categoria]}</h2>
            <ul>
              {itens.map((i) => {
                const atual = i.slug in mudancas ? mudancas[i.slug] : i.situacao;
                return (
                  <li key={i.slug} className="border-t border-rule px-[18px] py-3 first:border-t-0">
                    <Link href={enderecos.comunidade(lang, i.slug)} className="font-bold underline">{i.nome}</Link>
                    {i.descricao && <p className="mt-0.5 text-sm text-ink-soft">{i.descricao}</p>}
                    <p className="mt-0.5 text-xs text-ink-soft">{sc.tipo[i.tipo]}</p>
                    <AcoesDaComunidade slug={i.slug} tipo={i.tipo} situacao={atual} podeEntrar={pode} s={s} sc={sc} aoMudar={(v) => setMudancas((m) => ({ ...m, [i.slug]: v }))} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

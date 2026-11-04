// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useState } from "react";
import { conversa } from "@/lib/rede/cliente-conversa";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { TextosDaConversa } from "@/lib/rede/textos-conversa";
import { enderecos, type Post, type Publico } from "@/lib/rede/tipos";
import type { PedidoDeCitacao } from "@/lib/rede/tipos-conversa";
import { textoDoErro } from "../erros";
import { CampoComMencoes } from "./CampoComMencoes";

const LIMITE = 500;

/**
 * Citar um post: uma caixa logo abaixo dele, sem sair da página. A citação vai para "Membros da Rede", a não ser que o post citado
 * seja de uma comunidade ou da internet: aí ela fica onde ele está. Nada amplia o alcance: quem não pode ver o original vê só
 * "conteúdo restrito". Aceita menções (@). Confirmação dentro da página.
 */
export function Citar({
  post,
  lang,
  s,
  t,
  aoPublicar,
  aoFechar,
}: {
  post: Post;
  lang: string;
  s: TextosDaRede;
  t: TextosDaConversa;
  aoPublicar: (novo: Post) => void;
  aoFechar: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [feito, setFeito] = useState<Post | null>(null);
  const q = t.citar;

  // Onde a citação fica: o mesmo lugar do post citado quando ele é aberto (comunidade ou internet), senão, os membros da Rede.
  const publico: Publico = post.publico === "internet" && post.comunidade ? "internet" : post.publico === "comunidade" && post.comunidade ? "comunidade" : "membros";

  async function enviar() {
    if (ocupado || !texto.trim()) return;
    setOcupado(true);
    setErro("");
    try {
      const pedido: PedidoDeCitacao = { texto: texto.trim(), citar: post.id, publico: publico as PedidoDeCitacao["publico"], comunidade: publico === "membros" ? null : post.comunidade };
      const novo = await conversa.citar(pedido);
      setFeito(novo);
      aoPublicar(novo);
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setOcupado(false);
    }
  }

  if (feito) {
    return (
      <div role="status" className="mt-2 rounded-lg border border-rule bg-folha px-3 py-3 font-sans text-sm">
        <p>{q.publicada}</p>
        <div className="mt-1 flex gap-3">
          <Link href={enderecos.post(lang, feito.id)} className="font-bold underline">
            {q.verPublicada}
          </Link>
          <button type="button" className="min-h-11 cursor-pointer underline" onClick={aoFechar}>
            {s.casca.fechar}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="mt-2 rounded-lg border border-rule bg-folha px-3 py-3 font-sans"
      aria-label={q.titulo}
      onSubmit={(e) => {
        e.preventDefault();
        void enviar();
      }}
    >
      <p className="font-bold">{q.titulo}</p>
      <div className="mt-1">
        <CampoComMencoes
          valor={texto}
          aoMudar={setTexto}
          t={t}
          rotulo={q.titulo}
          placeholder={q.placeholder}
          maxLength={LIMITE}
          className="min-h-24 w-full resize-y rounded-lg border border-rule bg-parchment px-3 py-2 text-base"
          autoFocus
        />
        <span className="mt-1 block text-right text-xs text-ink-soft">{preencher(q.contador, { n: texto.length, max: LIMITE })}</span>
      </div>
      <p className="text-sm text-ink-soft">{preencher(q.quemVe, { publico: s.publicos[publico] })}</p>
      {publico !== "internet" && <p className="text-sm text-ink-soft">{q.restrito}</p>}
      <div className="mt-2 flex gap-2">
        <button type="submit" disabled={ocupado || !texto.trim()} className="min-h-11 cursor-pointer rounded-full bg-[#c21f16] px-5 font-bold text-white hover:bg-[#1f1a14] disabled:cursor-not-allowed disabled:opacity-50">
          {q.enviar}
        </button>
        <button type="button" className="min-h-11 cursor-pointer rounded-full border border-ink px-5 font-bold" onClick={aoFechar}>
          {q.cancelar}
        </button>
      </div>
      {erro && (
        <p role="alert" className="mt-2 text-sm text-oxblood">
          {erro}
        </p>
      )}
    </form>
  );
}

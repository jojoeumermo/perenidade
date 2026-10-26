// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/i18n/types";
import { Forum } from "../Forum";
import { Rede } from "./Rede";

/**
 * A Comunidade com as duas metades da Rede Lúcia: a linha do tempo (Rede) e o fórum de dúvidas, que abre pelo menu da
 * rede e volta para ela pelo alto.
 */
export function ComunidadeComRede({ forum, rede }: { forum: Dict["community"]; rede: Dict["rede"] }) {
  const params = useSearchParams();
  // Quem chega com um tópico, uma sala ou uma aula no endereço vem do fórum; quem chega com um post, da rede.
  const doForum = ["t", "sala", "alvo", "nova"].some((chave) => params.has(chave)) && !params.has("post");
  const [aba, setAba] = useState<"rede" | "forum">(doForum ? "forum" : "rede");
  if (aba === "rede") return <Rede s={rede} abrirForum={() => { setAba("forum"); window.scrollTo({ top: 0 }); }} />;
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4 pb-12">
      <button type="button" onClick={() => setAba("rede")} className="cursor-pointer rounded-full px-3 py-1.5 font-sans text-sm font-bold hover:bg-parchment-deep">
        ← {rede.nome}
      </button>
      <Forum s={forum} />
    </div>
  );
}

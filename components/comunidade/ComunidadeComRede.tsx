// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/i18n/types";
import { ConsertosProvider, useConsertos, type TextosDosConsertos } from "../rede/consertos/contexto";
import { EsqueletoDoForum } from "../rede/consertos/Esqueletos";
import { Rede } from "./Rede";

/** O fórum só baixa quando alguém abre (pelo menu da Rede ou por um endereço de tópico), com um esqueleto no lugar enquanto isso. */
function CarregandoForum() {
  return <EsqueletoDoForum rotulo={useConsertos().forumAbrindo} />;
}
const Forum = dynamic(() => import("../Forum").then((m) => m.Forum), { ssr: false, loading: () => <CarregandoForum /> });

/**
 * A Comunidade com as duas metades da Rede Lúcia: a linha do tempo (Rede) e o fórum de dúvidas, que abre pelo menu da
 * rede e volta para ela pelo alto. `consertos` traz os textos do pacote de consertos (docs/rede/V2.md) em um idioma só.
 */
export function ComunidadeComRede({ forum, rede, consertos }: { forum: Dict["community"]; rede: Dict["rede"]; consertos?: TextosDosConsertos }) {
  const params = useSearchParams();
  // Quem chega com um tópico, uma sala ou uma aula no endereço vem do fórum; quem chega com um post, da rede.
  const doForum = ["t", "sala", "alvo", "nova"].some((chave) => params.has(chave)) && !params.has("post");
  const [aba, setAba] = useState<"rede" | "forum">(doForum ? "forum" : "rede");
  return (
    <ConsertosProvider textos={consertos}>
      {aba === "rede" ? (
        <Rede s={rede} abrirForum={() => { setAba("forum"); window.scrollTo({ top: 0 }); }} />
      ) : (
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-12">
          <button type="button" onClick={() => setAba("rede")} className="cursor-pointer rounded-full px-3 py-1.5 font-sans text-sm font-bold hover:bg-parchment-deep">
            ← {rede.nome}
          </button>
          <Forum s={forum} />
        </div>
      )}
    </ConsertosProvider>
  );
}

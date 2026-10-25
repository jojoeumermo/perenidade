// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/i18n/types";
import { Forum } from "../Forum";
import { Rede } from "./Rede";

/** A Comunidade com as duas metades da Rede Lúcia: a linha do tempo (Rede) e o fórum. */
export function ComunidadeComRede({ forum, rede }: { forum: Dict["community"]; rede: Dict["rede"] }) {
  const params = useSearchParams();
  // Quem chega com um tópico, uma sala ou uma aula no endereço vem do fórum; quem chega com um post, da rede.
  const doForum = ["t", "sala", "alvo"].some((chave) => params.has(chave)) && !params.has("post");
  const [aba, setAba] = useState<"rede" | "forum">(doForum ? "forum" : "rede");
  return (
    <div>
      <p role="tablist" aria-label={rede.nome} className="mt-4 flex gap-1 border-b-2 border-ink">
        {([["rede", rede.abaRede], ["forum", rede.abaForum]] as const).map(([id, nome]) => (
          <button key={id} type="button" role="tab" aria-selected={aba === id} onClick={() => setAba(id)} className={`-mb-0.5 cursor-pointer border-b-4 px-4 py-2 font-sans font-bold ${aba === id ? "border-[#c21f16] text-ink" : "border-transparent text-ink-soft hover:text-ink"}`}>
            {nome}
          </button>
        ))}
      </p>
      {aba === "rede" ? <Rede s={rede} /> : <Forum s={forum} />}
    </div>
  );
}

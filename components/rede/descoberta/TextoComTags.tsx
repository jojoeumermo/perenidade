// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ComponentType } from "react";
import Link from "@/components/Link";
import { enderecosDescoberta, partirComTags } from "@/lib/rede/tipos-descoberta";

/**
 * O texto de um post em que cada #hashtag vira link para a página dela (a mesma regra de hashtag do banco). O que não é tag passa por
 * `Resto` (o cartão usa o componente de menções), para as duas coisas conviverem sem um conhecer o outro.
 */
export function TextoComTags({ texto, lang, Resto }: { texto: string; lang: string; Resto?: ComponentType<{ texto: string; lang: string }> }) {
  return (
    <>
      {partirComTags(texto).map((pedaco, i) =>
        pedaco.tag ? (
          <Link key={i} href={enderecosDescoberta.tag(lang, pedaco.tag)} className="font-bold text-[#c21f16] hover:underline">
            {pedaco.texto}
          </Link>
        ) : (
          Resto ? <Resto key={i} texto={pedaco.texto} lang={lang} /> : <span key={i}>{pedaco.texto}</span>
        ),
      )}
    </>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O pedido de ajuda na conversa (Prompt 4, item 7): o que chegou de dentro do cifrado e ficou no histórico do aparelho por 24 h. Mostra
// a hora e a posição (se veio), com o caminho para o Perto, onde estão o mapa do aparelho e o município mais perto. Nada baixa sozinho.
import Link from "@/components/Link";
import type { CorpoDePosicao } from "@/lib/rede/perto/posicao";
import { useTextosDoPerto } from "./usarTextos";

export function PosicaoNaMensagem({ lang, corpo }: { lang: string; corpo: CorpoDePosicao | null }) {
  const t = useTextosDoPerto(lang);
  if (!t) return <p className="text-sm">…</p>;
  const tem = corpo && corpo.la !== undefined && corpo.lo !== undefined;
  return (
    <div className="text-sm" data-pt-sos="">
      <p className="font-bold">{corpo?.volta ? t.naConversa.sosVolta : t.naConversa.sos}</p>
      <p className="tabular-nums">{tem ? `${corpo!.la}, ${corpo!.lo}` : t.naConversa.semPosicao}</p>
      <Link className="inline-flex min-h-11 items-center underline" href={`/${lang}/alumia/perto`}>{t.naConversa.ver}</Link>
    </div>
  );
}

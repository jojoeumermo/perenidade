// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { RevisaoPrivada } from "@/components/podcast/Revisao";

export const metadata: Metadata = { title: "Revisão de episódio", robots: { index: false, follow: false } };

/** Rascunho de episódio aberto pelo link privado de revisão. Não aparece em busca nem na lista do site. */
export default function Revisao() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-gold">Podcast · revisão</p>
      <RevisaoPrivada />
    </div>
  );
}

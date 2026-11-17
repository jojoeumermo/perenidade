// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { textosDaRede, tituloDaTela } from "@/lib/rede/textos";
import { ligado } from "@/lib/recursos";

// Gerada a cada pedido: no endereço próprio do chat (lib/rede/chat/origem.ts), cada resposta leva um "nonce" novo na política de
// scripts, e o Next só o aplica aos scripts dele em página feita na hora.
export const dynamic = "force-dynamic";

/** As conversas são de cada pessoa: a página não é indexada, não é gerada de antemão e não leva nada nos metadados. */
export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  if (!ligado("rede-v2")) return {};
  const { lang } = await loadLang(params);
  return { title: tituloDaTela(lang, "conversas"), robots: { index: false, follow: false } };
}

/** Conversas da Alumia (/alumia/conversas): o chat privado, cifrado de ponta a ponta (docs/rede/CHAT-PRIVADO.md). Com o recurso "rede-v2" desligado, 404. */
export default async function Pagina({ params }: { params: Promise<{ lang: string }> }) {
  if (!ligado("rede-v2")) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "conversas" }} />
      </Suspense>
    </div>
  );
}

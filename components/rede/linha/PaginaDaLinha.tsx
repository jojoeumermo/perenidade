// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { loadLang } from "@/i18n";
import { ligado } from "@/lib/recursos";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import { textosDaRede } from "@/lib/rede/textos";
import { carregarTextosDaLinha } from "@/lib/rede/textos-linha";

type Tela = "linhas" | "como-a-linha";

/** As duas páginas da linha com regra aberta só existem com a Alumia nova e o interruptor "alumia-linha-aberta" ligados. */
const ligada = (): boolean => alumia2Ligada() && ligado("alumia-linha-aberta");

/** Os metadados: só o nome da tela e da rede. Nenhuma das duas é indexada (ficam atrás da entrada da Alumia). */
export async function metadadosDaLinha(tela: Tela, params: Promise<{ lang: string }>): Promise<Metadata> {
  if (!ligada()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaLinha(lang);
  return { title: `${tela === "linhas" ? t.linhas.titulo : t.regra.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** A página: 404 com o interruptor desligado; ligado, a casca da Alumia com a tela registrada em components/rede/registro.tsx. */
export async function PaginaDaLinha({ tela, params }: { tela: Tela; params: Promise<{ lang: string }> }) {
  if (!ligada()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: tela }} />
      </Suspense>
    </div>
  );
}

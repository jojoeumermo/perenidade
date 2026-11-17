// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { estudoLigado } from "@/components/rede/estudo/turma/ligado";
import { carregarTextosDaTurma } from "@/components/rede/estudo/turma/textos";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";

/** A página é de cada pessoa: não é indexada e não leva nada da conta nos metadados. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/turmas">): Promise<Metadata> {
  if (!estudoLigado()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaTurma(lang);
  return { title: `${t.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** As turmas de estudo (/alumia/turmas; ?codigo=… preenche o código do convite). Frente 11C. A tela é a do registro (nome "turmas"). */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/turmas">) {
  if (!estudoLigado()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "turmas" }} />
      </Suspense>
    </div>
  );
}

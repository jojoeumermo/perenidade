// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { RedeSobDemanda } from "@/components/rede/RedeSobDemanda";
import { estudoLigado } from "@/components/rede/estudo/turma/ligado";
import { carregarTextosDaAgenda } from "@/components/rede/estudo/agenda/textos";
import { loadLang } from "@/i18n";
import { textosDaRede } from "@/lib/rede/textos";

/** A página é de cada pessoa: não é indexada e não leva nada da conta nos metadados. */
export async function generateMetadata({ params }: PageProps<"/[lang]/alumia/agenda">): Promise<Metadata> {
  if (!estudoLigado()) return {};
  const { lang } = await loadLang(params);
  const t = await carregarTextosDaAgenda(lang);
  return { title: `${t.titulo} · ${textosDaRede(lang).marca}`, robots: { index: false, follow: false } };
}

/** A agenda de estudo: provas e monitoria (/alumia/agenda; ?aba=monitoria abre na segunda). Frente 11C. A tela é a do registro (nome "agenda"). */
export default async function Pagina({ params }: PageProps<"/[lang]/alumia/agenda">) {
  if (!estudoLigado()) notFound();
  const { lang } = await loadLang(params);
  return (
    <div className="pb-8">
      <Suspense>
        <RedeSobDemanda lang={lang} s={textosDaRede(lang)} tela={{ tipo: "pacote", nome: "agenda" }} />
      </Suspense>
    </div>
  );
}

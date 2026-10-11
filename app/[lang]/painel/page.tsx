// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { Painel } from "@/components/painel/Painel";
import { loadLang } from "@/i18n";

export const metadata: Metadata = { title: "Painel", robots: { index: false } };

// A mesa de trabalho da equipe existe só em português, em qualquer idioma do site.
export default async function PaginaDoPainel({ params }: PageProps<"/[lang]/painel">) {
  await loadLang(params);
  return (
    <div className="mx-auto max-w-5xl px-4 py-12" lang="pt-BR">
      <PageHeading eyebrow="Quem faz o instituto" title="Painel" />
      <Suspense>
        <Painel />
      </Suspense>
    </div>
  );
}

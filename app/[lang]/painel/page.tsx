// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Suspense } from "react";
import { Painel } from "@/components/painel/Painel";
import { loadLang } from "@/i18n";

export const metadata: Metadata = { title: "Coordenação", robots: { index: false, follow: false } };

// O ambiente de trabalho da equipe ocupa a tela inteira e existe só em português, em qualquer idioma do site.
export default async function PaginaDoPainel({ params }: PageProps<"/[lang]/painel">) {
  await loadLang(params);
  return (
    <div lang="pt-BR">
      <Suspense>
        <Painel />
      </Suspense>
    </div>
  );
}

import { Suspense } from "react";
import { PageHeading } from "@/components/PageHeading";
import { SearchClient } from "@/components/SearchClient";

export const metadata = { title: "Buscar", description: "Busca em todas as aulas, trilhas e obras do acervo." };

export default function Busca() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <PageHeading eyebrow="Todo o acervo" title="Buscar">
        Procura no texto completo das aulas e nas fichas das obras. Acentos e maiúsculas não importam.
      </PageHeading>
      <Suspense>
        <SearchClient />
      </Suspense>
    </div>
  );
}

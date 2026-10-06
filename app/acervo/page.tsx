import { Suspense } from "react";
import { AcervoBrowser } from "@/components/AcervoBrowser";
import { PageHeading } from "@/components/PageHeading";
import { getBooks } from "@/lib/content";

export const metadata = {
  title: "Acervo",
  description: "Índice de obras em domínio público e licenças abertas, com link para a fonte legítima de cada uma.",
};

export default function Acervo() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow="Índice de obras" title="Acervo">
        Apenas metadados e links para fontes legítimas. Não hospedamos arquivos de terceiros.
      </PageHeading>
      <Suspense>
        <AcervoBrowser books={getBooks()} />
      </Suspense>
    </div>
  );
}

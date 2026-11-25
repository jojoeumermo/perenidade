// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Suspense } from "react";
import { SearchClient } from "@/components/SearchClient";
import { loadLang } from "@/i18n";

/** A busca no aplicativo: mesmos dados e mesma lógica da busca do site; aulas e trilhas abrem no leitor do app. */
export default async function BuscaDoApp({ params }: PageProps<"/[lang]/app/estudar/buscar">) {
  const { t } = await loadLang(params);
  return (
    <div className="app-hub app-busca-tela">
      <header className="app-hub-cabeca">
        <h1>{t.search.title}</h1>
        <p>{t.search.lead}</p>
      </header>
      <Suspense>
        <SearchClient app />
      </Suspense>
    </div>
  );
}

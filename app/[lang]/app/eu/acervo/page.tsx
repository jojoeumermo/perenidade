// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Suspense } from "react";
import { AcervoBrowser } from "@/components/AcervoBrowser";
import { I18nProvider } from "@/components/I18n";
import { loadLang } from "@/i18n";
import { pickSections } from "@/i18n/core";
import { getBooks, obraNaEstante } from "@/lib/content";
import { fileHistory } from "@/lib/history";

// Mesma ordem fixa das Novidades do site: obras do mesmo dia não saem em ordem alfabética.
const misturar = (id: string) => [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * O acervo dentro do aplicativo (aba Eu): título e apresentação, depois a estante com busca e filtros (o mesmo
 * componente do site). Abrir uma obra ainda leva à página dela no site: pendência registrada.
 */
export default async function AcervoDoApp({ params }: PageProps<"/[lang]/app/eu/acervo">) {
  const { lang, t } = await loadLang(params);
  const books = getBooks(lang);
  const novidades = books
    .map((b) => ({ id: b.id, data: fileHistory(b.file).updated ?? "" }))
    .filter((x) => x.data)
    .sort((a, b) => b.data.localeCompare(a.data) || misturar(a.id) - misturar(b.id))
    .slice(0, 24)
    .map((x) => x.id);
  return (
    <div className="app-hub app-acervo-tela">
      <header className="app-hub-cabeca">
        <h1>{t.library.title}</h1>
        <p>{t.library.lead}</p>
      </header>
      <div className="app-acervo-corpo">
        <Suspense>
          <I18nProvider lang={lang} t={pickSections(t, ["areas"])}>
            <AcervoBrowser books={books.map(obraNaEstante)} novidades={novidades} />
          </I18nProvider>
        </Suspense>
      </div>
    </div>
  );
}

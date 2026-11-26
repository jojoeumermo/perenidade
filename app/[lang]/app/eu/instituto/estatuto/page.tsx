// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { Acessibilidade, Estatuto } from "@/components/instituto/Estatuto";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { localePath } from "@/i18n/config";

/**
 * O estatuto (carta de funcionamento, 13 artigos) e a acessibilidade dentro do aplicativo (Eu → Instituto). O texto é o
 * mesmo componente da página do site; só a moldura é do app.
 */
export default async function EstatutoDoApp({ params }: PageProps<"/[lang]/app/eu/instituto/estatuto">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="app-hub app-estatuto-tela" lang="pt-BR">
      <header className="app-hub-cabeca">
        <h1>Estatuto</h1>
        <p>A carta de funcionamento do Instituto, artigo por artigo.</p>
      </header>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <div className="app-estatuto-corpo">
        <Estatuto />
        <Acessibilidade href={localePath(lang, "/relatar-erro")} />
      </div>
    </div>
  );
}

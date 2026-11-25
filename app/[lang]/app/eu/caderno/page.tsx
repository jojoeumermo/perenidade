// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { CadernoDeEstudos } from "@/components/caderno/Caderno";
import { loadLang } from "@/i18n";

/** O caderno de estudos dentro do aplicativo (aba Eu): as mesmas ferramentas do site, com a moldura e a volta do app. */
export default async function CadernoDoApp({ params }: PageProps<"/[lang]/app/eu/caderno">) {
  const { t } = await loadLang(params);
  return (
    <div className="app-hub app-caderno-tela">
      <header className="app-hub-cabeca">
        <h1>{t.notebook.title}</h1>
        <p>{t.notebook.lead}</p>
      </header>
      <CadernoDeEstudos s={t.notebook} />
    </div>
  );
}

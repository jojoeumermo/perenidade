// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { SalaLivre } from "@/components/SalaLivre";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";

export async function generateMetadata({ params }: PageProps<"/[lang]/sala-livre">): Promise<Metadata> {
  const { lang, t } = await loadLang(params);
  return paginaMeta(lang, "/sala-livre", t.nav.freeRoom, t.salaLivre.description);
}

/** A Sala livre: para professores, educadores e instrutores montarem e projetarem a própria aula com tudo do site. */
export default async function SalaLivrePage({ params }: PageProps<"/[lang]/sala-livre">) {
  const { lang, t } = await loadLang(params);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <Cartaz eyebrow="Para professores, educadores e instrutores" title="Sala livre" slogan="A sua aula, com tudo o que é nosso" tone="vermelho">
        Monte a sua aula com tudo o que o instituto oferece (laboratórios, livros do acervo, editores de foto, vídeo e 3D, escritório, simulações, jogos e testes) e projete na sala. As salas ficam só no seu navegador; para levar a outro computador, baixe o arquivo.
      </Cartaz>
      <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      <div lang="pt-BR">
        <SalaLivre />
      </div>
    </div>
  );
}

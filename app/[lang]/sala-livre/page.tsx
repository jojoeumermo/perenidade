// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { Cartaz } from "@/components/Cartaz";
import { ComoFunciona } from "@/components/ComoFunciona";
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
        {/* A Sala livre só existe em português, como o resto desta página. */}
        <ComoFunciona
          s={{
            title: "Como montar e dar a sua aula",
            steps: [
              ["Escolha um modelo", "Aula com laboratório, modelo e previsão, rotação por estações, debate regrado, roda de leitura, simulação de ciências, oficina de criação ou uma sala em branco."],
              ["Monte as telas", "Ponha nelas o que o instituto tem: laboratórios, livros do acervo, editores de foto, vídeo e 3D, escritório, simulações, jogos e testes."],
              ["Projete", "Uma tela por vez, com as setas, tela cheia e tela preta (B). O modo apresentador abre uma segunda janela com as notas, a próxima tela e o relógio."],
              ["Leve para a sala", "Temporizador, sorteio de nomes, grupos e placar, e o quadro para riscar por cima. A sala fica no seu navegador: para usar em outro computador, baixe o arquivo."],
            ],
          }}
        />
      </div>
    </div>
  );
}

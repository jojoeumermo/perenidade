// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import GithubSlugger from "github-slugger";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Markdown } from "@/components/Markdown";
import { PageHeading } from "@/components/PageHeading";
import { Untranslated } from "@/components/Untranslated";
import { loadLang } from "@/i18n";
import { parseFrontmatter } from "@/lib/frontmatter";
import { ligado } from "@/lib/recursos";
import { paginaMeta } from "@/lib/seo";
import { textosDoEstudo } from "@/lib/textos-estudo";

const ler = (arquivo: string) => fs.readFileSync(path.join(process.cwd(), arquivo), "utf8");

/** O documento sem o título (#) do topo, que vem desta página, e com os subtítulos um nível abaixo (## vira ###). */
const semTitulo = (texto: string) => texto.replace(/^#\s+.+\n+/, "").replace(/^(#{2,5}) /gm, "#$1 ");

/**
 * Página pública: só o que serve a quem escreve e revisa. Saem as seções de registro técnico (cabeçalho YAML, campos
 * internos) e toda linha com comando ou caminho do repositório (npm run, content/, docs/, lib/), que ficam só em docs/.
 */
const SECOES_INTERNAS = /^(#{2,6})\s+(\d+\.\s*)?(Registrar|Revisão e créditos)/;
function paraOPublico(texto: string) {
  const saida: string[] = [];
  let pulando = 0;
  for (const linha of texto.split("\n")) {
    const titulo = /^(#{2,6})\s/.exec(linha);
    if (titulo) {
      if (pulando && titulo[1].length <= pulando) pulando = 0;
      if (!pulando && SECOES_INTERNAS.test(linha)) {
        pulando = titulo[1].length;
        continue;
      }
    }
    if (pulando) continue;
    if (/npm run|`(content|docs|lib|scripts)\//.test(linha)) continue;
    saida.push(linha);
  }
  return saida.join("\n");
}

/**
 * Os títulos de um nível, com o mesmo id que o rehype-slug dá na página: ele numera todos os títulos em ordem, então
 * todos passam pelo slugger e só os do nível pedido ficam. Blocos de código (o esqueleto do modelo) não contam.
 */
function titulos(texto: string, nivel: number): { id: string; titulo: string }[] {
  const slugger = new GithubSlugger();
  return texto
    .replace(/```[\s\S]*?```/g, "")
    .split("\n")
    .flatMap((linha) => {
      const achado = /^(#{1,6})\s+(.+)$/.exec(linha);
      if (!achado) return [];
      const titulo = achado[2].replace(/[*_`]/g, "").trim();
      const id = slugger.slug(titulo);
      return achado[1].length === nivel ? [{ id, titulo }] : [];
    });
}

export async function generateMetadata({ params }: PageProps<"/[lang]/contribuir/guia">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  return paginaMeta(lang, "/contribuir/guia", s.guia.titulo, s.guia.descricao);
}

/**
 * Guia de contribuição (recurso "guia-contribuir"): as cinco formas de ajudar e o caminho de uma contribuição
 * (content/contribuir/guia.md), mais o modelo de aula e o checklist de revisão, lidos dos próprios documentos de
 * docs/ para nunca haver duas versões. Desligado, a página não existe.
 */
export default async function Page({ params }: PageProps<"/[lang]/contribuir/guia">) {
  if (!ligado("guia-contribuir")) notFound();
  const { lang, t } = await loadLang(params);
  const { s } = textosDoEstudo(lang);
  const guia = parseFrontmatter(ler("content/contribuir/guia.md"));
  const titulo = typeof guia.data.titulo === "string" ? guia.data.titulo : s.guia.titulo;
  const resumo = typeof guia.data.resumo === "string" ? guia.data.resumo : s.guia.descricao;
  const textoDoGuia = paraOPublico(guia.content);
  const textoDoModelo = paraOPublico(semTitulo(ler("docs/MODELO-DE-AULA.md")));
  const textoDaRevisao = paraOPublico(semTitulo(ler("docs/CHECKLIST-DE-REVISAO.md")));
  const capitulos = [
    { id: "como-ajudar", nome: s.guia.comoAjudar, secoes: titulos(textoDoGuia, 2) },
    { id: "modelo", nome: s.guia.modelo, secoes: titulos(textoDoModelo, 3) },
    { id: "revisar", nome: s.guia.checklist, secoes: titulos(textoDaRevisao, 3) },
  ];
  const sumario = (
    <ol className="grid gap-4 font-sans text-sm">
      {capitulos.map((capitulo, i) => (
        <li key={capitulo.id}>
          <a href={`#${capitulo.id}`} className="flex items-baseline gap-2 font-bold hover:text-oxblood">
            <span className="font-mono text-xs text-prelo-texto">{i + 1}</span>
            {capitulo.nome}
          </a>
          {capitulo.secoes.length > 0 && (
            <ul className="mt-1.5 grid gap-1 border-l-2 border-rule pl-3" lang="pt-BR">
              {capitulo.secoes.map((secao) => (
                <li key={secao.id}>
                  <a href={`#${secao.id}`} className="text-ink-soft hover:text-oxblood">
                    {secao.titulo}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ol>
  );
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <div>
        <PageHeading eyebrow={s.guia.olho} title={titulo}>
          {resumo}
        </PageHeading>
        <Untranslated lang={lang} t={t} show={lang !== "pt"} />
      </div>
      <div className="mt-10 grid gap-10 lg:grid-cols-[15rem_minmax(0,1fr)]">
        {/* O sumário: fixo ao lado no computador; no celular, recolhido no alto. */}
        <nav aria-label={s.guia.nestaPagina} className="no-print">
          <details className="cartao p-4 lg:hidden">
            <summary className="cursor-pointer font-sans text-sm font-bold">{s.guia.nestaPagina}</summary>
            <div className="mt-4">{sumario}</div>
          </details>
          <div className="sticky top-24 hidden max-h-[calc(100vh-7rem)] overflow-y-auto lg:block">
            <p className="mb-4 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">{s.guia.nestaPagina}</p>
            {sumario}
          </div>
        </nav>
        <div className="min-w-0 max-w-3xl">
          {capitulos.map((capitulo, i) => (
            <section key={capitulo.id} id={capitulo.id} aria-labelledby={`${capitulo.id}-titulo`} className={`scroll-mt-24 ${i ? "mt-16" : ""}`} lang="pt-BR">
              <h2 id={`${capitulo.id}-titulo`} className="guia-capitulo">
                <span className="guia-capitulo-numero">{i + 1}</span>
                <span lang={lang === "pt" ? undefined : "pt-BR"}>{capitulo.nome}</span>
              </h2>
              <div className="mt-6">
                <Markdown lang={lang}>{[textoDoGuia, textoDoModelo, textoDaRevisao][i]}</Markdown>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

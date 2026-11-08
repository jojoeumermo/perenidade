// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { AberturaDaEscola, ReverAbertura, type TrechoPublicado } from "@/components/escola/AberturaDaEscola";
import { CartaoLuciaMaria } from "@/components/escola/CartaoLuciaMaria";
import { CartazDaFrente } from "@/components/escola/frente/CartazDaFrente";
import { aberturaDoQuemFoi } from "@/lib/escola/quem-foi";
import { QuemVolta } from "@/components/escola/QuemVolta";
import Link from "@/components/Link";
import { loadLang } from "@/i18n";
import { localePath, type Locale } from "@/i18n/config";
import { textosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { textosDaFrente } from "@/i18n/escola/frente";
import { parseFrontmatter } from "@/lib/frontmatter";
import { aulasDoAparelho, cursosDoAparelho, textosDaMatricula, textosDaPresenca } from "@/lib/escola/matricula-servidor";
import { mapaDaEscola } from "@/lib/escola/rotas";
import { calendarioProposto } from "@/lib/escola/tempo";
import { textosDaBusca } from "@/lib/escola/textos-da-busca";
import { textosDaBase, trechoDoQuemSomos } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

// Cada leitura escreve a pasta no próprio caminho: um caminho montado só com partes soltas faz o rastreio de arquivos da
// Vercel levar o projeto inteiro nesta função (scripts/conferir-rastreio.mjs).
const ler = (leitura: () => string) => {
  try {
    return leitura();
  } catch {
    return null;
  }
};

/** Só o 1º parágrafo de content/escola/quem-foi-lucia-maria.md (sem Markdown), para o 2º quadro da abertura. */
const textoDeLucia = () => aberturaDoQuemFoi(parseFrontmatter(ler(() => fs.readFileSync(path.join(process.cwd(), "content", "escola", "quem-foi-lucia-maria.md"), "utf8")) ?? "").content.trim());

/**
 * "Por que a escola existe": trecho copiado do "Quem somos" já publicado no idioma da página. Sem versão publicada
 * neste idioma, o original em português, com o aviso "(texto em português)". Nada é traduzido por conta própria.
 */
function trechoPublicado(lang: Locale): TrechoPublicado | null {
  const traduzido = lang === "pt" ? null : ler(() => fs.readFileSync(path.join(process.cwd(), "content", "paginas", `quem-somos.${lang}.md`), "utf8"));
  const noIdioma = traduzido ? trechoDoQuemSomos(traduzido) : null;
  if (noIdioma) return { texto: noIdioma, idioma: lang, emPortugues: false };
  const original = trechoDoQuemSomos(ler(() => fs.readFileSync(path.join(process.cwd(), "content", "paginas", "quem-somos.md"), "utf8")) ?? "");
  return original ? { texto: original, idioma: "pt", emPortugues: lang !== "pt" } : null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/escola">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  return paginaMeta(lang, "/escola", s.meta.titulo, s.meta.descricao);
}

const LINKS_DOS_PASSOS = ["/escola/matricula", "/escola/cursos", "/escola/turmas", "/escola/vida/tarefas", "/escola/formatura"];

/**
 * O nome e a frase curta de cada página no mapa da entrada. O nome vem de i18n/escola/base ("paginas"; "Quem foi"
 * vem da faixa). A frase vem de onde ela já está escrita nos 6 idiomas: a busca da Escola (i18n/escola/busca), a
 * matrícula (carteirinha e plano) e a avaliação (provas e saberes). Nenhum texto novo repetido.
 */
function itemDoMapa(lang: Locale, chave: string): { nome: string; texto: string } {
  const s = textosDaBase(lang);
  const i = textosDaBusca(lang).indice as Record<string, string>;
  const m = textosDaMatricula(lang).meta;
  const a = textosDaAvaliacao(lang);
  const f = textosDaFrente(lang).mapa;
  const nome = chave === "quemFoi" ? s.nav.quemFoi : ((s.paginas as Record<string, string>)[chave] ?? chave);
  const daBusca = i[`${chave === "educador-do-mes" ? "educadorDoMes" : chave}Texto`];
  const outros: Record<string, string> = { carteirinha: m.carteirinha.descricao, plano: m.plano.descricao, provas: a.semana.lead, saberes: a.saberes.lead, militantes: f.militantesTexto, manifesto: f.manifestoTexto };
  return { nome, texto: daBusca ?? outros[chave] ?? "" };
}

/**
 * A entrada da Escola Revolucionária Lúcia Maria, em ordem de leitura: o cartaz (T15), com a Frente Revolucionária
 * Lúcia em destaque, o nome, o lema, a linha da Escola e o chamado de voluntários militantes; o que é e quem foi Lúcia Maria, lado a lado; por onde começar (a matrícula, para quem chega; o plano
 * e o curso, para quem volta); como funciona, em 5 passos; e o mapa de tudo o que tem na Escola, por assunto, com as
 * páginas que não cabem na faixa do alto (vozes, lutas, assembleia, ouvidoria, provas, saberes, agentes...).
 */
export default async function Escola({ params }: PageProps<"/[lang]/escola">) {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  const e = s.entrada;
  const m = textosDaMatricula(lang);
  const cursos = cursosDoAparelho();
  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-4">
      {/* 1) O cartaz (T15): a Frente Revolucionária Lúcia, o nome da Escola, o lema, a linha e o chamado de militantes. */}
      <CartazDaFrente lang={lang} s={textosDaFrente(lang).cartaz} olho={e.olho} titulo={e.titulo} linha={e.linhaNaoUniversidade} />

      {/* 2) O que é, e o primeiro item: quem foi Lúcia Maria. */}
      <div className="mt-10 grid items-start gap-8 md:grid-cols-[3fr_2fr]">
        <section aria-labelledby="o-que-e">
          <h2 id="o-que-e" className="text-3xl font-semibold">
            {e.oQueE}
          </h2>
          <p className="mt-3 text-lg leading-relaxed">{e.oQueETexto}</p>
          <p className="mt-3 font-sans text-sm text-ink-soft">{e.contaTexto}</p>
        </section>
        <div className="[&>a]:mt-0">
          <CartaoLuciaMaria lang={lang} s={s.cartao} />
        </div>
      </div>

      {/* 3) Por onde começar (E4-08): quem chega vê o convite da matrícula; quem volta, a carteirinha, o plano e o curso. */}
      <QuemVolta s={m.quemVolta} comum={m.comum} sPresenca={textosDaPresenca(lang)} cursos={cursos} aulas={aulasDoAparelho(lang, cursos)} nomeDaCarteirinha={m.carteirinha.estudante} lang={lang} />

      {/* 4) Como funciona, em 5 passos. */}
      <section className="mt-12" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-3xl font-semibold">
          {e.comoFunciona}
        </h2>
        <ol className="mt-5 grid gap-3 font-sans sm:grid-cols-2 lg:grid-cols-3">
          {e.passos.map((passo, n) => (
            <li key={passo.titulo}>
              <Link href={localePath(lang, LINKS_DOS_PASSOS[n])} className="flex h-full gap-4 border border-rule bg-parchment-deep p-4 hover:border-oxblood">
                <span aria-hidden className="font-mono text-2xl text-gold">
                  {n + 1}
                </span>
                <span>
                  <span className="block font-serif text-xl font-semibold">{passo.titulo}</span>
                  <span className="mt-1 block text-sm text-ink-soft">{passo.texto}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* 5) O mapa: tudo o que tem na Escola, por assunto (lib/escola/rotas.ts, "grupo"). */}
      <section className="mt-14 border-t-2 border-ink pt-8" aria-labelledby="mapa-da-escola" data-mapa-da-escola="">
        <h2 id="mapa-da-escola" className="text-3xl font-semibold">
          {e.mapaTitulo}
        </h2>
        <p className="mt-2 font-sans text-ink-soft">{e.mapaLead}</p>
        <div className="mt-6 grid gap-x-8 gap-y-8 font-sans sm:grid-cols-2 lg:grid-cols-3">
          {mapaDaEscola().map(({ grupo, rotas }) => (
            <section key={grupo} aria-labelledby={`grupo-${grupo}`}>
              <h3 id={`grupo-${grupo}`} className="rotulo border-b border-rule pb-2">
                {s.mapa.grupos[grupo]}
              </h3>
              <ul className="mt-2 grid">
                {rotas.map((r) => {
                  const item = itemDoMapa(lang, r.chave);
                  return (
                    <li key={r.chave}>
                      <Link href={localePath(lang, r.caminho)} className="group block py-2">
                        <span className="block font-semibold group-hover:text-oxblood">{item.nome}</span>
                        {item.texto && <span className="mt-0.5 block text-sm text-ink-soft">{item.texto}</span>}
                        {r.chave === "calendario" && calendarioProposto() && <span className="mt-1 block text-xs italic text-ink-soft">{s.calendario.proposto}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <p className="mt-10">
        <ReverAbertura texto={e.rever} />
      </p>
      <AberturaDaEscola lang={lang} s={s.abertura} textoDeLucia={textoDeLucia()} trecho={trechoPublicado(lang)} />
    </div>
  );
}

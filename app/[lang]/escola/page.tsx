// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { AberturaDaEscola, ReverAbertura, type TrechoPublicado } from "@/components/escola/AberturaDaEscola";
import { CartaoLuciaMaria } from "@/components/escola/CartaoLuciaMaria";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { localePath, type Locale } from "@/i18n/config";
import { parseFrontmatter } from "@/lib/frontmatter";
import { calendarioProposto } from "@/lib/escola/tempo";
import { textosDaBase, trechoDoQuemSomos } from "@/lib/escola/textos";
import { paginaMeta } from "@/lib/seo";

const ler = (...partes: string[]) => {
  try {
    return fs.readFileSync(path.join(process.cwd(), ...partes), "utf8");
  } catch {
    return null;
  }
};

/** O marcador (ou, quando chegar, o texto) de content/escola/quem-foi-lucia-maria.md, para o 2º quadro da abertura. */
const textoDeLucia = () => parseFrontmatter(ler("content", "escola", "quem-foi-lucia-maria.md") ?? "").content.trim();

/**
 * "Por que a escola existe": trecho copiado do "Quem somos" já publicado no idioma da página. Sem versão publicada
 * neste idioma, o original em português, com o aviso "(texto em português)". Nada é traduzido por conta própria.
 */
function trechoPublicado(lang: Locale): TrechoPublicado | null {
  const traduzido = lang === "pt" ? null : ler("content", "paginas", `quem-somos.${lang}.md`);
  const noIdioma = traduzido ? trechoDoQuemSomos(traduzido) : null;
  if (noIdioma) return { texto: noIdioma, idioma: lang, emPortugues: false };
  const original = trechoDoQuemSomos(ler("content", "paginas", "quem-somos.md") ?? "");
  return original ? { texto: original, idioma: "pt", emPortugues: lang !== "pt" } : null;
}

export async function generateMetadata({ params }: PageProps<"/[lang]/escola">): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  return paginaMeta(lang, "/escola", s.meta.titulo, s.meta.descricao);
}

const LINKS_DOS_PASSOS = ["/escola/matricula", "/escola/cursos", "/escola/turmas", "/escola/cursos", "/escola/formatura"];

/** A entrada da Escola Lúcia Maria. A ordem é a do plano: título e linha honesta, Lúcia Maria, como funciona, quem volta e o campus. */
export default async function Escola({ params }: PageProps<"/[lang]/escola">) {
  const { lang } = await loadLang(params);
  const s = textosDaBase(lang);
  const e = s.entrada;
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      {/* 1) Título e a linha honesta: não é universidade e não dá diploma. */}
      <PageHeading eyebrow={e.olho} title={e.titulo}>
        {e.linhaNaoUniversidade}
      </PageHeading>

      {/* 2) O primeiro item: quem foi Lúcia Maria. */}
      <CartaoLuciaMaria lang={lang} s={s.cartao} />

      {/* 3) Como funciona, em 5 passos. */}
      <section className="mt-12" aria-labelledby="como-funciona">
        <h2 id="como-funciona" className="text-3xl font-semibold">
          {e.comoFunciona}
        </h2>
        <ol className="mt-5 grid gap-3 font-sans sm:grid-cols-2">
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

      {/* E4-08: quem volta */}

      {/* 5) Pela Escola: campus e calendário. */}
      <section className="mt-12" aria-labelledby="pela-escola">
        <h2 id="pela-escola" className="text-3xl font-semibold">
          {e.pelaEscola}
        </h2>
        <ul className="mt-5 grid gap-3 font-sans sm:grid-cols-2">
          <li>
            <Link href={localePath(lang, "/escola/campus")} className="block h-full border border-rule p-4 hover:border-oxblood">
              <span className="block font-serif text-xl font-semibold">{s.nav.campus}</span>
              <span className="mt-1 block text-sm text-ink-soft">{e.campusTexto}</span>
            </Link>
          </li>
          <li>
            <Link href={localePath(lang, "/escola/calendario")} className="block h-full border border-rule p-4 hover:border-oxblood">
              <span className="block font-serif text-xl font-semibold">{s.nav.calendario}</span>
              <span className="mt-1 block text-sm text-ink-soft">{e.calendarioTexto}</span>
              {calendarioProposto() && <span className="mt-2 block text-xs italic text-ink-soft">{s.calendario.proposto}</span>}
            </Link>
          </li>
        </ul>
      </section>

      <p className="mt-10">
        <ReverAbertura texto={e.rever} />
      </p>
      <AberturaDaEscola lang={lang} s={s.abertura} textoDeLucia={textoDeLucia()} trecho={trechoPublicado(lang)} />
    </div>
  );
}

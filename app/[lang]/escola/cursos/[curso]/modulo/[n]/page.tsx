// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RetornoDoModulo } from "@/components/escola/avaliacao/RetornoPorCompetencia";
import Link from "@/components/Link";
import { PageHeading } from "@/components/PageHeading";
import { loadLang } from "@/i18n";
import { fill, localePath } from "@/i18n/config";
import { textosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { carregarCursos, cursoPorSlug } from "@/lib/escola/cursos-servidor";
import { verCurso } from "@/lib/escola/cursos-vista";
import { paginaMeta } from "@/lib/seo";
import "@/styles/escola-avaliacao.css";

type Props = PageProps<"/[lang]/escola/cursos/[curso]/modulo/[n]">;

// Cada módulo de cada curso sai na montagem; módulo ou curso que não existe dá 404 sem ler nada em tempo de execução.
export const dynamicParams = false;

export function generateStaticParams() {
  return carregarCursos().flatMap((c) => c.modulos.map((_, i) => ({ curso: c.slug, n: String(i + 1) })));
}

/** O curso e o módulo (n começa em 1) do endereço, ou null. */
async function doEndereco(params: Props["params"]) {
  const { curso: slug, n } = await params;
  const curso = cursoPorSlug(slug);
  const indice = /^\d+$/.test(n) ? Number(n) - 1 : -1;
  if (!curso || indice < 0 || indice >= curso.modulos.length) return null;
  return { curso, indice };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const achado = await doEndereco(params);
  if (!achado) return {};
  const { curso, indice } = achado;
  const s = textosDaAvaliacao(lang).modulo;
  // O retorno é de cada pessoa (lido no aparelho): a página não entra na busca.
  return { ...paginaMeta(lang, `/escola/cursos/${curso.slug}/modulo/${indice + 1}`, `${curso.modulos[indice].titulo} · ${curso.titulo}`, s.lead), robots: { index: false } };
}

/**
 * O módulo de um curso (E4-13, R1-30): as aulas do módulo e o retorno por competência que junta os testes de fim de
 * aula e os exercícios dessas aulas feitos no aparelho, sem nota e sem número, com os links para rever e para o
 * próximo módulo.
 */
export default async function ModuloDoCurso({ params }: Props) {
  const { lang } = await loadLang(params);
  const achado = await doEndereco(params);
  if (!achado) notFound();
  const { curso, indice } = achado;
  const sa = textosDaAvaliacao(lang);
  const s = sa.modulo;
  const visto = verCurso(curso);
  const modulo = visto.modulos[indice];
  const total = visto.modulos.length;
  const aulas = modulo.aulas.map((a) => a.id);
  const titulos = Object.fromEntries(modulo.aulas.map((a) => [a.id, a.titulo]));
  const para = (n: number) => localePath(lang, `/escola/cursos/${curso.slug}/modulo/${n}`);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12" data-modulo-do-curso={`${curso.slug}/${indice + 1}`}>
      <PageHeading eyebrow={fill(s.olho, { n: indice + 1, total })} title={modulo.titulo} voltar={{ href: localePath(lang, `/escola/cursos/${curso.slug}`), texto: `${s.voltar}: ${curso.titulo}` }}>
        <span>{s.lead}</span>
      </PageHeading>
      {lang !== "pt" && <p className="mt-3 font-sans text-sm text-ink-soft">{s.conteudoEmPortugues}</p>}

      <RetornoDoModulo aulas={aulas} titulos={titulos} s={sa.retorno} />

      <section className="mt-10" aria-labelledby="aulas-do-modulo">
        <h2 id="aulas-do-modulo" className="rotulo">
          {s.aulas}
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-6 font-sans">
          {modulo.aulas.map((a) => (
            <li key={a.id}>
              <Link href={localePath(lang, a.caminho)} className="font-semibold underline hover:text-oxblood" lang="pt">
                {a.titulo}
              </Link>
              <span className="text-sm text-ink-soft" lang="pt">
                {" "}
                · {a.trilha}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {modulo.pratica && modulo.pratica.length > 0 && (
        <section className="mt-10" aria-labelledby="pratica-do-modulo">
          <h2 id="pratica-do-modulo" className="rotulo">
            {s.pratica}
          </h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 font-sans" lang="pt">
            {modulo.pratica.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      )}

      <nav className="navegacao-do-modulo no-print" aria-label={curso.titulo}>
        {indice > 0 ? (
          <Link href={para(indice)} className="underline hover:text-oxblood">
            ← {s.anterior}: <span lang="pt">{visto.modulos[indice - 1].titulo}</span>
          </Link>
        ) : (
          <span />
        )}
        {indice < total - 1 ? (
          <Link href={para(indice + 2)} className="text-right font-semibold underline hover:text-oxblood" data-proximo-modulo="">
            {s.proximo}: <span lang="pt">{visto.modulos[indice + 1].titulo}</span> →
          </Link>
        ) : (
          <span className="text-ink-soft">{s.ultimo}</span>
        )}
      </nav>
    </div>
  );
}

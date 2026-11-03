// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import type { PatronoVisto } from "@/lib/escola/cursos-vista";

/**
 * O patrono do curso: uma pessoa do Memorial cuja ficha mostra ligação com o tema. O motivo é uma frase tirada da
 * própria ficha. Enquanto a coordenação não confirmar, aparece "Patrono proposto, a confirmar pela coordenação".
 */
export function Patrono({ lang, patrono, s }: { lang: Locale; patrono: PatronoVisto; s: TextosDosCursos["patrono"] }) {
  const anos = patrono.nascimento === "—" ? patrono.morte : `${patrono.nascimento} – ${patrono.morte}`;
  return (
    <section className="patrono-do-curso" aria-labelledby="patrono-do-curso" data-patrono={patrono.slug}>
      <h2 id="patrono-do-curso" className="rotulo">
        {s.titulo}
      </h2>
      <p className="mt-2 font-serif text-2xl font-semibold">
        {patrono.nome} <span className="font-sans text-base font-normal text-ink-soft">({anos})</span>
      </p>
      {!patrono.confirmado && <p className="selo-em-revisao mt-2 inline-block">{s.proposto}</p>}
      <blockquote className="mt-3 border-l-4 border-rule pl-3" lang="pt">
        <p className="font-serif italic">{patrono.motivo}</p>
        <footer className="mt-1 font-sans text-xs text-ink-soft">{s.motivo}</footer>
      </blockquote>
      <p className="mt-3 font-sans text-sm">
        <Link href={`${localePath(lang, "/memorial")}#${patrono.slug}`} className="font-semibold underline hover:text-oxblood">
          {s.memorial} →
        </Link>
      </p>
    </section>
  );
}

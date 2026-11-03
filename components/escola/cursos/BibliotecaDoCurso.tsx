// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { fill, localePath, type Locale } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import type { ObraDaBiblioteca } from "@/lib/escola/cursos-vista";

/**
 * A biblioteca do curso: só obras do Acervo citadas nas fontes das aulas do curso, na ordem de leitura, com o "porque"
 * tirado da sinopse da própria ficha e a licença de cada obra. Obra com direitos reservados: só a ficha e o link da
 * fonte legal (a página da obra na editora ou na biblioteca, como no Acervo).
 */
export function BibliotecaDoCurso({ lang, obras, s }: { lang: Locale; obras: ObraDaBiblioteca[]; s: TextosDosCursos["biblioteca"] }) {
  if (!obras.length) return null;
  return (
    <section className="biblioteca-do-curso" aria-labelledby="biblioteca-do-curso">
      <h2 id="biblioteca-do-curso" className="text-3xl font-semibold">
        {s.titulo}
      </h2>
      <p className="mt-1 font-sans text-ink-soft">{s.texto}</p>
      <ol className="biblioteca-lista">
        {obras.map((o) => {
          const reservada = o.licenca === "Direitos reservados";
          return (
            <li key={o.obra} data-obra={o.obra} data-reservada={reservada || undefined}>
              <p className="font-serif text-xl font-semibold" lang="pt">
                <span className="biblioteca-ordem" aria-hidden>
                  {o.ordem}.
                </span>{" "}
                {o.titulo}
              </p>
              <p className="font-sans text-sm text-ink-soft" lang="pt">
                {o.autor}
                {o.ano ? ` · ${o.ano}` : ""}
              </p>
              <p className="mt-1 font-sans text-sm">
                <span className="biblioteca-licenca">{fill(s.licenca, { licenca: o.licenca })}</span>
              </p>
              <p className="mt-2 text-[0.95rem]">
                <span className="font-sans text-xs font-semibold uppercase tracking-wider text-ink-soft">{s.porque}: </span>
                <span lang="pt">{o.porque}</span>
              </p>
              {reservada && <p className="mt-1 font-sans text-sm italic text-ink-soft">{s.reservados}</p>}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
                <Link href={localePath(lang, `/acervo/${o.obra}`)} className="font-semibold underline hover:text-oxblood">
                  {s.ficha}
                </Link>
                <a href={o.url} rel="noopener noreferrer" target="_blank" className="underline hover:text-oxblood">
                  {fill(s.fonte, { fonte: o.fonte })} ↗
                </a>
                {o.guiada && (
                  <Link href={localePath(lang, `/escola/leituras/${o.obra}`)} className="font-semibold text-oxblood underline">
                    {s.guiada} →
                  </Link>
                )}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

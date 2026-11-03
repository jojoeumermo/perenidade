// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { fill, localePath, type Locale } from "@/i18n/config";
import type { CursoDoAparelho, SugestaoDeCurso, Sugestoes } from "@/lib/escola/matricula";
import type { TextosDoFluxo } from "./PerguntaDeVida";

type S = TextosDoFluxo["sugestao"];

function CartaoDoCurso({ sugestao, curso, marcado, alternar, s, lang, semMotivo = false }: { sugestao: SugestaoDeCurso; curso: CursoDoAparelho; marcado: boolean; alternar: () => void; s: S; lang: Locale; semMotivo?: boolean }) {
  const formato = new Intl.NumberFormat(lang, { maximumFractionDigits: 1 });
  const id = `sugestao-${curso.slug}`;
  return (
    <li className={`border-2 bg-parchment p-4 ${marcado ? "border-ink" : "border-rule"}`} data-sugestao={curso.slug}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input id={id} type="checkbox" checked={marcado} onChange={alternar} className="mt-1.5 h-6 w-6 flex-none accent-[var(--oxblood)]" aria-describedby={semMotivo ? undefined : `${id}-motivo`} />
        <span className="min-w-0">
          <span className="block font-serif text-2xl font-semibold leading-tight">{curso.titulo}</span>
          {!semMotivo && (
            <span id={`${id}-motivo`} className="mt-1 block font-mono text-xs uppercase tracking-[0.14em] text-oxblood">
              {s.motivo[sugestao.motivo]}
            </span>
          )}
          {curso.resumo && <span className="mt-2 block text-ink-soft">{curso.resumo}</span>}
          {curso.horas > 0 && !sugestao.comeceDoModulo1 && <span className="mt-2 block text-sm">{fill(s.horas, { horas: formato.format(curso.horas) })}</span>}
          {sugestao.comeceDoModulo1 && <span className="mt-2 block border-l-4 border-gold pl-3 text-sm">{fill(s.modulo1, { horas: formato.format(curso.horas) })}</span>}
          {sugestao.nivelado && <span className="mt-2 block text-sm text-ink-soft">{s.nivelado}</span>}
        </span>
      </label>
      <p className="mt-3 pl-9 text-sm">
        <Link href={localePath(lang, `/escola/cursos/${curso.slug}`)} className="underline hover:text-oxblood">
          {s.verCurso} →
        </Link>
      </p>
    </li>
  );
}

/**
 * Os cursos sugeridos pela matrícula (lib/escola/matricula.ts: sugerirCursos), de 1 a 3, com caixa de marcar: a
 * pessoa entra em quantos quiser (nenhum também vale). O "aprender a estudar", se existir, vem à parte, "antes de um
 * curso longo, se quiser". Sem cursos, diz que estão sendo montados.
 */
export function SugestaoDeCursos({
  sugestoes,
  cursos,
  escolhidos,
  alternar,
  s,
  lang,
}: {
  sugestoes: Sugestoes;
  cursos: readonly CursoDoAparelho[];
  escolhidos: readonly string[];
  alternar: (slug: string) => void;
  s: S;
  lang: Locale;
}) {
  const porSlug = new Map(cursos.map((c) => [c.slug, c]));
  const lista = sugestoes.cursos.filter((x) => porSlug.has(x.slug));
  const antes = sugestoes.antes && porSlug.get(sugestoes.antes.slug);
  if (lista.length === 0 && !antes) return <p className="mt-5 border border-rule bg-parchment-deep p-4 font-sans">{s.semCursos}</p>;
  return (
    <div className="mt-5 font-sans">
      {lista.length > 0 && (
        <ul className="grid gap-3">
          {lista.map((x) => (
            <CartaoDoCurso key={x.slug} sugestao={x} curso={porSlug.get(x.slug)!} marcado={escolhidos.includes(x.slug)} alternar={() => alternar(x.slug)} s={s} lang={lang} />
          ))}
        </ul>
      )}
      {antes && sugestoes.antes && (
        <div className="mt-6">
          <h3 className="font-serif text-xl font-semibold">{s.antes}</h3>
          <ul className="mt-3 grid gap-3">
            <CartaoDoCurso sugestao={sugestoes.antes} curso={antes} marcado={escolhidos.includes(antes.slug)} alternar={() => alternar(antes.slug)} s={s} lang={lang} semMotivo />
          </ul>
        </div>
      )}
      {escolhidos.length === 0 && <p className="mt-4 text-sm text-ink-soft">{s.nenhumMarcado}</p>}
    </div>
  );
}

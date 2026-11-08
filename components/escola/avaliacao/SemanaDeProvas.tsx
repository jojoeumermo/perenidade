// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { L } from "@/components/I18n";
import { useInscricoes } from "@/components/escola/guardado-escola";
import { baixar } from "@/components/estudo/guardado";
import { fill } from "@/i18n/config";
import type { TextosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { icsDaSemanaDeProvas, semanaParaMostrar } from "@/lib/escola/avaliacao";
import { calendarioProposto, hojeEmBrasilia } from "@/lib/escola/tempo";
import { useHydrated } from "@/lib/storage";

export interface TrilhaDoCurso {
  slug: string;
  titulo: string;
  /** A trilha tem a rota /prova (10 questões ou mais)? */
  prova: boolean;
}

export interface CursoDaSemana {
  slug: string;
  titulo: string;
  trilhas: TrilhaDoCurso[];
}

/**
 * A semana de provas solidária (E4-13, D1-8), lida no aparelho: a data vem de semanaDeProvas (lib/escola/tempo.ts) e
 * é calculada no navegador, porque a página é montada uma vez só. Fora da semana, mostra a data; dentro, as provas
 * das trilhas dos cursos em que a pessoa entrou, sozinho ou em dupla. Sem placar, sem comparação, sem nota.
 */
export function SemanaDeProvas({ cursos, idioma, endereco, s }: { cursos: CursoDaSemana[]; idioma: string; endereco: string; s: TextosDaAvaliacao["semana"] }) {
  const hidratado = useHydrated();
  const inscricoes = useInscricoes();
  if (!hidratado) return null;

  const dia = hojeEmBrasilia(new Date());
  const semana = semanaParaMostrar(dia);
  const data = (d: string) => new Intl.DateTimeFormat(idioma, { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
  const meus = cursos.filter((c) => inscricoes.some((i) => i.curso === c.slug && !i.trancadoEm));
  const dispensas = (curso: string) => inscricoes.find((i) => i.curso === curso)?.dispensas ?? [];
  const lembrete = () =>
    baixar(
      `semana-de-provas-${semana.semestre}.ics`,
      icsDaSemanaDeProvas({ inicio: semana.inicio, fim: semana.fim, semestre: semana.semestre, titulo: s.lembreteTitulo, descricao: s.lembreteDescricao, url: endereco }),
      "text/calendar;charset=utf-8",
    );

  return (
    <div data-semana-de-provas={semana.quando}>
      <div className="semana-de-provas-data" data-quando={semana.quando}>
        <p>{fill(semana.quando === "durante" ? s.durante : s.antes, { inicio: data(semana.inicio), fim: data(semana.fim) })}</p>
        {calendarioProposto() && <p className="mt-2 font-sans text-sm text-ink-soft">{s.proposto}</p>}
        {semana.quando === "antes" && <p className="mt-2 font-sans text-sm">{s.fora}</p>}
        <p className="mt-3">
          <button type="button" onClick={lembrete} className="botao botao-tinta botao-menor">
            {s.lembrete}
          </button>
        </p>
      </div>

      {semana.quando === "durante" && (
        <section className="mt-10 font-sans" aria-labelledby="provas-dos-cursos">
          <h2 id="provas-dos-cursos" className="font-serif text-2xl font-semibold">
            {s.provasTitulo}
          </h2>
          {meus.length === 0 ? (
            <p className="mt-2">
              {s.semInscricao}{" "}
              <L href="/cursos" className="font-semibold underline hover:text-oxblood">
                {s.verCursos} →
              </L>
            </p>
          ) : (
            meus.map((c) => {
              const comProva = c.trilhas.filter((t) => t.prova);
              return (
                <div key={c.slug} className="provas-do-curso" data-provas-do-curso={c.slug}>
                  <h3 className="font-semibold" lang="pt">
                    {c.titulo}
                  </h3>
                  {comProva.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-soft">{s.semProva}</p>
                  ) : (
                    <ul>
                      {comProva.map((t) => (
                        <li key={t.slug} className="prova-da-trilha" data-prova-da-trilha={t.slug}>
                          <span lang="pt">
                            {t.titulo}
                            {dispensas(c.slug).includes(t.slug) && <span className="ml-2 text-sm font-normal text-ink-soft">({s.dispensada})</span>}
                          </span>
                          <L href={`/trilhas/${t.slug}/prova`} className="underline hover:text-oxblood">
                            {s.sozinho}
                          </L>
                          <L href={`/trilhas/${t.slug}/prova?modo=dupla`} className="font-semibold underline hover:text-oxblood">
                            {s.emDupla}
                          </L>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-2 text-sm">
                    <L href={`/cursos/${c.slug}/modulo/1`} className="underline hover:text-oxblood">
                      {s.modulos} →
                    </L>
                  </p>
                </div>
              );
            })
          )}
        </section>
      )}

      {semana.quando === "antes" && meus.length > 0 && (
        <section className="mt-10 font-sans" aria-label={s.modulos}>
          <ul className="space-y-1">
            {meus.map((c) => (
              <li key={c.slug}>
                <L href={`/cursos/${c.slug}/modulo/1`} className="underline hover:text-oxblood">
                  {s.modulos}: <span lang="pt">{c.titulo}</span>
                </L>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

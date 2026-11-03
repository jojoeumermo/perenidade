// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useInscricoes } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import { trilhaDe } from "@/lib/escola/cursos";
import { useCompleted } from "@/lib/progress";
import { L } from "../../I18n";

export interface AulaDaGrade {
  id: string;
  titulo: string;
  trilha: string;
  caminho: string;
  minutos: number;
}

export interface ModuloDaGrade {
  titulo: string;
  aulas: AulaDaGrade[];
  pratica?: string[];
}

/**
 * A grade do curso: os módulos e as aulas, na ordem, com "feita" (aula concluída neste aparelho) e "dispensada" (a
 * trilha foi dispensada na inscrição). No formato alternância, cada módulo mostra o tempo escola (as aulas) e o tempo
 * trabalho (as tarefas práticas, marcadas "em revisão"). No servidor e na hidratação nada aparece marcado: as marcas
 * chegam no primeiro efeito, lidas só do aparelho.
 */
export function GradeDoCurso({ slug, modulos, alternancia, s, emRevisao }: { slug: string; modulos: ModuloDaGrade[]; alternancia: boolean; s: TextosDosCursos["grade"]; emRevisao: string }) {
  const feitas = useCompleted();
  const inscricao = useInscricoes().find((i) => i.curso === slug);
  const dispensas = inscricao?.dispensas ?? [];
  const todas = modulos.flatMap((m) => m.aulas);
  const nFeitas = todas.filter((a) => feitas.has(a.id) || dispensas.includes(trilhaDe(a.id))).length;

  return (
    <section className="grade-do-curso" aria-labelledby="grade-do-curso">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="grade-do-curso" className="text-3xl font-semibold">
          {s.titulo}
        </h2>
        <p className="font-sans text-sm text-ink-soft" data-progresso-da-grade>
          {fill(s.progresso, { feitas: nFeitas, total: todas.length })}
        </p>
      </div>
      <ol className="grade-modulos">
        {modulos.map((m, i) => (
          <li key={m.titulo} className="grade-modulo">
            <h3 className="grade-modulo-titulo">
              <span className="rotulo">{fill(s.modulo, { n: i + 1 })}</span>
              <span className="block font-serif text-2xl font-semibold" lang="pt">
                {m.titulo}
              </span>
            </h3>
            <L href={`/escola/cursos/${slug}/modulo/${i + 1}`} className="font-sans text-sm underline">
              {s.retornoDoModulo}
            </L>
            {alternancia && <p className="grade-tempo">{s.tempoEscola}</p>}
            <ol className="grade-aulas">
              {m.aulas.map((a) => {
                const dispensada = dispensas.includes(trilhaDe(a.id));
                const feita = !dispensada && feitas.has(a.id);
                return (
                  <li key={a.id} data-aula={a.id} data-feita={feita || undefined} data-dispensada={dispensada || undefined}>
                    <L href={a.caminho} className="grade-aula">
                      <span className="grade-aula-marca" aria-hidden>
                        {feita ? "✓" : dispensada ? "–" : ""}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="grade-aula-titulo" lang="pt">
                          {a.titulo}
                        </span>
                        <span className="grade-aula-trilha" lang="pt">
                          {a.trilha}
                        </span>
                      </span>
                      <span className="grade-aula-dados">
                        {fill(s.minutos, { n: a.minutos })}
                        {feita && <span className="grade-selo">{s.feita}</span>}
                        {dispensada && <span className="grade-selo">{s.dispensada}</span>}
                      </span>
                    </L>
                  </li>
                );
              })}
            </ol>
            {m.pratica && m.pratica.length > 0 && (
              <div className="grade-pratica">
                <p className="grade-tempo">
                  {alternancia ? s.tempoTrabalho : s.pratica} <span className="selo-em-revisao">{emRevisao}</span>
                </p>
                {alternancia && <p className="mt-1 text-sm text-ink-soft">{s.tempoTrabalhoAviso}</p>}
                <ul className="mt-2 list-disc space-y-1.5 pl-5" lang="pt">
                  {m.pratica.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

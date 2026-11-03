// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useInscricoes } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import { horasFeitas } from "@/lib/escola/cursos";
import { useCompleted } from "@/lib/progress";

/**
 * "32 de 60 horas": as horas estimadas das aulas feitas neste aparelho (lucia:concluidas) e das trilhas dispensadas na
 * inscrição, sobre o total do curso. A conta é a do E4-01 (horasFeitas, lib/escola/cursos.ts); o selo diz que é
 * estimativa. Começa em zero no servidor e na hidratação.
 */
export function HorasDoCurso({ slug, aulas, minutos, total, idioma, s }: { slug: string; aulas: string[]; minutos: number[]; total: number; idioma: string; s: TextosDosCursos["horas"] }) {
  const feitas = useCompleted();
  const dispensas = useInscricoes().find((i) => i.curso === slug)?.dispensas ?? [];
  const porAula = new Map(aulas.map((a, i) => [a, minutos[i] ?? 0]));
  const curso = { modulos: [{ titulo: "", aulas }] };
  const horas = horasFeitas(curso, feitas, dispensas, (a) => porAula.get(a) ?? 0);
  const fmt = new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 });
  const parte = total > 0 ? Math.min(100, Math.round((horas / total) * 100)) : 0;
  return (
    <section className="horas-do-curso" aria-labelledby="horas-do-curso">
      <h2 id="horas-do-curso" className="rotulo">
        {s.titulo}
      </h2>
      <p className="horas-do-curso-conta" data-horas-feitas={horas}>
        {fill(s.conta, { feitas: fmt.format(horas), total: fmt.format(total) })}
      </p>
      <div className="horas-do-curso-barra" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={parte} aria-label={s.titulo}>
        <span style={{ width: `${parte}%` }} />
      </div>
      <p className="selo-estimativa">{s.selo}</p>
      <p className="mt-1 text-xs text-ink-soft">{s.noAparelho}</p>
    </section>
  );
}

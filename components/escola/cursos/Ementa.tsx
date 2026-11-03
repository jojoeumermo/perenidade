// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { fill } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import type { Source } from "@/lib/content";
import type { CursoVisto, ObraDaBiblioteca } from "@/lib/escola/cursos-vista";
import { ImprimirEmenta } from "./ImprimirEmenta";

/**
 * A ementa do curso, no formato de programa de disciplina de escola pública: Objetivo; Conteúdo (módulos e aulas, com
 * minutos); Avaliação; Bibliografia (as fontes das aulas, sem repetir, e as leituras da biblioteca); Requisitos; Carga
 * horária estimada. Fica num <details> na tela e sai sozinha no papel com "Imprimir ementa". O conteúdo é em português.
 */
export function Ementa({ visto, bibliografia, biblioteca, requisitos, horas, s }: { visto: CursoVisto; bibliografia: Source[]; biblioteca: ObraDaBiblioteca[]; requisitos: string[]; horas: string; s: TextosDosCursos["ementa"] }) {
  const { curso } = visto;
  const alvo = `ementa-${curso.slug}`;
  // As obras da biblioteca vêm primeiro; a mesma obra citada como fonte de uma aula não se repete.
  const limpa = (u?: string) => (u ?? "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/(index\.html?)?$/, "").toLowerCase();
  const daBiblioteca = new Set(biblioteca.map((o) => limpa(o.url)));
  const fontes = bibliografia.filter((f) => !f.url || !daBiblioteca.has(limpa(f.url)));
  return (
    <section className="ementa-do-curso" aria-labelledby={`${alvo}-titulo`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${alvo}-titulo`} className="text-3xl font-semibold">
          {s.titulo}
        </h2>
        <ImprimirEmenta texto={s.imprimir} alvo={alvo} />
      </div>
      <details id={alvo} className="ementa" data-ementa="">
        <summary className="no-print">{s.abrir}</summary>
        <div className="ementa-folha">
          <h3 className="ementa-cabeca" lang="pt">
            {curso.titulo}
          </h3>

          <h4>{s.objetivo}</h4>
          <p lang="pt">{curso.objetivo}</p>

          <h4>{s.conteudo}</h4>
          <p className="ementa-nota">{fill(s.total, { n: visto.nAulas, min: visto.minutos })}</p>
          <ol className="ementa-modulos" lang="pt">
            {visto.modulos.map((m) => (
              <li key={m.titulo}>
                <p className="font-semibold">
                  {m.titulo} <span className="font-normal text-ink-soft">({m.minutos} min)</span>
                </p>
                <ol className="ementa-aulas">
                  {m.aulas.map((a) => (
                    <li key={a.id}>
                      {a.titulo} <span className="text-ink-soft">· {a.trilha} · {a.minutos} min</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>

          <h4>{s.avaliacao}</h4>
          <p>{s.avaliacaoTexto}</p>

          <h4>{s.bibliografia}</h4>
          <p className="ementa-nota">{s.bibliografiaTexto}</p>
          <ul className="ementa-bibliografia" lang="pt">
            {biblioteca.map((o) => (
              <li key={`obra-${o.obra}`}>
                {o.autor}. <i>{o.titulo}</i>
                {o.ano ? `, ${o.ano}` : ""}. {o.fonte}.
              </li>
            ))}
            {fontes.map((f, i) => (
              <li key={`${i}-${f.title}`}>
                {f.author ? `${f.author}. ` : ""}
                <i>{f.title}</i>
                {f.year ? `, ${f.year}` : ""}.
                {f.url && (
                  <>
                    {" "}
                    <span className="ementa-url">{f.url}</span>
                  </>
                )}
              </li>
            ))}
          </ul>

          <h4>{s.requisitos}</h4>
          <p lang={requisitos.length ? "pt" : undefined}>{requisitos.length ? requisitos.join("; ") : s.nenhum}</p>

          <h4>{s.carga}</h4>
          <p>{fill(s.cargaTexto, { h: horas, s: curso.semanas })}</p>
          <p className="ementa-nota">{s.naoOficial}</p>
        </div>
      </details>
    </section>
  );
}

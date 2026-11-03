// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import type { Ciclo, Formato } from "@/lib/escola/cursos";
import type { Objetivo } from "@/lib/escola/estudante";
import { L } from "../../I18n";

/** O cartão de um curso no catálogo (montado no servidor). */
export interface CartaoDoCurso {
  slug: string;
  titulo: string;
  resumo: string;
  ciclo: Ciclo;
  formato: Formato;
  /** O grupo de disciplinas da área do curso (lib/areas.ts), para o filtro. */
  grupo: string;
  objetivos: Objetivo[];
  /** Horas estimadas, já escritas no formato do idioma ("4,5"). */
  horas: string;
  semanas: number;
  nAulas: number;
  patrono?: string;
  /** Títulos dos cursos que vêm antes. */
  requisitos: string[];
}

export interface TextosDoCatalogo {
  catalogo: TextosDosCursos["catalogo"];
  ciclos: TextosDosCursos["ciclos"];
  formatos: TextosDosCursos["formatos"];
  objetivos: TextosDosCursos["objetivos"];
}

const CICLOS: Ciclo[] = ["basico", "profissional", "avancado"];

/**
 * O catálogo dos cursos da Escola, por ciclo, com filtro por objetivo (os da matrícula) e por área. Os filtros começam
 * em "todos" no servidor e na hidratação (o HTML é o mesmo dos dois lados) e não guardam nada.
 */
export function CatalogoDeCursos({ cartoes, grupos, s }: { cartoes: CartaoDoCurso[]; grupos: { id: string; rotulo: string }[]; s: TextosDoCatalogo }) {
  const [objetivo, setObjetivo] = useState<"" | Objetivo>("");
  const [grupo, setGrupo] = useState("");
  const id = useId();
  const c = s.catalogo;
  const visiveis = cartoes.filter((k) => (!objetivo || k.objetivos.includes(objetivo)) && (!grupo || k.grupo === grupo));
  const objetivosUsados = (Object.keys(s.objetivos) as Objetivo[]).filter((o) => cartoes.some((k) => k.objetivos.includes(o)));

  return (
    <div className="catalogo-de-cursos">
      <fieldset className="catalogo-filtros no-print">
        <legend className="rotulo">{c.filtros}</legend>
        <div className="catalogo-filtros-campos">
          <label htmlFor={`${id}-objetivo`}>
            <span>{c.filtroObjetivo}</span>
            <select id={`${id}-objetivo`} value={objetivo} onChange={(e) => setObjetivo(e.target.value as "" | Objetivo)}>
              <option value="">{c.todos}</option>
              {objetivosUsados.map((o) => (
                <option key={o} value={o}>
                  {s.objetivos[o]}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor={`${id}-area`}>
            <span>{c.filtroArea}</span>
            <select id={`${id}-area`} value={grupo} onChange={(e) => setGrupo(e.target.value)}>
              <option value="">{c.todas}</option>
              {grupos.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.rotulo}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="catalogo-contagem" role="status" aria-live="polite">
          {fill(c.contagem, { n: visiveis.length })}
          {(objetivo || grupo) && (
            <button
              type="button"
              onClick={() => {
                setObjetivo("");
                setGrupo("");
              }}
            >
              {c.limpar}
            </button>
          )}
        </p>
      </fieldset>

      {visiveis.length === 0 && <p className="mt-6 font-sans text-ink-soft">{c.nenhum}</p>}

      {CICLOS.map((ciclo) => {
        const doCiclo = visiveis.filter((k) => k.ciclo === ciclo);
        if (!doCiclo.length) return null;
        return (
          <section key={ciclo} className="mt-10" aria-labelledby={`${id}-${ciclo}`}>
            <h2 id={`${id}-${ciclo}`} className="text-3xl font-semibold">
              {s.ciclos[ciclo].titulo}
            </h2>
            <p className="mt-1 font-sans text-ink-soft">{s.ciclos[ciclo].texto}</p>
            <ul className="cartoes-de-curso">
              {doCiclo.map((k) => (
                <li key={k.slug} data-curso={k.slug}>
                  <L href={`/escola/cursos/${k.slug}`} className="cartao-de-curso">
                    <span className="cartao-de-curso-titulo" lang="pt">
                      {k.titulo}
                    </span>
                    <span className="cartao-de-curso-resumo" lang="pt">
                      {k.resumo}
                    </span>
                    <span className="cartao-de-curso-dados">
                      <span>{fill(c.horas, { h: k.horas })}</span>
                      <span>{fill(c.aulas, { n: k.nAulas })}</span>
                      <span>{fill(c.semanas, { n: k.semanas })}</span>
                      <span>{s.formatos[k.formato]}</span>
                    </span>
                    {k.patrono && <span className="cartao-de-curso-patrono">{fill(c.patrono, { nome: k.patrono })}</span>}
                    {k.requisitos.length > 0 && <span className="cartao-de-curso-requisitos">{fill(c.requisitos, { lista: k.requisitos.join(", ") })}</span>}
                    <span className="selo-aulas-prontas">{c.selo}</span>
                  </L>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

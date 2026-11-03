// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { desmarcarMissao, linkDaMissao, type Missao, marcarMissao } from "@/lib/escola/vida";
import { useMissoes } from "./guardado-vida";

type S = TextosDaVida["missoes"];

const formatarDia = (dia: string, lang: string) => {
  try {
    return new Intl.DateTimeFormat(lang, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${dia}T00:00:00Z`));
  } catch {
    return dia;
  }
};

/**
 * As missões curadas, agrupadas por curso. Cada uma tem a situação, a tarefa, o cuidado, o link para o laboratório e
 * "Cumpri a missão": a marca é da própria pessoa (o laboratório não manda resultado). O contador "N de M" é só de quem
 * estuda, neste aparelho, sem ranking.
 */
export function MissaoDoLab({ missoes, cursos, s, selo, lang }: { missoes: Missao[]; cursos: Record<string, string>; s: S; selo: string; lang: Locale }) {
  const feitas = useMissoes();
  const [erro, setErro] = useState(false);
  const grupos = new Map<string, Missao[]>();
  for (const m of missoes) grupos.set(m.curso ?? "", [...(grupos.get(m.curso ?? "") ?? []), m]);
  const nFeitas = missoes.filter((m) => feitas[m.id]).length;

  return (
    <div data-missoes="">
      <p className="vida-nota" role="status" data-contador="missoes">
        {fill(s.contador, { n: nFeitas, m: missoes.length })}
      </p>
      <p className="vida-nota">
        {s.nota} <span className="vida-selo">{selo}</span>
      </p>
      {erro ? <p className="vida-erro">{s.falhou}</p> : null}
      {[...grupos.entries()].map(([curso, lista]) => (
        <section key={curso || "livre"} className="vida-bloco" aria-label={curso ? cursos[curso] : s.semCurso}>
          <h2 className="vida-titulo">{curso ? cursos[curso] : s.semCurso}</h2>
          <div className="vida-grade">
            {lista.map((m) => {
              const marca = feitas[m.id];
              return (
                <article key={m.id} className="vida-cartao" data-missao={m.id}>
                  <h3 lang="pt">{m.titulo}</h3>
                  <p lang="pt">
                    <span className="font-semibold">{s.situacao}:</span> {m.situacao}
                  </p>
                  <p lang="pt">
                    <span className="font-semibold">{s.tarefa}:</span> {m.tarefa}
                  </p>
                  <p lang="pt">
                    <span className="font-semibold">{s.cuidado}:</span> {m.cuidado}
                  </p>
                  {marca ? (
                    <p className="vida-ok" role="status">
                      {fill(s.cumprida, { data: formatarDia(marca.em, lang) })}
                    </p>
                  ) : null}
                  <div className="vida-botoes">
                    <Link href={localePath(lang, linkDaMissao(m))} className="vida-botao-claro">
                      {s.abrir}
                    </Link>
                    {marca ? (
                      <button type="button" className="vida-botao-claro" onClick={() => setErro(!desmarcarMissao(m.id))}>
                        {s.desfazer}
                      </button>
                    ) : (
                      <button type="button" className="vida-botao" onClick={() => setErro(!marcarMissao(m.id))}>
                        {s.cumpri}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

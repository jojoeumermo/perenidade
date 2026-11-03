// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect } from "react";
import { type Destino, ProximoPasso } from "@/components/aula/ProximoPasso";
import { useInscricoes } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDaAula } from "@/i18n/escola/aula";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import { contarEscola } from "@/lib/escola/banco";
import { trilhaDe } from "@/lib/escola/cursos";
import type { CursoDaAula } from "@/lib/escola/cursos-vista";
import { useCompleted } from "@/lib/progress";
import { L } from "../../I18n";

/**
 * A faixa do curso na aula (E4-07). Só aparece para quem está inscrito (neste aparelho) num curso de que a aula faz
 * parte: "Curso X · módulo 2 · aula 5 de 24", e o próximo passo passa a ser a próxima aula do curso (a primeira não
 * feita depois desta; sem nenhuma, a primeira não feita do curso). Conta a presença do dia (+1 anônimo, uma vez por dia
 * e curso neste aparelho). Sem inscrição não mostra faixa nenhuma, e o próximo passo continua sendo o da trilha.
 * Carregada sob demanda (FaixaDoCursoSobDemanda), só nas aulas que fazem parte de algum curso.
 */
export function FaixaDoCurso({ aula, cursos, proximaDaTrilha, s, sProximo }: { aula: string; cursos: CursoDaAula[]; proximaDaTrilha?: Destino; s: TextosDosCursos["faixa"]; sProximo: TextosDaAula["proximo"] }) {
  const inscricoes = useInscricoes();
  const feitas = useCompleted();
  const meus = cursos.filter((c) => inscricoes.some((i) => i.curso === c.slug && !i.trancadoEm && !i.formadoEm));
  const chaveDosMeus = meus.map((c) => c.slug).join(",");

  useEffect(() => {
    for (const slug of chaveDosMeus.split(",").filter(Boolean)) contarEscola("escola_presenca", slug, "dia");
  }, [chaveDosMeus]);

  if (!meus.length) return <ProximoPasso proxima={proximaDaTrilha} s={sProximo} />;

  const principal = meus[0];
  const dispensas = inscricoes.find((i) => i.curso === principal.slug)?.dispensas ?? [];
  const aFazer = (a: string) => a !== aula && !feitas.has(a) && !dispensas.includes(trilhaDe(a));
  const aqui = principal.aulas.indexOf(aula);
  let j = principal.aulas.findIndex((a, k) => k > aqui && aFazer(a));
  if (j < 0) j = principal.aulas.findIndex(aFazer);
  const proxima: Destino | undefined = j >= 0 ? { caminho: `/trilhas/${principal.aulas[j]}`, titulo: principal.titulos[j] } : proximaDaTrilha;

  return (
    <>
      <nav className="no-print no-leitor mt-10 border-l-4 border-[#c21f16] bg-parchment-deep px-4 py-3 font-sans text-sm" aria-label={s.rotulo}>
        {meus.map((c) => {
          const i = c.aulas.indexOf(aula);
          return (
            <p key={c.slug} data-faixa-do-curso={c.slug} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="rotulo">{s.rotulo}</span>
              <span className="font-semibold">{fill(s.linha, { curso: c.titulo, modulo: c.modulos[i] + 1, aula: i + 1, total: c.aulas.length })}</span>
              <L href={`/escola/cursos/${c.slug}`} className="underline hover:text-oxblood">
                {s.ver} →
              </L>
            </p>
          );
        })}
      </nav>
      <ProximoPasso proxima={proxima} s={sProximo} />
    </>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { Cerimonia } from "@/components/escola/formatura/Cerimonia";
import { ConviteDeMatricula, SeloDoAparelho } from "@/components/escola/formatura/ConviteDeMatricula";
import { PublicarNaGaveta } from "@/components/escola/formatura/PublicarNaGaveta";
import { useProjetos } from "@/components/escola/formatura/usar-formatura";
import { useCaderneta, useInscricoes, useMatricula } from "@/components/escola/guardado-escola";
import Link from "@/components/Link";
import { fill } from "@/i18n/config";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { type CursoParaFormatura, criterioDeFormatura, cursoParaConta, REGRAS_DA_FORMATURA } from "@/lib/escola/formatura";
import { useCompleted } from "@/lib/progress";

function motivo(codigo: string, m: TextosDaFormatura["formatura"]["motivos"]): string {
  const aulas = /^faltam(\d+)aulas$/.exec(codigo);
  if (aulas) return fill(m.faltamAulas, { n: aulas[1] });
  return (m as Record<string, string>)[codigo] ?? codigo;
}

/** Um cartão por inscrição: o critério (feito/falta), "o que falta" e o botão "Minha formatura". Sem nota nem ranking. */
export function PainelDeFormatura({
  s,
  cer,
  g,
  c,
  cursos,
  base,
  gavetaHref,
  idioma,
}: {
  s: TextosDaFormatura["formatura"];
  cer: TextosDaFormatura["cerimonia"];
  g: TextosDaFormatura["gaveta"];
  c: TextosDaFormatura["comum"];
  cursos: CursoParaFormatura[];
  base: string;
  gavetaHref: string;
  idioma: string;
}) {
  const matricula = useMatricula();
  const inscricoes = useInscricoes();
  const caderneta = useCaderneta();
  const projeto = useProjetos();
  const concluidas = useCompleted();
  if (!matricula) return <ConviteDeMatricula c={c} base={base} />;
  const meus = inscricoes.flatMap((i) => {
    const curso = cursos.find((x) => x.slug === i.curso);
    return curso ? [{ i, curso }] : [];
  });
  const fmt = new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 });
  return (
    <div className="formatura-pilha" data-painel-de-formatura="">
      <SeloDoAparelho texto={c.noAparelho} />
      {REGRAS_DA_FORMATURA.confirmado ? null : (
        <p className="formatura-aviso" data-criterio-proposto="">
          {s.criterioProposto} {c.revisar}
        </p>
      )}
      {meus.length === 0 ? (
        <div className="formatura-cartao" data-sem-curso="">
          <p>{s.semCurso}</p>
          <p>
            <Link href={`${base}/cursos`} className="formatura-botao">
              {s.verCursos}
            </Link>
          </p>
        </div>
      ) : (
        meus.map(({ i, curso }) => {
          const conta = cursoParaConta(curso);
          const entrada = { curso: conta, inscricao: i, concluidas, projeto, caderneta, minutosDaAula: conta.minutosDaAula };
          const k = criterioDeFormatura(entrada);
          return (
            <article key={curso.slug} className="formatura-cartao" aria-labelledby={`f-${curso.slug}`} data-curso={curso.slug} data-pode={k.pode ? "" : undefined}>
              <h2 id={`f-${curso.slug}`} className="formatura-h2">
                {curso.titulo}
              </h2>
              {k.jaFormada ? <p className="formatura-selo">{fill(s.formadaEm, { dia: i.formadoEm ?? "" })}</p> : null}
              <ul className="formatura-lista">
                <li data-aulas-ok={k.aulasOk ? "" : undefined}>
                  {k.aulasOk ? "✓ " : ""}
                  {fill(s.aulas, { feitas: k.aulasFeitas, total: k.aulasTotais })}
                </li>
                <li data-projeto-ok={k.projetoOk ? "" : undefined}>
                  {k.projetoOk ? "✓ " : ""}
                  {s.projeto}
                </li>
              </ul>
              <p className="formatura-fraco">
                {fill(s.horas, { feitas: fmt.format(k.horasFeitas), total: fmt.format(k.horasTotais) })} · {c.estimativa}
              </p>
              {!k.pode && !k.jaFormada ? (
                <div data-o-que-falta="">
                  <h3 className="formatura-h3">{s.oQueFalta}</h3>
                  <ul className="formatura-lista">
                    {k.motivos.map((m) => (
                      <li key={m}>{motivo(m, s.motivos)}</li>
                    ))}
                  </ul>
                  <p>
                    <Link href={`${base}/formatura/projeto`} className="formatura-link">
                      {s.irParaProjeto}
                    </Link>
                  </p>
                </div>
              ) : null}
              <Cerimonia s={cer} entrada={entrada} tituloDoCurso={curso.titulo} base={base} />
              {k.jaFormada ? <PublicarNaGaveta s={g} curso={curso} gavetaHref={gavetaHref} /> : null}
            </article>
          );
        })
      )}
    </div>
  );
}

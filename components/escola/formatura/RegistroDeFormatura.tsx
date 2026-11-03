// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { ConviteDeMatricula } from "@/components/escola/formatura/ConviteDeMatricula";
import { useNoNavegador } from "@/components/escola/formatura/usar-formatura";
import { useInscricoes, useMatricula } from "@/components/escola/guardado-escola";
import Link from "@/components/Link";
import { fill } from "@/i18n/config";
import type { TextosDaFormatura } from "@/i18n/escola/formatura";
import { horasDoCurso, horasFeitas } from "@/lib/escola/cursos";
import { type CursoParaFormatura, cursoParaConta } from "@/lib/escola/formatura";
import { useCompleted } from "@/lib/progress";

/**
 * O registro de formatura: uma folha A4 que a pessoa imprime ou salva em PDF. É um comprovante de estudo feito pela própria
 * pessoa: sem brasão, sem assinatura, sem selo de autenticidade, sem QR e sem campo de documento. Leva o aviso fixo.
 */
export function RegistroDeFormatura({ s, c, cursos, base, idioma }: { s: TextosDaFormatura["registro"]; c: TextosDaFormatura["comum"]; cursos: CursoParaFormatura[]; base: string; idioma: string }) {
  const matricula = useMatricula();
  const inscricoes = useInscricoes();
  const concluidas = useCompleted();
  const noNavegador = useNoNavegador();
  const [escolhido, setEscolhido] = useState("");
  if (!matricula) return <ConviteDeMatricula c={c} base={base} />;

  const formadas = inscricoes.flatMap((i) => {
    const curso = cursos.find((x) => x.slug === i.curso);
    return i.formadoEm && curso ? [{ i, curso }] : [];
  });
  if (formadas.length === 0) {
    return (
      <div className="formatura-cartao" data-sem-formatura="">
        <p>{s.semFormatura}</p>
        <p>
          <Link href={`${base}/formatura`} className="formatura-botao">
            {s.irParaFormatura}
          </Link>
        </p>
      </div>
    );
  }
  const { i, curso } = formadas.find((x) => x.curso.slug === escolhido) ?? formadas[0];
  const conta = cursoParaConta(curso);
  const horas = horasFeitas(conta, concluidas, i.dispensas, conta.minutosDaAula);
  const total = horasDoCurso(conta, conta.minutosDaAula);
  const fmt = new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 });
  const quem = matricula.apelido || s.estudante;

  const folha = (
    <article className="registro-folha" data-registro-de-formatura="">
      <p className="registro-escola">{s.escola}</p>
      <h1>{s.titulo}</h1>
      <p className="registro-quem">{quem}</p>
      <p>{fill(s.concluiu, { curso: curso.titulo })}</p>
      <dl>
        <div>
          <dt>{s.entrou}</dt>
          <dd>{i.entrouEm}</dd>
        </div>
        <div>
          <dt>{s.formouEm}</dt>
          <dd>{i.formadoEm}</dd>
        </div>
        <div>
          <dt>{s.horasEstimadas}</dt>
          <dd>
            {fill(s.horasValor, { feitas: fmt.format(horas), total: fmt.format(total) })} ({c.estimativa})
          </dd>
        </div>
        {curso.patrono ? (
          <div>
            <dt>{s.patrono}</dt>
            <dd>
              {curso.patrono} ({s.propostoSelo})
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="registro-aviso">{c.naoEhDocumento}</p>
    </article>
  );

  return (
    <div className="formatura-pilha" data-registro="">
      {formadas.length > 1 ? (
        <label className="formatura-campo-em-linha">
          <span>{s.escolhaOCurso}</span>
          <select value={curso.slug} onChange={(e) => setEscolhido(e.target.value)}>
            {formadas.map((x) => (
              <option key={x.curso.slug} value={x.curso.slug}>
                {x.curso.titulo}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="registro-previa">{folha}</div>
      <div className="formatura-barra no-print">
        <button type="button" className="formatura-botao" onClick={() => window.print()}>
          {s.imprimir}
        </button>
      </div>
      <p className="formatura-fraco">{s.imprimirDica}</p>
      <p className="formatura-aviso">
        {c.encceja}{" "}
        <Link href={`${base}/calendario`} className="formatura-link">
          {c.enccejaLink} →
        </Link>
      </p>
      {noNavegador ? createPortal(<div className="caderneta-impressao">{folha}</div>, document.body) : null}
    </div>
  );
}

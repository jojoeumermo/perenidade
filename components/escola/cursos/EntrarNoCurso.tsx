// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { useInscricoes, useMatricula } from "@/components/escola/guardado-escola";
import { fill } from "@/i18n/config";
import type { TextosDosCursos } from "@/i18n/escola/cursos";
import { contarEscola } from "@/lib/escola/banco";
import { proximaDoCurso } from "@/lib/escola/cursos";
import { inscrever, lerInscricoes } from "@/lib/escola/estudante";
import { useCompleted } from "@/lib/progress";
import { useHydrated } from "@/lib/storage";
import { L } from "../../I18n";

/** "AAAA-MM-DD" no formato do idioma (o dia não muda com o fuso). */
const dia = (data: string, idioma: string) => new Intl.DateTimeFormat(idioma, { dateStyle: "long", timeZone: "UTC" }).format(new Date(`${data}T12:00:00Z`));

/**
 * Entrar no curso. Sem matrícula: o link para /escola/matricula?curso=<slug> (o slug é público; a matrícula fica no
 * aparelho). Com matrícula: inscrever() guarda a inscrição só no aparelho e contarEscola soma +1 anônimo, uma vez por
 * semestre neste aparelho. Já inscrito: "continuar" leva à próxima aula do curso. O servidor e a hidratação mostram o
 * link da matrícula (serve também a quem está sem JavaScript); o estado real chega depois.
 */
export function EntrarNoCurso({ slug, sensivel, aulas, titulos, idioma, s }: { slug: string; sensivel: boolean; aulas: string[]; titulos: string[]; idioma: string; s: TextosDosCursos["entrar"] }) {
  const pronto = useHydrated();
  const matricula = useMatricula();
  const inscricao = useInscricoes().find((i) => i.curso === slug);
  const feitas = useCompleted();
  const [erro, setErro] = useState(false);

  const entrar = () => {
    inscrever(slug);
    // inscrever() não diz se o aparelho guardou: confere relendo.
    if (!lerInscricoes().some((i) => i.curso === slug && !i.trancadoEm)) {
      setErro(true);
      return;
    }
    setErro(false);
    contarEscola("escola_matricula", slug, "semestre");
  };

  const botao = "inline-flex min-h-11 items-center border-2 border-ink bg-ink px-5 py-2.5 font-sans font-semibold text-parchment hover:border-oxblood hover:bg-oxblood";

  let corpo: React.ReactNode;
  if (!pronto || !matricula) {
    corpo = (
      <>
        <p>{s.semMatricula}</p>
        <L href={`/escola/matricula?curso=${encodeURIComponent(slug)}`} className={`${botao} mt-3`} data-fazer-matricula="">
          {s.fazerMatricula} →
        </L>
      </>
    );
  } else if (!inscricao || inscricao.trancadoEm) {
    corpo = (
      <>
        {inscricao?.trancadoEm && <p>{fill(s.trancado, { data: dia(inscricao.trancadoEm, idioma) })}</p>}
        <button type="button" onClick={entrar} className={`${botao} ${inscricao ? "mt-3" : ""}`} data-entrar-no-curso="">
          {inscricao ? s.voltar : s.entrar}
        </button>
        <p className="mt-2 text-sm text-ink-soft">{s.noAparelho}</p>
      </>
    );
  } else {
    const proxima = proximaDoCurso({ modulos: [{ titulo: "", aulas }] }, feitas, inscricao.dispensas);
    const i = proxima ? aulas.indexOf(proxima) : -1;
    corpo = (
      <>
        <p data-no-curso="">{inscricao.formadoEm ? fill(s.formado, { data: dia(inscricao.formadoEm, idioma) }) : fill(s.dentro, { data: dia(inscricao.entrouEm, idioma) })}</p>
        {proxima && i >= 0 ? (
          <L href={`/trilhas/${proxima}`} className={`${botao} mt-3`}>
            <span>{fill(s.continuar, { titulo: titulos[i] ?? proxima })}</span>
          </L>
        ) : (
          <p className="mt-2 font-semibold">{s.acabou}</p>
        )}
        <p className="mt-2 text-sm text-ink-soft">{s.noAparelho}</p>
      </>
    );
  }

  return (
    <div className="entrar-no-curso font-sans" data-sensivel={sensivel || undefined}>
      {corpo}
      {erro && (
        <p role="alert" className="mt-2 text-sm font-semibold text-oxblood">
          {s.erro}
        </p>
      )}
    </div>
  );
}

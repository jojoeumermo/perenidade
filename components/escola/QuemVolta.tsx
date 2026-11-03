// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { PresencaSomada, type TextosDaPresenca } from "@/components/escola/PresencaSomada";
import { useGuardado } from "@/components/estudo/guardado";
import Link from "@/components/Link";
import { fill, localePath, type Locale } from "@/i18n/config";
import type pt from "@/i18n/escola/matricula/pt.json";
import { proximaDoCurso } from "@/lib/escola/cursos";
import { type Inscricao, lerInscricoes, lerMatricula, type Matricula } from "@/lib/escola/estudante";
import { type AulasDoAparelho, type CursoDoAparelho, cursoAtual } from "@/lib/escola/matricula";
import { diaDeHoje, lerPlano, planoDeHoje } from "@/lib/escola/plano";
import { useCompleted, useLastLesson } from "@/lib/progress";
import { entradaDoPlano } from "./plano/PlanoDaSemana";

type S = (typeof pt)["quemVolta"];
type Comum = (typeof pt)["comum"];
const SEM_LISTA: Inscricao[] = [];
const diaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const claro = "inline-flex min-h-11 items-center border-2 border-ink px-4 py-2 font-semibold hover:border-oxblood hover:text-oxblood";

/**
 * "Quem volta", na entrada da Escola: para quem tem matrícula neste aparelho, a mini-carteirinha (apelido e número),
 * "Hoje no seu plano", "Continuar o curso" (a próxima aula do curso atual; sem curso, a última aula aberta) e a
 * presença somada. Sem matrícula, o convite. Tudo vem do aparelho: o servidor manda um espaço reservado neutro, igual
 * na hidratação, e o conteúdo chega no primeiro efeito (o mesmo padrão de components/estudo/guardado.ts).
 */
export function QuemVolta({
  s,
  comum,
  sPresenca,
  cursos,
  aulas,
  nomeDaCarteirinha,
  lang,
}: {
  s: S;
  comum: Comum;
  sPresenca: TextosDaPresenca;
  cursos: CursoDoAparelho[];
  aulas: AulasDoAparelho;
  /** "Estudante", quando não há apelido. */
  nomeDaCarteirinha: string;
  lang: Locale;
}) {
  const [matricula] = useGuardado<Matricula | null | undefined>(lerMatricula, undefined);
  const [inscricoes] = useGuardado<Inscricao[]>(lerInscricoes, SEM_LISTA);
  const concluidas = useCompleted();
  const ultima = useLastLesson();
  const [hoje, setHoje] = useState<{ aulas: string[] } | null>(null);

  // O plano de hoje é só lido aqui (quem grava é a página do plano).
  useEffect(() => {
    if (!matricula) return;
    const id = window.setTimeout(() => {
      const dia = diaLocal(new Date());
      const entrada = entradaDoPlano(matricula, inscricoes, concluidas, cursos, aulas, dia);
      if (!entrada || !inscricoes.some((i) => !i.trancadoEm && !i.formadoEm)) {
        setHoje({ aulas: [] });
        return;
      }
      const plano = planoDeHoje(lerPlano(), entrada, null);
      setHoje({ aulas: diaDeHoje(plano, dia)?.aulas ?? [] });
    }, 0);
    return () => window.clearTimeout(id);
  }, [matricula, inscricoes, concluidas, cursos, aulas]);

  return (
    <section className="mt-12 min-h-40" aria-labelledby="quem-volta" data-quem-volta="">
      <h2 id="quem-volta" className="text-3xl font-semibold">
        {matricula ? s.titulo : matricula === null ? s.convite.titulo : s.rotulo}
      </h2>
      {matricula === undefined && (
        <p className="mt-4 font-sans text-sm text-ink-soft" aria-busy="true">
          {comum.carregando}
        </p>
      )}
      {matricula === null && (
        <div className="mt-4 border border-rule bg-parchment-deep p-5 font-sans" data-quem-volta-convite="">
          <p className="text-ink-soft">{s.convite.texto}</p>
          <Link href={localePath(lang, "/escola/matricula")} className="mt-4 inline-flex min-h-11 items-center bg-ink px-5 py-2.5 font-semibold text-parchment hover:bg-oxblood">
            {s.convite.botao}
          </Link>
        </div>
      )}
      {matricula && <ParaQuemTemMatricula {...{ matricula, inscricoes, concluidas, ultima, hoje, s, comum, cursos, aulas, nomeDaCarteirinha, lang }} />}
      {/* A presença somada (E4-02) vale para quem tem matrícula e para quem ainda vai fazer: são só somas anônimas. */}
      {matricula !== undefined && (
        <div className="mt-5">
          <PresencaSomada s={sPresenca} lang={lang} />
        </div>
      )}
    </section>
  );
}

function ParaQuemTemMatricula({
  matricula,
  inscricoes,
  concluidas,
  ultima,
  hoje,
  s,
  comum,
  cursos,
  aulas,
  nomeDaCarteirinha,
  lang,
}: {
  matricula: Matricula;
  inscricoes: Inscricao[];
  concluidas: Set<string>;
  ultima: ReturnType<typeof useLastLesson>;
  hoje: { aulas: string[] } | null;
  s: S;
  comum: Comum;
  cursos: CursoDoAparelho[];
  aulas: AulasDoAparelho;
  nomeDaCarteirinha: string;
  lang: Locale;
}) {
  const atual = cursoAtual(inscricoes);
  const curso = atual ? cursos.find((c) => c.slug === atual.curso) : undefined;
  const proxima = curso && atual ? proximaDoCurso(curso, concluidas, atual.dispensas) : null;
  return (
    <div className="mt-5 grid gap-4 font-sans md:grid-cols-3">
      {/* A mini-carteirinha: só apelido e número, no papel do certificado. */}
      <Link href={localePath(lang, "/escola/carteirinha")} className="block border-2 border-ink bg-[#fbf7ec] p-4 text-[#1c1712] hover:border-oxblood" data-mini-carteirinha="">
        <span className="block font-mono text-[0.68rem] uppercase tracking-[0.2em] text-[#8a6a1c]">{s.carteirinha}</span>
        <span className="mt-2 block font-serif text-2xl font-semibold">{matricula.apelido ?? nomeDaCarteirinha}</span>
        <span className="mt-1 block font-mono tracking-wider">{matricula.numero}</span>
      </Link>

      <div className="border border-rule p-4">
        <h3 className="font-serif text-xl font-semibold">{s.hoje}</h3>
        {hoje && hoje.aulas.length > 0 ? (
          <ul className="mt-2 grid gap-1">
            {hoje.aulas.slice(0, 3).map((aula) => (
              <li key={aula}>
                <Link href={localePath(lang, `/trilhas/${aula}`)} className={`underline-offset-4 hover:text-oxblood hover:underline ${concluidas.has(aula) ? "text-ink-soft line-through" : ""}`}>
                  {aulas[aula]?.titulo ?? aula}
                </Link>
                {aulas[aula] && <span className="text-xs text-ink-soft"> · {fill(comum.minutos, { n: aulas[aula].minutos })}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-ink-soft">{s.hojeLivre}</p>
        )}
        <Link href={localePath(lang, "/escola/plano")} className="mt-3 inline-flex min-h-11 items-center text-sm underline hover:text-oxblood">
          {s.verPlano} →
        </Link>
      </div>

      <div className="border border-rule p-4">
        <h3 className="font-serif text-xl font-semibold">{curso ? s.continuar : s.continuarAula}</h3>
        {curso && proxima ? (
          <>
            <p className="mt-1 text-sm text-ink-soft">{curso.titulo}</p>
            <Link href={localePath(lang, `/trilhas/${proxima}`)} className={`${claro} mt-3`}>
              {aulas[proxima]?.titulo ?? proxima} →
            </Link>
          </>
        ) : ultima ? (
          <Link href={localePath(lang, ultima.path)} className={`${claro} mt-3`}>
            {ultima.title} →
          </Link>
        ) : (
          <Link href={localePath(lang, "/escola/cursos")} className={`${claro} mt-3`}>
            {s.verCursos} →
          </Link>
        )}
      </div>
    </div>
  );
}

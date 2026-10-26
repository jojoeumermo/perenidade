// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc, useMe } from "@/lib/backend";
import { JITSI_DOMINIO } from "@/lib/jitsi";
import { lessonId } from "@/lib/ids";
import { useCompleted } from "@/lib/progress";
import type { TurmaDoMes as Turma } from "@/lib/turma-do-mes";

type Situacao = { inscritos: number; eu: boolean; sala: string | null };

const data = (iso: string, lang: Locale) => new Intl.DateTimeFormat(lang, { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

/**
 * A turma de um mês: quatro semanas com duas aulas cada, o progresso deste aparelho em cada aula e o botão de entrar.
 * Quem entra recebe o link da sala do encontro semanal (o banco só entrega a sala para quem está na turma).
 */
export function TurmaDoMes({ turma, lang, s, proxima = false }: { turma: Turma; lang: Locale; s: Dict["turmaDoMes"]; proxima?: boolean }) {
  const feitas = useCompleted();
  const quem = useMe();
  const [situacao, setSituacao] = useState<Situacao | null>(null);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const logado = quem.status === "in";

  useEffect(() => {
    if (!hasBackend || quem.status === "loading") return;
    rpc<Situacao>("turma_mes", { p_mes: turma.mes }).then(setSituacao, () => setSituacao(null));
  }, [turma.mes, quem.status]);

  async function mudar(entrar: boolean) {
    setEnviando(true);
    setErro("");
    try {
      setSituacao(await rpc<Situacao>("turma_mes_entrar", { p_mes: turma.mes, p_entrar: entrar }));
    } catch {
      setErro(s.erro);
    } finally {
      setEnviando(false);
    }
  }

  const total = turma.semanas.reduce((n, w) => n + w.aulas.length, 0);
  const minhas = turma.semanas.reduce((n, w) => n + w.aulas.filter((a) => feitas.has(lessonId(turma.trilha, a.slug))).length, 0);
  const to = (p: string) => localePath(lang, p);

  return (
    <section className="cartao min-w-0 p-6 sm:p-8" aria-labelledby={`turma-${turma.mes}`}>
      <p className="rotulo">{proxima ? s.proximaRotulo : s.agoraRotulo}</p>
      <h2 id={`turma-${turma.mes}`} className="mt-2 font-serif text-[2.1rem] font-semibold leading-tight text-balance">
        <Link href={to(`/trilhas/${turma.trilha}`)} className="text-ink hover:text-prelo-texto">{turma.titulo}</Link>
      </h2>
      <p className="mt-2 max-w-[65ch] text-lg text-ink-soft">{turma.resumo}</p>

      <div className="mt-5 flex flex-wrap items-center gap-4 font-sans">
        {situacao && <p className="text-sm font-semibold">{fill(situacao.inscritos === 1 ? s.inscritaUma : s.inscritos, { n: situacao.inscritos })}</p>}
        {!proxima && <p className="text-sm text-ink-soft">{fill(s.progresso, { feitas: minhas, total })}</p>}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!hasBackend ? null : !logado ? (
          <Link href={to("/entrar")} className="botao botao-tinta">{s.entrarParaParticipar}</Link>
        ) : situacao?.eu ? (
          <>
            {situacao.sala && !proxima && (
              <a href={`https://${JITSI_DOMINIO}/${situacao.sala}`} target="_blank" rel="noreferrer" className="botao botao-tinta">{s.abrirSala}</a>
            )}
            <button type="button" className="botao" disabled={enviando} onClick={() => mudar(false)}>{s.sair}</button>
          </>
        ) : (
          <button type="button" className="botao botao-tinta" disabled={enviando} onClick={() => mudar(true)}>{proxima ? s.avisar : s.participar}</button>
        )}
      </div>
      {erro && <p role="alert" className="mt-3 font-sans text-sm font-semibold text-prelo-texto">{erro}</p>}
      {situacao?.eu && <p className="mt-3 font-sans text-sm text-ink-soft">{s.encontroExplica}</p>}

      <ol className="mt-8 grid gap-5 sm:grid-cols-2">
        {turma.semanas.map((semana, i) => (
          <li key={semana.inicio} className="min-w-0 border-t-[3px] border-ink pt-3">
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-prelo-texto">
              {fill(s.semana, { n: i + 1, data: data(semana.inicio, lang) })}
            </p>
            <ul className="mt-2 grid gap-2 font-sans">
              {semana.aulas.map((aula) => {
                const feita = feitas.has(lessonId(turma.trilha, aula.slug));
                return (
                  <li key={aula.slug} className="flex items-start gap-2">
                    <span aria-hidden className={`mt-1 inline-block h-4 w-4 shrink-0 border-2 border-ink ${feita ? "bg-ink" : ""}`} />
                    <span className="min-w-0">
                      <Link href={to(`/trilhas/${turma.trilha}/${aula.slug}`)} className="font-semibold text-ink underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto">{aula.titulo}</Link>
                      <span className="text-sm text-ink-soft"> · {fill(s.minutos, { n: aula.minutos })}{feita ? ` · ${s.feita}` : ""}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 font-sans text-sm text-ink-soft">{fill(s.encontro, { data: data(semana.encontro, lang) })}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

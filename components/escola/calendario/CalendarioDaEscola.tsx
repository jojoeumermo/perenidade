// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { L } from "@/components/I18n";
import { baixar } from "@/components/estudo/guardado";
import { fill, htmlLang, type Locale } from "@/i18n/config";
import type { Aula } from "@/lib/aovivo";
import { hasBackend, rpc } from "@/lib/backend";
import { ehAulaMagna, icsDoEvento, semestresDoCalendario } from "@/lib/escola/calendario";
import type { EventoNaTela, SemestreNaTela, TextosDoCampus } from "@/lib/escola/campus-servidor";
import { useHojeNaEscola } from "./FeriadoDoCampus";
import "@/styles/escola-campus.css";

type S = TextosDoCampus["calendario"];

/** O dia de Brasília (AAAA-MM-DD) de um instante. */
const diaDe = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10);

/** As aulas ao vivo marcadas cujo título começa com "Aula magna" (RPC que já existe, só leitura). */
function useAulasMagnasAoVivo(): Aula[] {
  const [aulas, setAulas] = useState<Aula[]>([]);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<Aula[]>("aulas_ao_vivo_listar", { p_disciplina: null })
      .then((lista) => {
        if (vivo && Array.isArray(lista)) setAulas(lista.filter((a) => a && typeof a.titulo === "string" && ehAulaMagna(a.titulo) && a.status !== "cancelada"));
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  return aulas;
}

/** O .ics de um evento, feito no aparelho na hora do clique (nada é enviado). */
function porNaAgenda(e: EventoNaTela, url: string, lang: Locale) {
  const destino = /^https?:/.test(e.link) ? e.link : `${url}/${lang}${e.link}`;
  baixar(`${e.id}.ics`, icsDoEvento(e, destino), "text/calendar;charset=utf-8");
}

function Evento({ e, s, url, lang }: { e: EventoNaTela; s: S; url: string; lang: Locale }) {
  const externo = /^https?:/.test(e.link);
  return (
    <li className="grid gap-x-4 gap-y-1 border-b border-rule py-3 last:border-b-0 sm:grid-cols-[10rem_1fr]" data-evento={e.tipo}>
      <p className="font-sans text-sm">
        <span className="block font-semibold text-ink">{e.dataTexto}</span>
        {e.ateTexto && <span className="block text-ink-soft">{e.ateTexto}</span>}
      </p>
      <div className="min-w-0">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">{s.tipos[e.tipo]}</p>
        <p className="mt-0.5 text-lg leading-snug">
          {externo ? (
            <a href={e.link} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:text-oxblood hover:underline">
              {e.titulo} ↗
            </a>
          ) : (
            <L href={e.link} className="underline-offset-4 hover:text-oxblood hover:underline">
              {e.titulo}
            </L>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-4 font-sans text-xs text-ink-soft">
          {e.tipo === "exame" && e.fonte && e.orgao && e.consultadoTexto && (
            <a href={e.fonte} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-oxblood">
              {fill(s.fonteExame, { orgao: e.orgao, data: e.consultadoTexto })} ↗
            </a>
          )}
          {e.tipo === "exame" && e.link === "/enem" && (
            <L href="/enem" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-oxblood">
              {s.cursoEnem} →
            </L>
          )}
          {e.tipo === "feriado" && e.fonte && (
            <a href={e.fonte} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-oxblood">
              {s.fonte} ↗
            </a>
          )}
          {e.tipo === "aula-magna" && e.link === "/ao-vivo" && (
            <L href="/ao-vivo" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-oxblood">
              {s.aoVivo} →
            </L>
          )}
          {e.data && (
            <button type="button" onClick={() => porNaAgenda(e, url, lang)} data-ics="" className="agenda-ics inline-flex cursor-pointer items-center gap-1.5 font-semibold text-ink underline underline-offset-4 hover:text-oxblood" aria-label={fill(s.agendaDe, { titulo: e.titulo })}>
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3.5" y="5" width="17" height="15" rx="1.5" />
                <path d="M3.5 9.5h17M8 3v4M16 3v4M12 12.5v5M9.5 15h5" />
              </svg>
              {s.agenda}
            </button>
          )}
        </p>
      </div>
    </li>
  );
}

/**
 * O calendário da Escola (E4-09, D1-5 e D1-6): o semestre atual e o próximo, em lista por mês (não em grade, que fica
 * ruim no celular), com "Proposto, a confirmar pela coordenação" e "Pôr na minha agenda" (.ics) em cada evento.
 * A página manda três semestres prontos; o navegador mostra os dois que valem hoje (sem JavaScript, os do dia em que a
 * página foi feita). As aulas ao vivo que começam com "Aula magna" entram depois, lidas do serviço.
 */
export function CalendarioDaEscola({ semestres, s, proposto, lang, url }: { semestres: SemestreNaTela[]; s: S; proposto: string; lang: Locale; url: string }) {
  const hoje = useHojeNaEscola();
  const magnas = useAulasMagnasAoVivo();
  const ids = hoje ? semestresDoCalendario(hoje).map((x) => x.id) : semestres.slice(0, 2).map((x) => x.id);
  const visiveis = semestres.filter((x) => ids.includes(x.id));
  const mostrar = visiveis.length > 0 ? visiveis : semestres.slice(0, 2);
  const formato = new Intl.DateTimeFormat(htmlLang[lang], { day: "numeric", month: "long", weekday: "short", timeZone: "UTC" });

  return (
    <div className="calendario-da-escola space-y-12" data-calendario-da-escola="">
      {mostrar.map((sem, i) => {
        // As aulas magnas ao vivo deste semestre (pela data, dentro da janela do semestre).
        const doServico: EventoNaTela[] = magnas
          .filter((a) => {
            const dia = diaDe(a.inicio);
            return sem.de <= dia && dia <= sem.fim;
          })
          .map((a) => {
            const data = diaDe(a.inicio);
            const e = { tipo: "aula-magna" as const, data, titulo: a.titulo, link: "/ao-vivo", id: `aovivo-${a.id}` };
            return { ...e, dataTexto: formato.format(new Date(`${data}T12:00:00Z`)) };
          });
        const meses = sem.meses.map((m) => ({ ...m, eventos: [...m.eventos] }));
        for (const e of doServico) {
          const chave = e.data.slice(0, 7);
          const grupo = meses.find((m) => m.mes === chave);
          if (grupo) grupo.eventos.push(e);
          else meses.push({ mes: chave, titulo: new Intl.DateTimeFormat(htmlLang[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${e.data}T12:00:00Z`)), eventos: [e] });
        }
        meses.sort((a, b) => a.mes.localeCompare(b.mes));
        for (const m of meses) m.eventos.sort((a, b) => (a.data || "9999").localeCompare(b.data || "9999"));
        const temMagna = sem.temAulaMagna || doServico.length > 0;
        return (
          <section key={sem.id} aria-labelledby={`semestre-${sem.id}`} data-semestre-do-calendario={sem.id}>
            <p className="rotulo">{i === 0 ? s.atual : s.proximo}</p>
            <h2 id={`semestre-${sem.id}`} className="mt-1 text-3xl font-semibold">
              {sem.nome}
            </h2>
            {proposto && <p className="mt-2 inline-block border border-dashed border-gold px-2 py-1 font-sans text-xs font-semibold text-gold">{proposto}</p>}
            {!temMagna && (
              <p className="mt-3 font-sans text-sm text-ink-soft" data-sem-aula-magna="">
                {s.semAulaMagna}
              </p>
            )}
            {meses.length === 0 && <p className="mt-4 text-ink-soft">{s.vazio}</p>}
            {meses.map((m) => (
              <div key={m.mes} className="mt-6">
                <h3 className="border-b-2 border-ink pb-1 font-mono text-[0.75rem] uppercase tracking-[0.16em]">{m.titulo}</h3>
                <ul>
                  {m.eventos.map((e) => (
                    <Evento key={e.id} e={e} s={s} url={url} lang={lang} />
                  ))}
                </ul>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

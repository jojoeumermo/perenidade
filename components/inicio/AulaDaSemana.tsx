// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useSyncExternalStore } from "react";
import Link from "@/components/Link";
import { Compartilhar } from "@/components/Compartilhar";
import { fill, type Locale, localePath } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import type { AulaDaSemana as Aula } from "@/lib/aula-da-semana";
import { semanaDe } from "@/lib/lambe-do-dia";
import { aulaEmUmMinuto } from "@/lib/compartilhar";

const nunca = () => () => {};

/**
 * A aula da semana na inicial. Como o lambe-lambe do dia: a página vem com a aula da semana em que foi montada e,
 * se a semana já virou, o navegador troca pela certa.
 */
export function AulaDaSemana({ semanas, lang, url, s, sc, area }: { semanas: Aula[]; lang: Locale; url: string; s: Dict["aulaDaSemana"]; sc: Dict["compartilhar"]; area: Record<string, string> }) {
  const agora = useSyncExternalStore(nunca, () => semanaDe(new Date()), () => semanas[0]?.semana ?? 0);
  const aula = semanas.find((x) => x.semana === agora) ?? semanas.at(agora > (semanas.at(-1)?.semana ?? 0) ? -1 : 0);
  if (!aula) return null;
  const caminho = localePath(lang, `/trilhas/${aula.trilha}/${aula.aula}`);
  const [ano, mes, dia] = aula.inicio.split("-");
  return (
    <section className="border-b-[3px] border-ink" aria-labelledby="aula-da-semana">
      <div className="mx-auto grid max-w-[78rem] gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] lg:px-8">
        <div>
          <p className="rotulo">{fill(s.semanaDe, { data: `${dia}/${mes}/${ano}` })}</p>
          <h2 id="aula-da-semana" className="lambe mt-3 text-[2.6rem] leading-[0.95] sm:text-[3.2rem]">{s.titulo}</h2>
          <p className="mt-4 text-lg leading-snug text-ink-soft">{s.lead}</p>
        </div>
        <article className="cartao min-w-0 p-6 sm:p-8">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-prelo-texto">
            {aula.trilhaTitulo} · {area[aula.area] ?? ""} · {fill(s.minutos, { n: aula.minutos })}
          </p>
          <h3 className="mt-3 font-serif text-[1.9rem] font-semibold leading-tight text-balance sm:text-[2.3rem]">
            <Link href={caminho} className="text-ink hover:text-prelo-texto">{aula.titulo}</Link>
          </h3>
          <p className="mt-3 max-w-[65ch] text-lg leading-relaxed text-ink-soft">{aula.resumo}</p>
          {aula.pergunta && (
            <p className="mt-5 border-l-4 border-[#c21f16] pl-4 font-sans text-[1.05rem]">
              <strong className="block text-xs uppercase tracking-[0.18em] text-prelo-texto">{s.pergunta}</strong>
              {aula.pergunta}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link href={caminho} className="botao botao-tinta">{s.estudar} →</Link>
          </div>
          <p className="mt-4 font-sans text-sm text-ink-soft">{s.pauta}</p>
          <div className="mt-5">
            <Compartilhar
              url={`${url}${caminho}`}
              texto={`${s.titulo}: ${aula.titulo}`}
              mensagem={aulaEmUmMinuto({ titulo: aula.titulo, trilha: aula.trilhaTitulo, resumo: aula.resumo, termos: aula.termos, pergunta: aula.pergunta, url: `${url}${caminho}`, s: sc })}
              s={sc}
            />
          </div>
        </article>
      </div>
    </section>
  );
}

/**
 * A aula da semana em cartão, junto das outras janelas do alto da inicial (continuar, jornal, rádio): o título, a
 * pergunta para pensar, o botão de estudar e o atalho para mandar a aula em um minuto no WhatsApp do grupo.
 */
export function JanelaAulaDaSemana({ semanas, lang, url, s, sc, area }: { semanas: Aula[]; lang: Locale; url: string; s: Dict["aulaDaSemana"]; sc: Dict["compartilhar"]; area: Record<string, string> }) {
  const agora = useSyncExternalStore(nunca, () => semanaDe(new Date()), () => semanas[0]?.semana ?? 0);
  const aula = semanas.find((x) => x.semana === agora) ?? semanas.at(agora > (semanas.at(-1)?.semana ?? 0) ? -1 : 0);
  if (!aula) return null;
  const caminho = localePath(lang, `/trilhas/${aula.trilha}/${aula.aula}`);
  const [, mes, dia] = aula.inicio.split("-");
  const mensagem = aulaEmUmMinuto({ titulo: aula.titulo, trilha: aula.trilhaTitulo, resumo: aula.resumo, termos: aula.termos, pergunta: aula.pergunta, url: `${url}${caminho}`, s: sc });
  return (
    <article className="cartao flex flex-col p-6" aria-labelledby="aula-da-semana">
      <p className="rotulo">
        {s.titulo} · {dia}/{mes}
      </p>
      <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-ink-soft">
        {area[aula.area] ?? aula.trilhaTitulo} · {fill(s.minutos, { n: aula.minutos })}
      </p>
      <h2 id="aula-da-semana" className="mt-2 text-[1.7rem] font-semibold leading-tight text-balance">
        <Link href={caminho} className="text-ink hover:text-prelo-texto">{aula.titulo}</Link>
      </h2>
      {aula.pergunta && (
        <p className="mt-3 border-l-4 border-[#c21f16] pl-3 font-sans text-[0.95rem] leading-snug">
          <strong className="block text-[0.68rem] uppercase tracking-[0.16em] text-prelo-texto">{s.pergunta}</strong>
          <span className="line-clamp-3">{aula.pergunta}</span>
        </p>
      )}
      <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 pt-5">
        <Link href={caminho} className="botao botao-tinta">{s.estudar} →</Link>
        <a href={`https://wa.me/?text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer" className="font-sans text-sm font-bold underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto">
          {sc.whatsapp}
        </a>
      </p>
    </article>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, type ReactNode } from "react";
import Link from "@/components/Link";
import { doisDigitos, faltaParaOAto } from "@/lib/rede/stories/tempo";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { AtoParaContagem, FigurinhaContagem } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["figurinha"]["contagem"];

/** As três plaquinhas (dias, horas, minutos) e o nome do ato: o mesmo desenho no visor e no "criar". */
function Cartao({ t, titulo, inicio, agora, children }: { t: T; titulo: string; inicio: string; agora: number; children?: ReactNode }) {
  const id = useId();
  const f = faltaParaOAto(inicio, agora);
  const falta = preencherStory(t.falta, { dias: f.dias, horas: f.horas, min: f.minutos, titulo });
  return (
    <div className="al-fg al-fg-contagem al-fg-torto-esq" role="group" aria-labelledby={id}>
      <p id={id} className="al-cond al-fg-titulo">
        {t.rotulo} · {titulo}
        <span className="sr-only">. {f.passou ? t.comecou : falta}</span>
      </p>
      <dl className="al-fg-flaps al-cond" aria-hidden>
        <div className="al-fg-flap">
          <dt>{t.dias}</dt>
          <dd>{f.dias}</dd>
        </div>
        <div className="al-fg-flap">
          <dt>{t.horas}</dt>
          <dd>{doisDigitos(f.horas)}</dd>
        </div>
        <div className="al-fg-flap">
          <dt>{t.min}</dt>
          <dd>{doisDigitos(f.minutos)}</dd>
        </div>
      </dl>
      {children}
    </div>
  );
}

/**
 * A figurinha de contagem no visor (prancha celular-ver-story): quanto falta para o ato e "Me avise quando começar". O aviso é um
 * lembrete SÓ de quem pediu: a autora não fica sabendo quem pediu, nem quantos (PLANO-ALUMIA §6.1). Depois que começa, leva ao ato.
 */
export function ContagemVer({ f, t, agora, lang, ocupado, aoAvisar }: { f: FigurinhaContagem; t: T; agora: number; lang: string; ocupado: boolean; aoAvisar: ((sim: boolean) => void) | null }) {
  const passou = faltaParaOAto(f.inicio, agora).passou;
  return (
    <Cartao t={t} titulo={f.titulo} inicio={f.inicio} agora={agora}>
      {passou ? (
        f.ato ? (
          <Link href={`/${lang}/alumia/ato/${encodeURIComponent(f.ato)}`} className="al-fg-botao-noite">
            {t.verAto}
          </Link>
        ) : null
      ) : aoAvisar ? (
        <button type="button" className="al-fg-botao-noite" aria-pressed={!!f.avisar} disabled={ocupado} onClick={() => aoAvisar(!f.avisar)}>
          {f.avisar ? t.avisado : t.avisar}
        </button>
      ) : null}
    </Cartao>
  );
}

/** A figurinha de contagem no "criar": escolher um dos próximos atos (os que organizo ou confirmei). */
export function ContagemEditar({ t, atos, ato, agora, aoEscolher }: { t: T; atos: AtoParaContagem[] | null; ato: string | null; agora: number; aoEscolher: (a: AtoParaContagem) => void }) {
  const id = useId();
  const escolhido = atos?.find((a) => a.id === ato) ?? null;
  if (atos && atos.length === 0) {
    return (
      <div className="al-fg al-fg-papel al-fg-torto-esq">
        <p className="al-fg-etiqueta">{t.rotulo}</p>
        <p className="al-fg-pergunta-texto" style={{ margin: 0 }}>{t.semAtos}</p>
      </div>
    );
  }
  return (
    <Cartao t={t} titulo={escolhido?.titulo ?? "…"} inicio={escolhido?.inicio ?? new Date(agora).toISOString()} agora={agora}>
      <label htmlFor={id} className="sr-only">{t.escolha}</label>
      <select
        id={id}
        className="al-fg-escolha"
        style={{ marginTop: 10 }}
        value={ato ?? ""}
        disabled={!atos}
        onChange={(e) => {
          const a = atos?.find((x) => x.id === e.target.value);
          if (a) aoEscolher(a);
        }}
      >
        <option value="" disabled>{t.escolha}</option>
        {(atos ?? []).map((a) => (
          <option key={a.id} value={a.id}>{a.titulo}</option>
        ))}
      </select>
    </Cartao>
  );
}

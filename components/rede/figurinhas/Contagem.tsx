// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import Link from "@/components/Link";
import { doisDigitos, faltaParaOAto, horaLocalParaIso, isoParaHoraLocal } from "@/lib/rede/stories/tempo";
import type { TextosDosStories } from "@/lib/rede/textos-stories";
import type { AtoParaContagem, FigurinhaContagem } from "@/lib/rede/tipos-stories";
import { preencherStory } from "../stories/usar";

type T = TextosDosStories["figurinha"]["contagem"];

/** Menos de um dia para o começo: a contagem passa a andar de segundo em segundo (P5). Fora disso, o relógio de quem chama basta. */
function useSegundos(inicio: string, agora: number): number {
  const perto = (() => {
    const ms = Date.parse(inicio) - agora;
    return Number.isFinite(ms) && ms > 0 && ms < 86_400_000;
  })();
  const [tique, setTique] = useState(agora);
  useEffect(() => {
    if (!perto) return;
    const parado = typeof document !== "undefined" && document.documentElement.hasAttribute("data-parado");
    if (parado) return;
    const id = setInterval(() => setTique(Date.now()), 1000);
    return () => clearInterval(id);
  }, [perto]);
  return perto ? Math.max(agora, tique) : agora;
}

/** As plaquinhas (dias, horas, minutos e, na reta final, segundos) e o nome: o mesmo desenho no visor e no "criar". */
function Cartao({ t, titulo, inicio, agora, livre, children }: { t: T; titulo: string; inicio: string; agora: number; livre?: boolean; children?: ReactNode }) {
  const id = useId();
  const relogio = useSegundos(inicio, agora);
  const f = faltaParaOAto(inicio, relogio);
  const segundos = Math.max(0, Math.floor((Date.parse(inicio) - relogio) / 1000) % 60);
  const reta = !f.passou && f.dias === 0;
  const falta = preencherStory(t.falta, { dias: f.dias, horas: f.horas, min: f.minutos, titulo });
  return (
    <div className="al-fg al-fg-contagem al-fg-torto-esq" role="group" aria-labelledby={id}>
      <p id={id} className="al-cond al-fg-titulo">
        {livre ? t.rotuloLivre : t.rotulo} · {titulo}
        <span className="sr-only">. {f.passou ? t.comecou : falta}</span>
      </p>
      <dl className="al-fg-flaps al-cond" aria-hidden>
        {reta ? null : (
          <div className="al-fg-flap">
            <dt>{t.dias}</dt>
            <dd>{f.dias}</dd>
          </div>
        )}
        <div className="al-fg-flap">
          <dt>{t.horas}</dt>
          <dd>{doisDigitos(f.horas)}</dd>
        </div>
        <div className="al-fg-flap">
          <dt>{t.min}</dt>
          <dd>{doisDigitos(f.minutos)}</dd>
        </div>
        {reta ? (
          <div className="al-fg-flap">
            <dt>{t.seg}</dt>
            <dd>{doisDigitos(segundos)}</dd>
          </div>
        ) : null}
      </dl>
      {children}
    </div>
  );
}

/**
 * A figurinha de contagem no visor (prancha celular-ver-story): quanto falta para o ato e "Me avise quando começar". O aviso é um
 * lembrete SÓ de quem pediu: a autora não fica sabendo quem pediu, nem quantos (PLANO-ALUMIA §6.1). Depois que começa, leva ao ato.
 * A contagem livre (P5) não tem ato: nem aviso, nem link.
 */
export function ContagemVer({ f, t, agora, lang, ocupado, aoAvisar }: { f: FigurinhaContagem; t: T; agora: number; lang: string; ocupado: boolean; aoAvisar: ((sim: boolean) => void) | null }) {
  const passou = faltaParaOAto(f.inicio, agora).passou;
  return (
    <Cartao t={t} titulo={f.titulo} inicio={f.inicio} agora={agora} livre={f.livre}>
      {passou ? (
        f.ato ? (
          <Link href={`/${lang}/alumia/ato/${encodeURIComponent(f.ato)}`} className="al-fg-botao-noite">
            {t.verAto}
          </Link>
        ) : f.livre ? (
          <p className="al-fg-botao-noite" style={{ margin: "10px 0 0" }}>
            {t.comecou}
          </p>
        ) : null
      ) : aoAvisar && f.ato && !f.livre ? (
        <button type="button" className="al-fg-botao-noite" aria-pressed={!!f.avisar} disabled={ocupado} onClick={() => aoAvisar(!f.avisar)}>
          {f.avisar ? t.avisado : t.avisar}
        </button>
      ) : null}
    </Cartao>
  );
}

/**
 * A figurinha de contagem no "criar": um dos próximos atos (os que organizo ou confirmei) ou, P5, um momento livre (nome e hora
 * escritos aqui, de 1 minuto a 1 ano à frente; o banco confere de novo).
 */
export function ContagemEditar({
  t,
  atos,
  f,
  agora,
  aoEscolher,
  aoLivre,
}: {
  t: T;
  atos: AtoParaContagem[] | null;
  f: FigurinhaContagem;
  agora: number;
  aoEscolher: (a: AtoParaContagem) => void;
  aoLivre: (livre: { titulo: string; inicio: string } | null) => void;
}) {
  const id = useId();
  const escolhido = atos?.find((a) => a.id === f.ato) ?? null;
  const livre = !!f.livre;
  const modo = (
    <div className="al-fg-modo-contagem" role="radiogroup" aria-label={t.tipo}>
      <button type="button" role="radio" aria-checked={!livre} onClick={() => aoLivre(null)}>
        {t.doAto}
      </button>
      <button type="button" role="radio" aria-checked={livre} onClick={() => aoLivre({ titulo: f.titulo, inicio: f.inicio || new Date(agora + 86_400_000).toISOString() })}>
        {t.livre}
      </button>
    </div>
  );
  if (livre) {
    return (
      <Cartao t={t} titulo={f.titulo || "…"} inicio={f.inicio || new Date(agora).toISOString()} agora={agora} livre>
        {modo}
        <label className="al-fg-livre-campo">
          <span>{t.nomeDoMomento}</span>
          <input value={f.titulo} maxLength={60} placeholder={t.nomeVazio} onChange={(e) => aoLivre({ titulo: e.target.value, inicio: f.inicio })} />
        </label>
        <label className="al-fg-livre-campo">
          <span>{t.quando}</span>
          <input
            type="datetime-local"
            value={isoParaHoraLocal(f.inicio)}
            min={isoParaHoraLocal(new Date(agora + 60_000).toISOString())}
            onChange={(e) => aoLivre({ titulo: f.titulo, inicio: horaLocalParaIso(e.target.value) ?? "" })}
          />
        </label>
      </Cartao>
    );
  }
  if (atos && atos.length === 0) {
    return (
      <div className="al-fg al-fg-papel al-fg-torto-esq">
        <p className="al-fg-etiqueta">{t.rotulo}</p>
        {modo}
        <p className="al-fg-pergunta-texto" style={{ margin: 0 }}>{t.semAtos}</p>
      </div>
    );
  }
  return (
    <Cartao t={t} titulo={escolhido?.titulo ?? "…"} inicio={escolhido?.inicio ?? new Date(agora).toISOString()} agora={agora}>
      {modo}
      <label htmlFor={id} className="sr-only">{t.escolha}</label>
      <select
        id={id}
        className="al-fg-escolha"
        style={{ marginTop: 10 }}
        value={f.ato ?? ""}
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

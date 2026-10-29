// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { CopiarLink } from "@/components/CopiarLink";
import { useI18n } from "@/components/I18n";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { regioesDoMemorial, type RegiaoDoMemorial } from "@/lib/memorial";
import { normalize } from "@/lib/text";

export interface PessoaDoMuro {
  id: string;
  nome: string;
  /** "1951 – 2023", ou só o ano da morte quando o nascimento não é conhecido. */
  anos: string;
  local: string;
  regiao?: RegiaoDoMemorial;
  foto?: string;
  credito?: string;
  fonte?: string;
  texto: string;
  /** lang e data-content-lang quando o texto ainda está no original em português. */
  idioma: { lang?: string; "data-content-lang"?: string };
}

const letraDe = (nome: string) => {
  const l = normalize(nome).replace(/[^a-z0-9]/g, "").charAt(0).toUpperCase();
  return /[A-Z]/.test(l) ? l : "#";
};

/** Para quem não tem retrato livre, uma vela acesa: o muro vira vigília, e o lugar do retrato não fica vazio. */
function Vela() {
  return (
    <svg aria-hidden viewBox="-14 -22 108 135" className="h-full w-full">
      <circle cx="40" cy="38" r="20" className="muro-vela-brilho" />
      <g className="muro-vela-chama">
        <path d="M40 22 C44.6 29.5 46.8 34 46.8 38.4 A6.8 6.8 0 0 1 33.2 38.4 C33.2 34 35.4 29.5 40 22 Z" className="fill-oxblood" />
        <path d="M40 31 C42 34.3 43.1 36.4 43.1 38.6 A3.1 3.1 0 0 1 36.9 38.6 C36.9 36.4 38 34.3 40 31 Z" fill="#f0b323" />
      </g>
      <path d="M40 45.2 V49" className="stroke-ink" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M32.5 49.5 H47.5 V86 H32.5 Z M32.5 49.5 V55 C34.5 55 34.6 59.5 36.4 59.5 C38.2 59.5 38.2 55 40 55 H47.5" className="fill-folha stroke-ink" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M23 87.5 H57" className="stroke-ink" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * O memorial como um muro de retratos, do jeito que as Mães da Praça de Maio carregam os seus: o retrato em preto e
 * branco com a tarja de luto no canto, o nome e os anos embaixo; quem não tem retrato livre ganha uma vela. Tocar abre a homenagem inteira na largura do muro (uma
 * por vez); o endereço com #nome abre a de quem foi compartilhado. Busca, região onde a pessoa tombou e A–Z.
 */
export function MuroDoMemorial({ pessoas, s }: { pessoas: PessoaDoMuro[]; s: Dict["memorial"] }) {
  const { t } = useI18n();
  const [digitado, setDigitado] = useState("");
  const [regiao, setRegiao] = useState<RegiaoDoMemorial | "">("");
  const [letra, setLetra] = useState("");
  const chaves = useMemo(() => new Map(pessoas.map((p) => [p.id, normalize(`${p.nome} ${p.local} ${p.anos} ${p.texto}`)])), [pessoas]);
  const contagem = useMemo(() => {
    const porRegiao = new Map<RegiaoDoMemorial, number>();
    for (const p of pessoas) if (p.regiao) porRegiao.set(p.regiao, (porRegiao.get(p.regiao) ?? 0) + 1);
    return porRegiao;
  }, [pessoas]);
  const termo = normalize(digitado.trim());
  const letras = [...new Set(pessoas.map((p) => letraDe(p.nome)))].sort();
  const vistos = pessoas.filter((p) => (!termo || chaves.get(p.id)?.includes(termo)) && (!regiao || p.regiao === regiao) && (!letra || letraDe(p.nome) === letra));

  // Quem chega com #nome no endereço (um link compartilhado) encontra a homenagem já aberta.
  useEffect(() => {
    const abrir = () => {
      const alvo = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (alvo instanceof HTMLDetailsElement) {
        alvo.open = true;
        alvo.scrollIntoView({ block: "start" });
      }
    };
    abrir();
    window.addEventListener("hashchange", abrir);
    return () => window.removeEventListener("hashchange", abrir);
  }, []);

  return (
    <>
      <div className="no-print mt-10 grid gap-5 font-sans text-sm">
        <label className="block max-w-md">
          {t.lists.find}
          <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} maxLength={80} className="mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2" />
        </label>
        <div className="min-w-0">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft">{s.where}</p>
          <div role="group" aria-label={s.where} className="mt-2 flex flex-wrap items-end gap-1.5 border-b-2 border-ink">
            <button type="button" aria-pressed={regiao === ""} onClick={() => setRegiao("")} className="aba-pasta aba-luto">
              {s.all} <span className="muro-conta">{pessoas.length}</span>
            </button>
            {regioesDoMemorial
              .filter((r) => contagem.has(r))
              .map((r) => (
                <button key={r} type="button" aria-pressed={regiao === r} onClick={() => setRegiao(r === regiao ? "" : r)} className="aba-pasta aba-luto">
                  {s.regions[r]} <span className="muro-conta">{contagem.get(r)}</span>
                </button>
              ))}
          </div>
        </div>
        {letras.length > 3 && (
          <p className="flex flex-wrap gap-1" role="group" aria-label="A–Z">
            <button type="button" onClick={() => setLetra("")} aria-pressed={letra === ""} className={`muro-letra ${letra === "" ? "muro-letra-ativa" : ""}`}>∗</button>
            {letras.map((l) => (
              <button key={l} type="button" onClick={() => setLetra(l === letra ? "" : l)} aria-pressed={letra === l} className={`muro-letra ${letra === l ? "muro-letra-ativa" : ""}`}>{l}</button>
            ))}
          </p>
        )}
        <p className="font-mono text-xs text-ink-soft" role="status">{fill(t.lists.count, { n: vistos.length })}</p>
      </div>

      <ul aria-label={s.title} className="muro mt-8 grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 sm:gap-x-6 md:grid-cols-4 lg:grid-cols-5">
        {vistos.map((p) => (
          <li key={p.id} className="muro-item">
            <details
              id={p.id}
              name="memorial"
              className="muro-ficha scroll-mt-24"
              onToggle={(e) => {
                const ficha = e.currentTarget;
                if (!ficha.open || location.hash === `#${p.id}`) return;
                const leve = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                ficha.scrollIntoView({ block: "nearest", behavior: leve ? "auto" : "smooth" });
              }}
            >
              <summary className="muro-cartao">
                <span className="muro-retrato">
                  {p.foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.foto} alt="" width={360} height={450} loading="lazy" decoding="async" />
                  ) : (
                    <Vela />
                  )}
                </span>
                <h2 className="muro-nome mt-3 font-serif text-[1.12rem] font-semibold leading-tight text-balance">{p.nome}</h2>
                <span className="mt-1 block font-mono text-[0.72rem] text-ink-soft">{p.anos}</span>
              </summary>
              <div className="muro-homenagem" {...p.idioma}>
                <p className="font-mono text-xs text-gold">{p.local}</p>
                <p className="mt-3 text-lg leading-relaxed">{p.texto}</p>
                <p className="mt-4 font-sans text-xl font-black uppercase italic tracking-tight text-oxblood">★ {s.present}</p>
                {p.credito && p.fonte && (
                  <p className="mt-3 font-mono text-[0.7rem] leading-tight text-ink-soft" lang="pt-BR">
                    <a href={p.fonte} target="_blank" rel="noopener noreferrer" className="hover:text-oxblood hover:underline">{p.credito}</a>
                  </p>
                )}
                <p className="no-print mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
                  <CopiarLink id={p.id} />
                  <button
                    type="button"
                    onClick={(e) => {
                      const ficha = e.currentTarget.closest("details");
                      if (!ficha) return;
                      ficha.open = false;
                      ficha.querySelector("summary")?.focus();
                    }}
                    className="cursor-pointer font-sans text-xs text-ink-soft underline hover:text-oxblood"
                  >
                    {s.close}
                  </button>
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>
      {vistos.length === 0 && <p className="mt-6 text-lg text-ink-soft">{t.lists.none}</p>}
    </>
  );
}

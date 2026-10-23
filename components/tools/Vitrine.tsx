// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fill, localePath } from "@/i18n/config";
import { useI18n } from "../I18n";
import { Selo } from "../Selo";
import { ICONES, type ItemDaVitrine, type Textos } from "./vitrine-dados";

// A vitrine das ferramentas de prática (busca, matérias, favoritas e as últimas usadas) e a moldura de cada
// ferramenta (favoritar, tela cheia, copiar o link). Favoritas e recentes ficam só neste aparelho.

const CHAVE = "lucia:ferramentas";
interface Memoria {
  favoritas: string[];
  recentes: string[];
}
function ler(): Memoria {
  try {
    const d = JSON.parse(window.localStorage.getItem(CHAVE) ?? "{}") as Partial<Memoria>;
    return { favoritas: Array.isArray(d.favoritas) ? d.favoritas.slice(0, 60) : [], recentes: Array.isArray(d.recentes) ? d.recentes.slice(0, 8) : [] };
  } catch {
    return { favoritas: [], recentes: [] };
  }
}
function useMemoria() {
  const [m, setM] = useState<Memoria>({ favoritas: [], recentes: [] });
  useEffect(() => {
    void Promise.resolve().then(() => setM(ler()));
  }, []);
  const mudar = useCallback((f: (x: Memoria) => Memoria) => {
    const nova = f(ler());
    try {
      window.localStorage.setItem(CHAVE, JSON.stringify(nova));
    } catch {
      // Sem espaço ou modo anônimo: vale só nesta visita.
    }
    setM(nova);
  }, []);
  return [m, mudar] as const;
}

function Cartao({ i, lang, favorita, alternar, s, offline }: { i: ItemDaVitrine; lang: string; favorita: boolean; alternar: () => void; s: Textos; offline: string }) {
  return (
    <div className="cartao sobe group relative flex gap-3 p-4">
      <span className="selo h-12 w-12"><Selo nome={ICONES[i.id] ?? "ferramentas"} /></span>
      <span className="min-w-0 flex-1">
        <Link href={localePath(lang, `/ferramentas/${i.id}`)} className="font-serif text-xl font-semibold leading-tight after:absolute after:inset-0 group-hover:text-oxblood">{i.nome}</Link>
        <span className="mt-0.5 block text-sm text-ink-soft">{i.descricao}</span>
        <span className="mt-2 flex flex-wrap gap-1.5 text-[0.65rem] font-semibold uppercase tracking-wider">
          {i.materias && <span className="text-gold">{i.materias}</span>}
          {i.offline && <span className="border border-ink px-1 text-ink-soft">{offline}</span>}
        </span>
      </span>
      <button type="button" onClick={alternar} aria-pressed={favorita} aria-label={`${favorita ? s.unfavorite : s.favorite}: ${i.nome}`} title={favorita ? s.unfavorite : s.favorite} className={`relative z-10 h-8 w-8 shrink-0 cursor-pointer rounded-full text-lg ${favorita ? "text-[#c9a227]" : "text-ink/25 hover:text-[#c9a227]"}`}>★</button>
    </div>
  );
}

function Faixa({ titulo, lista, lang }: { titulo: string; lista: ItemDaVitrine[]; lang: string }) {
  if (!lista.length) return null;
  return (
    <section className="mt-8">
      <h2 className="font-mono text-xs uppercase tracking-widest text-oxblood">{titulo}</h2>
      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {lista.map((i) => (
          <Link key={i.id} href={localePath(lang, `/ferramentas/${i.id}`)} className="chip shrink-0 gap-2 font-semibold">
            <Selo nome={ICONES[i.id] ?? "ferramentas"} className="h-5 w-5" />{i.nome}
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Vitrine({ itens, grupos, laboratorios, s }: { itens: ItemDaVitrine[]; grupos: string[]; laboratorios: { nome: string; href: string }[]; s: Textos }) {
  const { lang } = useI18n();
  const [m, mudar] = useMemoria();
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const campo = useRef<HTMLInputElement>(null);
  const normal = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase();
  const termo = normal(busca.trim());
  const achados = useMemo(() => itens.filter((i) => (!grupo || i.grupo === grupo) && (!termo || normal(`${i.nome} ${i.descricao} ${i.materias}`).includes(termo))), [itens, grupo, termo]);
  const porId = useMemo(() => new Map(itens.map((i) => [i.id, i])), [itens]);
  // "/" leva para a busca, como nos buscadores.
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        campo.current?.focus();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const favorita = (id: string) => m.favoritas.includes(id);
  const alternar = (id: string) => mudar((x) => ({ ...x, favoritas: x.favoritas.includes(id) ? x.favoritas.filter((f) => f !== id) : [...x.favoritas, id] }));

  return (
    <div className="font-sans">
      <div className="sticky top-0 z-20 -mx-4 mt-8 border-b border-rule bg-parchment/95 px-4 py-3 backdrop-blur">
        <label className="relative block">
          <span className="sr-only">{s.findTool}</span>
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft">⌕</span>
          <input ref={campo} type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`${s.findTool}  ( / )`} className="w-full rounded-full border-2 border-ink bg-parchment-deep py-2.5 pl-9 pr-4 text-base" />
        </label>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 text-sm">
          {["", ...grupos].map((g) => (
            <button key={g || "todas"} type="button" aria-pressed={grupo === g} onClick={() => setGrupo(g)} className={`shrink-0 cursor-pointer rounded-full px-3 py-1 font-semibold ${grupo === g ? "bg-ink text-parchment" : "border border-rule hover:border-ink"}`}>{g || s.allGroups}</button>
          ))}
        </div>
      </div>

      {!termo && !grupo && (
        <>
          <Faixa titulo={`★ ${s.favorites}`} lista={m.favoritas.map((id) => porId.get(id)).filter((x): x is ItemDaVitrine => !!x)} lang={lang} />
          <Faixa titulo={`↺ ${s.recent}`} lista={m.recentes.map((id) => porId.get(id)).filter((x): x is ItemDaVitrine => !!x)} lang={lang} />
        </>
      )}

      <p className="mt-6 text-sm text-ink-soft">{fill(s.countTools, { n: achados.length })}</p>
      {achados.length === 0 && <p className="mt-4 text-lg text-ink-soft">{s.noResults}</p>}
      {(grupo || termo ? [grupo || ""] : grupos).map((g) => {
        const lista = achados.filter((i) => !g || i.grupo === g || termo);
        if (!lista.length) return null;
        return (
          <section key={g || "busca"} className="mt-6">
            {!termo && <h2 className="border-b border-rule pb-2 font-serif text-2xl font-semibold">{g}</h2>}
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{lista.map((i) => <Cartao key={i.id} i={i} lang={lang} favorita={favorita(i.id)} alternar={() => alternar(i.id)} s={s} offline={s.offline} />)}</div>
          </section>
        );
      })}

      <section className="mt-12 rounded-md border-2 border-ink bg-[#17130e] p-5 text-[#f4ecd8]">
        <h2 className="flex items-center gap-2.5 font-serif text-2xl font-semibold"><Selo nome="frasco" className="h-7 w-7" /> {s.labsTitle}</h2>
        <p className="mt-1 text-sm text-[#f4ecd8]/80">{s.labsText}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {laboratorios.map((l) => <Link key={l.href} href={l.href} className="rounded-full border border-[#f4ecd8]/40 px-3 py-1 text-sm hover:bg-white/10">{l.nome}</Link>)}
        </div>
      </section>
      <p className="mt-4 text-xs text-ink-soft">{s.localNote}</p>
    </div>
  );
}

/** A moldura de cada ferramenta: guarda nas recentes, favorita, abre em tela cheia e copia o link. */
export function Moldura({ id, s, children }: { id: string; s: Textos; children: React.ReactNode }) {
  const [m, mudar] = useMemoria();
  const [copiado, setCopiado] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    mudar((x) => ({ ...x, recentes: [id, ...x.recentes.filter((r) => r !== id)].slice(0, 8) }));
  }, [id, mudar]);
  const favorita = m.favoritas.includes(id);
  const botao = "flex cursor-pointer items-center gap-1 rounded-full border border-rule px-3 py-1 hover:border-ink";
  return (
    <div>
      <p className="mt-4 flex flex-wrap gap-2 font-sans text-sm">
        <button type="button" aria-pressed={favorita} onClick={() => mudar((x) => ({ ...x, favoritas: favorita ? x.favoritas.filter((f) => f !== id) : [...x.favoritas, id] }))} className={`${botao} ${favorita ? "border-[#c9a227] text-[#8a6d0f]" : ""}`}><span aria-hidden>{favorita ? "★" : "☆"}</span>{favorita ? s.unfavorite : s.favorite}</button>
        <button type="button" onClick={() => void caixa.current?.requestFullscreen?.().catch(() => undefined)} className={botao}><Selo nome="tela" className="h-4 w-4" />{s.focus}</button>
        <button type="button" onClick={() => { void navigator.clipboard.writeText(window.location.href).then(() => { setCopiado(true); window.setTimeout(() => setCopiado(false), 2000); }).catch(() => undefined); }} className={botao}><Selo nome="clipe" className="h-4 w-4" />{copiado ? s.linkCopied : s.copyLink}</button>
      </p>
      <div ref={caixa} className="mt-2 overflow-auto bg-parchment [&:fullscreen]:p-6">{children}</div>
    </div>
  );
}

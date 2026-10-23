// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import { lerPronuncia } from "@/lib/interativos";
import { lerArrastar, lerCena } from "@/lib/interativos-mais";
import { useI18n } from "../I18n";

// Cena clicável (explorar ou encontrar as partes de uma imagem), arrastar cada item para o grupo certo e montar a
// frase com as palavras embaralhadas. Tudo funciona também no toque e no teclado: arrastar é só um atalho.

const caixa = "no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm";
const botao = "cursor-pointer bg-ink px-4 py-2 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1 font-medium hover:border-oxblood hover:text-oxblood";
const embaralhar = <T,>(lista: T[]) => {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
};
const comparar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[.,!?;:¿¡"'«»“”]/g, "").replace(/\s+/g, " ").trim();

// ───────────── Cena clicável ─────────────

export function Cena({ spec }: { spec: string }) {
  const { t } = useI18n();
  const cena = useMemo(() => lerCena(spec), [spec]);
  const [aberta, setAberta] = useState<number | null>(null);
  const [ordem, setOrdem] = useState<number[]>(() => (cena ? embaralhar(cena.areas.map((_, i) => i)) : []));
  const [passo, setPasso] = useState(0);
  const [retorno, setRetorno] = useState<{ certo: boolean; texto: string } | null>(null);
  if (!cena) return <pre className="text-sm">{spec}</pre>;
  const encontrar = cena.modo === "encontrar";
  const alvo = encontrar && passo < ordem.length ? cena.areas[ordem[passo]] : null;

  function tocar(i: number | null) {
    if (!cena) return;
    if (!encontrar) {
      if (i !== null) setAberta(i);
      return;
    }
    if (!alvo) return;
    if (i !== null && cena.areas[i] === alvo) {
      setRetorno({ certo: true, texto: fill(t.blocks.foundIt, { nome: alvo.nome }) + (alvo.texto ? ` ${alvo.texto}` : "") });
      setPasso((p) => p + 1);
    } else setRetorno({ certo: false, texto: t.blocks.notThere });
  }

  return (
    <figure className={caixa}>
      {encontrar && (
        <p className="mb-2 font-serif text-lg" role="status">
          {alvo ? fill(t.blocks.findPrompt, { nome: alvo.nome }) : t.blocks.allFound}
        </p>
      )}
      <div className="relative inline-block max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- imagem do acervo, já otimizada no envio */}
        <img src={cena.imagem} alt={cena.descricao} className="block max-h-[70vh] max-w-full" onClick={() => tocar(null)} />
        {cena.areas.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              tocar(i);
            }}
            aria-label={encontrar ? `${t.blocks.area} ${i + 1}` : a.nome}
            aria-pressed={!encontrar ? aberta === i : undefined}
            className={`absolute cursor-pointer rounded-sm border-2 transition-colors focus:outline-2 focus:outline-oxblood ${encontrar ? "border-transparent hover:border-dashed hover:border-gold" : aberta === i ? "border-oxblood bg-oxblood/15" : "border-dashed border-gold/80 hover:bg-gold/15"}`}
            style={{ left: `${a.x}%`, top: `${a.y}%`, width: `${a.w}%`, height: `${a.h}%` }}
          />
        ))}
      </div>
      {!encontrar && aberta !== null && (
        <div className="mt-3 border-l-2 border-oxblood bg-parchment p-3" role="status">
          <p className="font-semibold">{cena.areas[aberta].nome}</p>
          {cena.areas[aberta].texto && <p className="mt-1">{cena.areas[aberta].texto}</p>}
        </div>
      )}
      {encontrar && retorno && <p className={`mt-2 font-medium ${retorno.certo ? "text-ok" : "text-oxblood"}`}>{retorno.texto}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {encontrar && <span className="font-mono text-xs">{fill(t.blocks.found, { a: Math.min(passo, ordem.length), b: ordem.length })}</span>}
        {encontrar && passo > 0 && <button type="button" className={claro} onClick={() => { setOrdem(embaralhar(cena.areas.map((_, i) => i))); setPasso(0); setRetorno(null); }}>{t.blocks.restart}</button>}
        {!encontrar && <span className="text-xs text-ink-soft">{t.blocks.sceneHint}</span>}
      </div>
    </figure>
  );
}

// ───────────── Arrastar para o grupo certo ─────────────

export function Arrastar({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { grupos } = useMemo(() => lerArrastar(spec), [spec]);
  const itens = useMemo(() => grupos.flatMap((g, gi) => g.itens.map((texto) => ({ texto, certo: gi }))), [grupos]);
  const [ordem, setOrdem] = useState(() => embaralhar(itens.map((_, i) => i)));
  const [onde, setOnde] = useState<Record<number, number>>({});
  const [escolhido, setEscolhido] = useState<number | null>(null);
  const [conferido, setConferido] = useState(false);
  if (!grupos.length) return <pre className="text-sm">{spec}</pre>;

  const por = (i: number, grupo: number) => {
    setOnde((o) => {
      const n = { ...o };
      if (grupo < 0) delete n[i];
      else n[i] = grupo;
      return n;
    });
    setEscolhido(null);
    setConferido(false);
  };
  const soltos = ordem.filter((i) => onde[i] === undefined);
  const errados = itens.filter((it, i) => onde[i] !== undefined && onde[i] !== it.certo).length + soltos.length;
  const ficha = (i: number) => {
    const marcado = conferido && onde[i] !== undefined ? (onde[i] === itens[i].certo ? "border-ok" : "border-oxblood") : escolhido === i ? "border-oxblood" : "border-ink";
    return (
      <button
        key={i}
        type="button"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("text/plain", String(i))}
        onClick={() => setEscolhido((x) => (x === i ? null : i))}
        aria-pressed={escolhido === i}
        className={`cursor-grab border-2 bg-parchment px-2.5 py-1 active:cursor-grabbing ${marcado}`}
      >
        {conferido && onde[i] !== undefined && (onde[i] === itens[i].certo ? "✓ " : "✗ ")}
        {itens[i].texto}
      </button>
    );
  };
  const soltar = (grupo: number) => ({
    onDragOver: (e: React.DragEvent) => e.preventDefault(),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      const i = Number(e.dataTransfer.getData("text/plain"));
      if (Number.isInteger(i) && itens[i]) por(i, grupo);
    },
    onClick: () => {
      if (escolhido !== null) por(escolhido, grupo);
    },
  });

  return (
    <div className={caixa}>
      <p className="text-xs text-ink-soft">{t.blocks.sortHint}</p>
      <div {...soltar(-1)} className="mt-2 flex min-h-12 flex-wrap gap-2 border-2 border-dashed border-rule p-2" aria-label={t.blocks.toSort}>
        {soltos.length ? soltos.map(ficha) : <span className="text-xs text-ink-soft">{t.blocks.toSort}: —</span>}
      </div>
      <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${grupos.length > 3 ? 150 : 200}px, 1fr))` }}>
        {grupos.map((g, gi) => (
          <section key={gi} {...soltar(gi)} aria-label={g.nome} className={`min-h-28 cursor-pointer border-2 bg-parchment p-2 ${escolhido !== null ? "border-gold" : "border-ink"}`}>
            <h4 className="mb-2 font-serif text-base font-semibold">{g.nome}</h4>
            <div className="flex flex-wrap gap-2">{ordem.filter((i) => onde[i] === gi).map(ficha)}</div>
          </section>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} disabled={soltos.length === itens.length} onClick={() => setConferido(true)}>{t.blocks.check}</button>
        <button type="button" className={claro} onClick={() => { setOnde({}); setOrdem(embaralhar(itens.map((_, i) => i))); setConferido(false); }}>{t.blocks.restart}</button>
        {conferido && <span role="status" className={`font-semibold ${errados ? "text-oxblood" : "text-ok"}`}>{errados ? fill(t.blocks.outOfPlace, { n: errados }) : t.blocks.allInPlace}</span>}
      </div>
    </div>
  );
}

// ───────────── Montar a frase ─────────────

function falar(texto: string, lingua: string) {
  if (!("speechSynthesis" in window)) return;
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = lingua;
  const voz = window.speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").toLowerCase().startsWith(lingua.toLowerCase().slice(0, 2)));
  if (voz) fala.voice = voz;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(fala);
}

export function Frase({ spec }: { spec: string }) {
  const { t } = useI18n();
  const { lingua, frases } = useMemo(() => lerPronuncia(spec), [spec]);
  const [i, setI] = useState(0);
  if (!frases.length) return <pre className="text-sm">{spec}</pre>;
  const f = frases[i % frases.length];
  return (
    <div className={caixa}>
      <UmaFrase key={i} texto={f.texto} traducao={f.traducao} lingua={lingua} />
      <div className="mt-3 flex items-center gap-2">
        <button type="button" className={claro} disabled={i === 0} onClick={() => setI((n) => n - 1)}>←</button>
        <span className="font-mono text-xs">{fill(t.blocks.cardOf, { i: i + 1, n: frases.length })}</span>
        <button type="button" className={claro} disabled={i >= frases.length - 1} onClick={() => setI((n) => n + 1)}>→</button>
      </div>
    </div>
  );
}

function UmaFrase({ texto, traducao, lingua }: { texto: string; traducao: string; lingua: string }) {
  const { t } = useI18n();
  const palavras = useMemo(() => texto.split(/\s+/).filter(Boolean), [texto]);
  const [banco, setBanco] = useState(() => {
    let e = embaralhar(palavras.map((_, k) => k));
    // Embaralhada igual à certa não tem graça.
    for (let tentativa = 0; tentativa < 5 && palavras.length > 1 && e.every((k, n) => k === n); tentativa++) e = embaralhar(e);
    return e;
  });
  const [resposta, setResposta] = useState<number[]>([]);
  const [conferida, setConferida] = useState<boolean | null>(null);
  const montada = resposta.map((k) => palavras[k]).join(" ");
  return (
    <div>
      {traducao && <p className="font-serif text-lg">{traducao}</p>}
      <p className="mt-1 text-xs text-ink-soft">{t.blocks.buildHint}</p>
      <div className="mt-2 flex min-h-11 flex-wrap gap-1.5 border-b-2 border-ink pb-2" aria-live="polite" lang={lingua}>
        {resposta.map((k, n) => (
          <button key={`${k}-${n}`} type="button" disabled={conferida === true} onClick={() => { setResposta((r) => r.filter((_, m) => m !== n)); setBanco((b) => [...b, k]); setConferida(null); }} className="cursor-pointer border-2 border-ink bg-parchment px-2 py-1 font-serif text-base">
            {palavras[k]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5" lang={lingua}>
        {banco.map((k, n) => (
          <button key={`${k}-${n}`} type="button" onClick={() => { setBanco((b) => b.filter((_, m) => m !== n)); setResposta((r) => [...r, k]); setConferida(null); }} className="cursor-pointer border-2 border-rule bg-parchment px-2 py-1 font-serif text-base hover:border-gold">
            {palavras[k]}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={botao} disabled={!resposta.length || conferida === true} onClick={() => setConferida(comparar(montada) === comparar(texto))}>{t.blocks.check}</button>
        {lingua && <button type="button" className={claro} aria-label={`${t.blocks.listen}: ${texto}`} onClick={() => falar(texto, lingua)}>{t.blocks.listen}</button>}
        {conferida !== null && <span role="status" className={`font-semibold ${conferida ? "text-ok" : "text-oxblood"}`}>{conferida ? t.blocks.right : t.blocks.wrong}</span>}
      </div>
    </div>
  );
}

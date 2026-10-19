// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import type { Dict } from "@/i18n/types";
import { localePath } from "@/i18n/config";
import { contarTexto } from "@/lib/ferramentas/diversas";
import { getItem, KEYS, parse, setItem, useStored } from "@/lib/storage";

type T = Dict["tools"];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const button = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-5 py-2 font-medium hover:border-oxblood hover:text-oxblood";
const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";
const tab = (on: boolean) => `cursor-pointer border-b-2 pb-1.5 ${on ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"}`;

/** Um bipe curto, gerado na hora (sem arquivo de som), para avisar que o tempo acabou. */
function bipe() {
  try {
    const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    for (const atraso of [0, 0.35, 0.7]) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.frequency.value = 880;
      ganho.gain.setValueAtTime(0.0001, ctx.currentTime + atraso);
      ganho.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + atraso + 0.02);
      ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + atraso + 0.25);
      osc.connect(ganho).connect(ctx.destination);
      osc.start(ctx.currentTime + atraso);
      osc.stop(ctx.currentTime + atraso + 0.3);
    }
    window.setTimeout(() => void ctx.close(), 1500);
  } catch {
    // sem áudio: o aviso escrito continua
  }
}

const relogio = (ms: number) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const seg = total % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(seg).padStart(2, "0")}`;
};

// ───────────── Cronômetro: Pomodoro, prova do Enem e cronômetro livre ─────────────

/** Tempos do Enem 2026 (edital do Inep): 1º dia 5h30, 2º dia 5h. */
const ENEM = { dia1: 5.5 * 3600 * 1000, dia2: 5 * 3600 * 1000 };

export function Cronometro({ s }: { s: T["timer"] }) {
  const [modo, setModo] = useState<"pomodoro" | "enem" | "livre">("pomodoro");
  const [foco, setFoco] = useState(25);
  const [pausa, setPausa] = useState(5);
  const [dia, setDia] = useState<"dia1" | "dia2">("dia1");
  const [som, setSom] = useState(true);
  // Contagem por horário de término (não por somar segundos): continua certa mesmo com a aba em segundo plano.
  const [fim, setFim] = useState<number | null>(null);
  const [restante, setRestante] = useState(25 * 60 * 1000);
  const [inicio, setInicio] = useState<number | null>(null);
  const [acumulado, setAcumulado] = useState(0);
  const [fase, setFase] = useState<"foco" | "pausa">("foco");
  const [rodada, setRodada] = useState(1);
  const [aviso, setAviso] = useState("");
  const [agora, setAgora] = useState(() => Date.now());

  const duracao = modo === "enem" ? ENEM[dia] : (fase === "foco" ? foco : pausa) * 60 * 1000;
  const rodando = modo === "livre" ? inicio !== null : fim !== null;

  useEffect(() => {
    if (!rodando) return;
    const id = window.setInterval(() => {
      const instante = Date.now();
      setAgora(instante);
      if (modo === "livre" || fim === null || instante < fim) return;
      // Acabou: avisa e, no Pomodoro, já prepara a fase seguinte (sem começar sozinho).
      if (som) bipe();
      setAviso(s.done);
      setFim(null);
      if (modo === "pomodoro") {
        const proxima = fase === "foco" ? "pausa" : "foco";
        if (proxima === "foco") setRodada((r) => r + 1);
        setFase(proxima);
        setRestante((proxima === "foco" ? foco : pausa) * 60 * 1000);
      } else setRestante(0);
    }, 250);
    return () => window.clearInterval(id);
  }, [rodando, modo, fim, fase, foco, pausa, som, s.done]);

  const mostrar = modo === "livre" ? acumulado + (inicio !== null ? agora - inicio : 0) : fim !== null ? fim - agora : restante;

  function trocarModo(novo: typeof modo) {
    setModo(novo);
    setFim(null);
    setInicio(null);
    setAcumulado(0);
    setFase("foco");
    setRodada(1);
    setAviso("");
    setRestante(novo === "enem" ? ENEM[dia] : foco * 60 * 1000);
  }
  function comecar() {
    setAviso("");
    setAgora(Date.now());
    if (modo === "livre") setInicio(Date.now());
    else setFim(Date.now() + restante);
  }
  function pausar() {
    if (modo === "livre") {
      if (inicio !== null) setAcumulado((a) => a + Date.now() - inicio);
      setInicio(null);
    } else if (fim !== null) {
      setRestante(fim - Date.now());
      setFim(null);
    }
  }
  function zerar() {
    setFim(null);
    setInicio(null);
    setAcumulado(0);
    setAviso("");
    setRestante(duracao);
  }

  return (
    <div className="mt-8 max-w-xl font-sans text-sm">
      <div role="tablist" className="flex flex-wrap gap-x-6 gap-y-1 border-b border-rule">
        {(["pomodoro", "enem", "livre"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={modo === id} className={tab(modo === id)} onClick={() => trocarModo(id)}>
            {(s.modes as Record<string, string>)[id]}
          </button>
        ))}
      </div>
      {modo === "pomodoro" && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            {s.focus} ({s.minutes})
            <input type="number" min={1} max={180} value={foco} disabled={rodando} onChange={(e) => { const v = Math.max(1, Math.min(180, Number(e.target.value) || 1)); setFoco(v); if (fase === "foco") setRestante(v * 60 * 1000); }} className={field} />
          </label>
          <label className="block">
            {s.break} ({s.minutes})
            <input type="number" min={1} max={60} value={pausa} disabled={rodando} onChange={(e) => { const v = Math.max(1, Math.min(60, Number(e.target.value) || 1)); setPausa(v); if (fase === "pausa") setRestante(v * 60 * 1000); }} className={field} />
          </label>
        </div>
      )}
      {modo === "enem" && (
        <fieldset className="mt-4 space-y-1">
          {(["dia1", "dia2"] as const).map((id) => (
            <label key={id} className="flex items-start gap-2">
              <input type="radio" name="dia" checked={dia === id} disabled={rodando} onChange={() => { setDia(id); setRestante(ENEM[id]); }} className="mt-1" />
              {(s as Record<string, unknown>)[id] as string}
            </label>
          ))}
        </fieldset>
      )}
      <p className="mt-6 text-center" role="timer" aria-live="off">
        {modo === "pomodoro" && <span className={`block ${rotulo}`}>{fase === "foco" ? s.focus : s.break} · {s.round.replace("{n}", String(rodada))}</span>}
        <span className="block font-mono text-6xl tabular-nums">{relogio(mostrar)}</span>
      </p>
      <p className="mt-4 flex flex-wrap justify-center gap-3">
        {rodando ? <button type="button" className={button} onClick={pausar}>{s.pause}</button> : <button type="button" className={button} onClick={comecar}>{mostrar !== duracao && mostrar > 0 && modo !== "livre" ? s.resume : s.start}</button>}
        <button type="button" className={claro} onClick={zerar}>{s.reset}</button>
      </p>
      <p role="status" className="mt-3 min-h-5 text-center font-semibold text-oxblood">{aviso}</p>
      {modo !== "livre" && (
        <label className="mt-2 flex items-center justify-center gap-2">
          <input type="checkbox" checked={som} onChange={(e) => setSom(e.target.checked)} />
          {s.sound}
        </label>
      )}
      <p className="mt-4 text-ink-soft">{modo === "enem" ? s.enemNote : modo === "pomodoro" ? s.help : s.freeHelp}</p>
    </div>
  );
}

// ───────────── Folha de redação ─────────────

// O rascunho fica só neste aparelho, e só depois de a pessoa começar a escrever. Fica também na memória da página,
// para a folha continuar funcionando quando o navegador não deixa guardar nada (aba anônima, por exemplo).
let rascunho: string | null = null;
const avisarRascunho = new Set<() => void>();
const assinarRascunho = (avisar: () => void) => {
  avisarRascunho.add(avisar);
  return () => {
    avisarRascunho.delete(avisar);
  };
};
const lerRascunho = () => (rascunho ??= getItem(KEYS.essay));

export function Redacao({ s, lang }: { s: T["essay"]; lang: string }) {
  const texto = useSyncExternalStore(assinarRascunho, lerRascunho, () => "");
  const [porLinha, setPorLinha] = useState(70);
  const mudar = (valor: string) => {
    rascunho = valor;
    setItem(KEYS.essay, valor || null);
    avisarRascunho.forEach((avisar) => avisar());
  };
  const c = contarTexto(texto, porLinha);
  const alerta = c.linhas > 30 ? s.over : c.linhas > 0 && c.linhas <= 7 ? s.under : "";
  return (
    <div className="mt-8 grid max-w-5xl gap-8 font-sans text-sm lg:grid-cols-[minmax(0,1fr)_18rem] @max-3xl:lg:grid-cols-1 @max-3xl:gap-4">
      <div>
        <label className="block">
          {s.sheet}
          <textarea
            value={texto}
            onChange={(e) => mudar(e.target.value)}
            rows={24}
            placeholder={s.placeholder}
            className="mt-1 w-full border-2 border-ink bg-parchment-deep px-4 py-2 font-serif text-lg leading-8 [background-image:repeating-linear-gradient(transparent,transparent_31px,var(--rule)_31px,var(--rule)_32px)] [background-attachment:local]"
          />
        </label>
        <p className="mt-1 text-xs text-ink-soft">{s.saved}</p>
      </div>
      <aside className="space-y-4">
        <dl className="space-y-1">
          {[
            [s.lines, `${c.linhas} / 30`],
            [s.words, c.palavras],
            [s.paragraphs, c.paragrafos],
            [s.chars, c.caracteres],
          ].map(([nome, valor]) => (
            <div key={String(nome)} className="flex justify-between border-b border-rule py-1">
              <dt>{nome}</dt>
              <dd className="font-mono">{valor}</dd>
            </div>
          ))}
        </dl>
        {alerta && <p role="status" className="font-semibold text-oxblood">{alerta}</p>}
        <label className="block">
          {s.perLine}
          <input type="number" min={20} max={120} value={porLinha} onChange={(e) => setPorLinha(Math.max(20, Math.min(120, Number(e.target.value) || 70)))} className={field} />
        </label>
        <p className="text-xs text-ink-soft">{s.perLineHelp}</p>
        <p className="text-xs text-ink-soft">{s.limit}</p>
        <section>
          <p className={rotulo}>{s.competencies}</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            {(s.list as string[]).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          <Link href={localePath(lang, "/trilhas/enem-redacao")} className="mt-3 inline-block underline hover:text-oxblood">{s.lessons}</Link>
        </section>
      </aside>
      <RevisaoGuiada s={s} texto={texto} paragrafos={c.paragrafos} />
      <section className="border-t border-rule pt-6 lg:col-span-2 @max-3xl:lg:col-span-1">
        <p className="text-ink-soft">{s.askCorrectionNote}</p>
        <button
          type="button"
          disabled={c.palavras < 50}
          className={`mt-2 ${button}`}
          onClick={() => {
            try {
              sessionStorage.setItem("lucia:redacao-para-correcao", texto.slice(0, 2800));
            } catch {
              // sem armazenamento: o reforço abre vazio e a pessoa cola o texto
            }
            window.location.href = localePath(lang, "/reforco?disciplina=enem&redacao=1");
          }}
        >
          {s.askCorrection}
        </button>
      </section>
    </div>
  );
}

// Palavras que ligam as ideias (competência 4). A contagem só orienta: a banca lê o uso, não o número.
const CONECTIVOS = ["além disso", "ademais", "portanto", "logo", "assim", "dessa forma", "desse modo", "nesse sentido", "por conseguinte", "entretanto", "contudo", "todavia", "no entanto", "porém", "embora", "apesar de", "visto que", "uma vez que", "já que", "pois", "porque", "consequentemente", "em suma", "por fim", "primeiramente", "em primeiro lugar", "em segundo lugar", "outrossim", "sobretudo", "ou seja", "isto é", "por exemplo", "diante disso", "nesse contexto"];
const contarConectivos = (texto: string) => {
  const baixo = ` ${texto.toLowerCase().replace(/[^\p{L}\s]/gu, " ").replace(/\s+/g, " ")} `;
  return CONECTIVOS.reduce((total, conectivo) => total + (baixo.split(` ${conectivo} `).length - 1), 0);
};

/** Revisão guiada pelas cinco competências: a pessoa marca o que já está certo. Nada sai do aparelho. */
function RevisaoGuiada({ s, texto, paragrafos }: { s: T["essay"]; texto: string; paragrafos: number }) {
  const guardado = useStored(KEYS.essayCheck);
  const grupos = s.checks as string[][];
  const validos = new Set(grupos.flatMap((g, i) => g.map((_, j) => `${i}-${j}`)));
  const marcados = new Set(parse<string[]>(guardado, []).filter((id) => validos.has(id)));
  const alternar = (id: string) => {
    const novo = new Set(marcados);
    if (novo.has(id)) novo.delete(id);
    else novo.add(id);
    setItem(KEYS.essayCheck, novo.size ? JSON.stringify([...novo]) : null);
  };
  const conectivos = contarConectivos(texto);
  return (
    <section className="border-t border-rule pt-6 lg:col-span-2 @max-3xl:lg:col-span-1">
      <h3 className="font-serif text-xl">{s.checkTitle}</h3>
      <p className="mt-1 text-ink-soft">{s.checkLead}</p>
      <p className="mt-2 font-mono text-xs">{s.checkDone.replace("{a}", String(marcados.size)).replace("{b}", String(validos.size))}</p>
      <div className="mt-4 grid gap-5 md:grid-cols-2">
        {grupos.map((itens, i) => (
          <fieldset key={i} className="border border-rule p-4">
            <legend className={`px-1 ${rotulo}`}>{s.competencyN.replace("{n}", String(i + 1))}</legend>
            <ul className="space-y-2">
              {itens.map((item, j) => {
                const id = `${i}-${j}`;
                return (
                  <li key={id}>
                    <label className="flex cursor-pointer gap-2">
                      <input type="checkbox" checked={marcados.has(id)} onChange={() => alternar(id)} className="mt-1 accent-[var(--oxblood)]" />
                      <span>{item}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {i === 1 && texto.trim() !== "" && <p className="mt-3 text-xs text-ink-soft">{s.paragraphHint.replace("{n}", String(paragrafos))}</p>}
            {i === 3 && texto.trim() !== "" && <p className="mt-3 text-xs text-ink-soft">{s.connectors.replace("{n}", String(conectivos))}</p>}
          </fieldset>
        ))}
      </div>
      <button type="button" className={`mt-4 ${claro}`} onClick={() => setItem(KEYS.essayCheck, null)}>{s.checkReset}</button>
    </section>
  );
}

// ───────────── Silabário ─────────────

const VOGAIS = ["A", "E", "I", "O", "U"];
const FAMILIAS: [string, string[]][] = [
  ["B", ["BA", "BE", "BI", "BO", "BU"]],
  ["C", ["CA", "CE", "CI", "CO", "CU"]],
  ["D", ["DA", "DE", "DI", "DO", "DU"]],
  ["F", ["FA", "FE", "FI", "FO", "FU"]],
  ["G", ["GA", "GE", "GI", "GO", "GU"]],
  ["J", ["JA", "JE", "JI", "JO", "JU"]],
  ["L", ["LA", "LE", "LI", "LO", "LU"]],
  ["M", ["MA", "ME", "MI", "MO", "MU"]],
  ["N", ["NA", "NE", "NI", "NO", "NU"]],
  ["P", ["PA", "PE", "PI", "PO", "PU"]],
  ["QU", ["QUA", "QUE", "QUI", "QUO"]],
  ["R", ["RA", "RE", "RI", "RO", "RU"]],
  ["S", ["SA", "SE", "SI", "SO", "SU"]],
  ["T", ["TA", "TE", "TI", "TO", "TU"]],
  ["V", ["VA", "VE", "VI", "VO", "VU"]],
  ["X", ["XA", "XE", "XI", "XO", "XU"]],
  ["Z", ["ZA", "ZE", "ZI", "ZO", "ZU"]],
  ["Ç", ["ÇA", "ÇO", "ÇU"]],
  ["CH", ["CHA", "CHE", "CHI", "CHO", "CHU"]],
  ["LH", ["LHA", "LHE", "LHI", "LHO", "LHU"]],
  ["NH", ["NHA", "NHE", "NHI", "NHO", "NHU"]],
];
const PALAVRAS = ["BOLA", "CASA", "PATO", "SAPATO", "MALA", "JANELA", "CHUVA", "TRABALHO", "ESCOLA", "LUTA"];

const assinarVozes = (avisar: () => void) => {
  if (!("speechSynthesis" in window)) return () => {};
  window.speechSynthesis.addEventListener("voiceschanged", avisar);
  return () => window.speechSynthesis.removeEventListener("voiceschanged", avisar);
};
/** A voz em português instalada no aparelho, pelo nome ("" quando não há nenhuma). */
const vozPortuguesa = () => {
  if (!("speechSynthesis" in window)) return "";
  const vozes = window.speechSynthesis.getVoices();
  return (vozes.find((v) => v.lang === "pt-BR") ?? vozes.find((v) => v.lang.startsWith("pt")))?.name ?? "";
};

export function Silabario({ s }: { s: T["syllables"] }) {
  const [palavra, setPalavra] = useState<string[]>([]);
  // null enquanto a página ainda não chegou ao navegador; "" quando o aparelho não tem voz em português.
  const nomeDaVoz = useSyncExternalStore(assinarVozes, vozPortuguesa, () => null);

  // Sílaba solta é lida devagar e em minúsculas, para a voz não soletrar as letras (B-A em vez de "ba").
  function falar(texto: string) {
    if (!nomeDaVoz || !("speechSynthesis" in window)) return;
    const voz = window.speechSynthesis.getVoices().find((v) => v.name === nomeDaVoz);
    if (!voz) return;
    window.speechSynthesis.cancel();
    const fala = new SpeechSynthesisUtterance(texto.toLowerCase());
    fala.voice = voz;
    fala.lang = voz.lang;
    fala.rate = 0.75;
    window.speechSynthesis.speak(fala);
  }

  const tecla = "min-h-14 min-w-16 cursor-pointer border-2 border-ink bg-parchment-deep px-3 py-2 font-sans text-2xl font-semibold hover:border-oxblood hover:text-oxblood";
  const tocar = (silaba: string) => {
    falar(silaba);
    setPalavra((p) => [...p, silaba].slice(-8));
  };
  return (
    <div className="mt-8 font-sans text-sm">
      <p className="text-ink-soft">{s.help}</p>
      {nomeDaVoz === "" && <p role="status" className="mt-2 text-oxblood">{s.noVoice}</p>}
      <section className="mt-6 border-2 border-ink p-4">
        <p className={rotulo}>{s.word}</p>
        <p className="mt-2 min-h-12 font-sans text-4xl font-bold tracking-wide" aria-live="polite">{palavra.join("") || "…"}</p>
        <p className="mt-3 flex flex-wrap gap-3">
          <button type="button" className={button} disabled={!palavra.length || !nomeDaVoz} onClick={() => falar(palavra.join(""))}>{s.listen}</button>
          <button type="button" className={claro} disabled={!palavra.length} onClick={() => setPalavra((p) => p.slice(0, -1))}>⌫</button>
          <button type="button" className={claro} disabled={!palavra.length} onClick={() => setPalavra([])}>{s.clear}</button>
        </p>
      </section>
      <section className="mt-6">
        <p className={rotulo}>{s.vowels}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {VOGAIS.map((v) => (
            <button key={v} type="button" className={tecla} onClick={() => tocar(v)}>{v}</button>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <p className={rotulo}>{s.families}</p>
        <div className="mt-2 space-y-2">
          {FAMILIAS.map(([letra, silabas]) => (
            <div key={letra} className="flex flex-wrap gap-2" role="group" aria-label={letra}>
              {silabas.map((silaba) => (
                <button key={silaba} type="button" className={tecla} onClick={() => tocar(silaba)}>{silaba}</button>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section className="mt-6">
        <p className={rotulo}>{s.examples}</p>
        <p className="mt-2 flex flex-wrap gap-3">
          {PALAVRAS.map((p) => (
            <button key={p} type="button" className="cursor-pointer text-xl font-semibold underline hover:text-oxblood" onClick={() => falar(p)}>{p}</button>
          ))}
        </p>
      </section>
    </div>
  );
}

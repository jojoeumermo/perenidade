// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";
import { acharEscala, contraste, faixas, fcMaxima, fcMaximaAntiga, harmonias, lerHex, maisValia, mapaParaReal, paraHex, paraHsl, realParaMapa, type Rgb } from "@/lib/ferramentas/diversas";

type T = Dict["tools"];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const button = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-5 py-2 font-medium hover:border-oxblood hover:text-oxblood";
const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";
const tab = (on: boolean) => `cursor-pointer border-b-2 pb-1.5 ${on ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"}`;
const numero = (lang: string, v: number, casas = 2) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang, { maximumFractionDigits: casas }).format(v);
const lerNumero = (texto: string) => Number(texto.trim().replace(/\s/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
const preencher = (modelo: string, valores: Record<string, string | number>) => modelo.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? ""));

// ───────────── RCP ─────────────

/**
 * O compasso das compressões da RCP para leigos (só com as mãos). 110 por minuto, no meio da faixa de 100 a 120 das
 * diretrizes de 2025 da American Heart Association. Com som (um clique) e sem som (o círculo pulsa).
 */
export function Rcp({ s }: { s: T["cpr"] }) {
  const [ritmo, setRitmo] = useState(110);
  const [ligado, setLigado] = useState(false);
  const [batidas, setBatidas] = useState(0);
  const [comSom, setComSom] = useState(true);
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!ligado) return;
    const id = window.setInterval(() => {
      setBatidas((b) => b + 1);
      if (!comSom) return;
      try {
        ctx.current ??= new AudioContext();
        const osc = ctx.current.createOscillator();
        const ganho = ctx.current.createGain();
        osc.frequency.value = 1000;
        ganho.gain.setValueAtTime(0.25, ctx.current.currentTime);
        ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.current.currentTime + 0.06);
        osc.connect(ganho).connect(ctx.current.destination);
        osc.start();
        osc.stop(ctx.current.currentTime + 0.07);
      } catch {
        // sem áudio: o círculo continua marcando
      }
    }, 60000 / ritmo);
    return () => window.clearInterval(id);
  }, [ligado, ritmo, comSom]);
  useEffect(() => () => void ctx.current?.close(), []);
  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <p className="border-2 border-oxblood bg-parchment-deep p-4 text-base font-semibold">{s.call}</p>
      <div className="mt-6 flex flex-col items-center gap-4">
        <span aria-hidden className={`block h-32 w-32 rounded-full bg-oxblood ${ligado ? "transition-transform" : ""}`} style={{ transform: ligado && batidas % 2 ? "scale(0.82)" : "scale(1)", transitionDuration: `${Math.round(60000 / ritmo / 2)}ms` }} />
        <p className="font-mono text-lg" aria-live="off">{ligado ? `${batidas} ${s.count}` : `${ritmo} ${s.perMinute}`}</p>
        <p className="flex flex-wrap justify-center gap-3">
          <button type="button" className={button} onClick={() => { setBatidas(0); setLigado(!ligado); }}>{ligado ? s.stop : s.start}</button>
        </p>
        <label className="flex w-full max-w-sm items-center gap-3">
          <span className="whitespace-nowrap">{s.rate}</span>
          <input type="range" min={100} max={120} step={1} value={ritmo} onChange={(e) => setRitmo(Number(e.target.value))} className="w-full" />
          <span className="font-mono">{ritmo}</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={comSom} onChange={(e) => setComSom(e.target.checked)} />
          {s.sound}
        </label>
      </div>
      <ol className="mt-8 list-decimal space-y-2 pl-6 text-base">
        {(s.steps as string[]).map((passo) => (
          <li key={passo}>{passo}</li>
        ))}
      </ol>
      <p className="mt-6 border-l-2 border-oxblood pl-3 font-semibold">{s.warning}</p>
      <p className="mt-4 text-xs text-ink-soft">
        {s.sources}{" "}
        <a href="https://www.ahajournals.org/doi/10.1161/CIR.0000000000001369" target="_blank" rel="noopener noreferrer" className="underline">American Heart Association, 2025</a> ·{" "}
        <a href="https://www.gov.br/saude/pt-br/composicao/saes/samu-192" target="_blank" rel="noopener noreferrer" className="underline">SAMU 192</a>
      </p>
    </div>
  );
}

// ───────────── Frequência cardíaca ─────────────

export function FrequenciaCardiaca({ s }: { s: T["heart"] }) {
  const [idade, setIdade] = useState("30");
  const anos = Number(idade);
  let calculo: { tanaka: number; antiga: number } | null = null;
  try {
    calculo = { tanaka: fcMaxima(anos), antiga: fcMaximaAntiga(anos) };
  } catch {
    calculo = null;
  }
  return (
    <div className="mt-8 max-w-xl font-sans text-sm">
      <label className="block max-w-xs">
        {s.age}
        <input type="number" min={10} max={100} value={idade} onChange={(e) => setIdade(e.target.value)} className={field} />
      </label>
      {!calculo ? (
        <p role="status" className="mt-4 text-oxblood">{s.invalid}</p>
      ) : (
        <div role="status" className="mt-5 space-y-4">
          <div className="border-2 border-ink bg-parchment-deep p-4">
            <p className={rotulo}>{s.max}</p>
            <p className="mt-1 font-mono text-3xl">{Math.round(calculo.tanaka)} <span className="font-sans text-base">{s.bpm}</span></p>
            <p className="text-ink-soft">{s.tanaka}</p>
            <p className="mt-2 font-mono">{calculo.antiga} {s.bpm}</p>
            <p className="text-ink-soft">{s.fox}</p>
          </div>
          <section>
            <p className={rotulo}>{s.zones}</p>
            <ul className="mt-2 space-y-1">
              {faixas.map((f) => (
                <li key={f.id} className="flex justify-between border-b border-rule py-1">
                  <span>{(s as Record<string, unknown>)[f.id] as string}</span>
                  <span className="font-mono">{Math.round(calculo.tanaka * f.de)}–{Math.round(calculo.tanaka * f.ate)} {s.bpm}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
      <p className="mt-4">{s.howTo}</p>
      <p className="mt-4 border-l-2 border-oxblood pl-3">{s.warning}</p>
      <p className="mt-3 text-xs text-ink-soft">
        {s.sources}{" "}
        <a href="https://pubmed.ncbi.nlm.nih.gov/11153730/" target="_blank" rel="noopener noreferrer" className="underline">Tanaka, Monahan e Seals, 2001</a> ·{" "}
        <a href="https://www.heart.org/en/healthy-living/fitness/fitness-basics/target-heart-rates" target="_blank" rel="noopener noreferrer" className="underline">American Heart Association</a>
      </p>
    </div>
  );
}

// ───────────── Escala cartográfica ─────────────

const MEDIDAS = ["mm", "cm", "m", "km"];

export function Escala({ s, lang }: { s: T["mapScale"]; lang: string }) {
  const [modo, setModo] = useState<"real" | "mapa" | "escala">("real");
  const [escala, setEscala] = useState("100000");
  const [medida, setMedida] = useState("5");
  const [unidadeA, setUnidadeA] = useState("cm");
  const [unidadeB, setUnidadeB] = useState("km");
  const [outra, setOutra] = useState("15");
  const n = lerNumero(escala);
  const a = lerNumero(medida);
  const b = lerNumero(outra);
  let resultado = "";
  let conta = "";
  try {
    if (modo === "real") {
      const r = mapaParaReal(a, unidadeA, n, unidadeB);
      resultado = `${numero(lang, a, 4)} ${unidadeA} → ${numero(lang, r, 4)} ${unidadeB}`;
      conta = preencher(s.howReal, { a: numero(lang, a, 4), u: unidadeA, n: numero(lang, n, 0), r: numero(lang, r, 4), v: unidadeB });
    } else if (modo === "mapa") {
      const r = realParaMapa(a, unidadeB, n, unidadeA);
      resultado = `${numero(lang, a, 4)} ${unidadeB} → ${numero(lang, r, 4)} ${unidadeA}`;
      conta = preencher(s.howMap, { a: numero(lang, a, 4), u: unidadeB, n: numero(lang, n, 0), r: numero(lang, r, 4), v: unidadeA });
    } else {
      const r = acharEscala(a, unidadeA, b, unidadeB);
      resultado = `1 : ${numero(lang, r, 0)}`;
      conta = preencher(s.howFind, { a: numero(lang, a, 4), u: unidadeA, b: numero(lang, b, 4), v: unidadeB, r: numero(lang, r, 0) });
    }
  } catch {
    resultado = "";
  }
  const seletor = (valor: string, mudar: (v: string) => void, nome: string) => (
    <select value={valor} onChange={(e) => mudar(e.target.value)} aria-label={nome} className="mt-1 border-2 border-ink bg-parchment-deep px-2 py-2">
      {MEDIDAS.map((m) => (
        <option key={m} value={m}>{m}</option>
      ))}
    </select>
  );
  // Escala gráfica: uma barra de 5 cm dividida em 5, com quanto cada centímetro vale no terreno.
  const porCm = Number.isFinite(n) && n > 0 ? n / 100000 : 0;
  return (
    <div className="mt-8 max-w-xl font-sans text-sm">
      <div role="tablist" className="flex flex-wrap gap-x-6 gap-y-1 border-b border-rule">
        {(["real", "mapa", "escala"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={modo === id} className={tab(modo === id)} onClick={() => setModo(id)}>
            {(s.modes as Record<string, string>)[id]}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-3">
        {modo !== "escala" && (
          <label className="block">
            {s.scale}
            <span className="mt-1 flex items-center gap-2 font-mono">1 : <input value={escala} onChange={(e) => setEscala(e.target.value)} inputMode="numeric" className={`${field} mt-0`} /></span>
          </label>
        )}
        <div className="flex items-end gap-2">
          <label className="block flex-1">
            {modo === "mapa" ? s.real : s.onMap}
            <input value={medida} onChange={(e) => setMedida(e.target.value)} inputMode="decimal" className={field} />
          </label>
          {modo === "mapa" ? seletor(unidadeB, setUnidadeB, s.real) : seletor(unidadeA, setUnidadeA, s.onMap)}
        </div>
        {modo === "escala" && (
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              {s.real}
              <input value={outra} onChange={(e) => setOutra(e.target.value)} inputMode="decimal" className={field} />
            </label>
            {seletor(unidadeB, setUnidadeB, s.real)}
          </div>
        )}
        {modo !== "escala" && (
          <label className="flex items-center gap-2">
            {s.resultIn} {modo === "mapa" ? seletor(unidadeA, setUnidadeA, s.onMap) : seletor(unidadeB, setUnidadeB, s.real)}
          </label>
        )}
      </div>
      <div role="status" className="mt-5 border-2 border-ink bg-parchment-deep p-4">
        {resultado ? (
          <>
            <p className="font-mono text-2xl">{resultado}</p>
            <p className="mt-1 text-ink-soft">{conta}</p>
          </>
        ) : (
          <p className="text-oxblood">{s.invalid}</p>
        )}
      </div>
      {modo !== "escala" && porCm > 0 && (
        <figure className="mt-5">
          <figcaption className={rotulo}>{s.graphic}</figcaption>
          <div className="mt-2 flex w-[5cm] max-w-full border-2 border-ink" aria-hidden>
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-3 flex-1 ${i % 2 ? "bg-parchment" : "bg-ink"}`} />
            ))}
          </div>
          <p className="mt-1 font-mono text-xs">{preencher(s.graphicNote, { km: numero(lang, porCm, 3) })}</p>
        </figure>
      )}
    </div>
  );
}

// ───────────── Fusos horários ─────────────

/** Cidades e o fuso do banco de dados de fusos (IANA). As diferenças são calculadas pelo navegador, com o horário de verão de cada lugar. */
const CIDADES: [string, string][] = [
  ["brasilia", "America/Sao_Paulo"], ["manaus", "America/Manaus"], ["rio_branco", "America/Rio_Branco"], ["noronha", "America/Noronha"],
  ["buenos_aires", "America/Argentina/Buenos_Aires"], ["santiago", "America/Santiago"], ["bogota", "America/Bogota"], ["cidade_mexico", "America/Mexico_City"],
  ["havana", "America/Havana"], ["caracas", "America/Caracas"], ["la_paz", "America/La_Paz"], ["nova_york", "America/New_York"],
  ["lisboa", "Europe/Lisbon"], ["londres", "Europe/London"], ["paris", "Europe/Paris"], ["moscou", "Europe/Moscow"],
  ["luanda", "Africa/Luanda"], ["maputo", "Africa/Maputo"], ["joanesburgo", "Africa/Johannesburg"], ["nova_delhi", "Asia/Kolkata"],
  ["pequim", "Asia/Shanghai"], ["toquio", "Asia/Tokyo"], ["sydney", "Australia/Sydney"],
];

/** Diferença, em minutos, entre o horário local de um fuso e o UTC, num dado instante. */
function deslocamento(zona: string, instante: Date): number {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: zona, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(instante);
  const v = (t: string) => Number(partes.find((p) => p.type === t)?.value);
  const local = Date.UTC(v("year"), v("month") - 1, v("day"), v("hour"), v("minute"));
  return Math.round((local - Math.floor(instante.getTime() / 60000) * 60000) / 60000);
}

export function Fusos({ s, lang }: { s: T["timezones"]; lang: string }) {
  const nomes = s.cities as Record<string, string>;
  const [escolhidas, setEscolhidas] = useState(["brasilia", "manaus", "lisboa", "pequim"]);
  const [nova, setNova] = useState("");
  const [base, setBase] = useState("brasilia");
  const [hora, setHora] = useState("");
  const [agora, setAgora] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const zona = (id: string) => CIDADES.find(([c]) => c === id)?.[1] ?? "UTC";
  // Com um horário digitado: o instante em que, na cidade de base, o relógio marca essa hora hoje.
  const instante = useMemo(() => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(hora.trim());
    if (!m) return agora;
    const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: zona(base), year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
    const [ano, mes, dia] = hoje.split("-").map(Number);
    const palpite = new Date(Date.UTC(ano, mes - 1, dia, Number(m[1]), Number(m[2])));
    return new Date(palpite.getTime() - deslocamento(zona(base), palpite) * 60000);
  }, [hora, base, agora]);
  const locale = lang === "pt" ? "pt-BR" : lang;
  const formatar = (id: string) => new Intl.DateTimeFormat(locale, { timeZone: zona(id), weekday: "short", hour: "2-digit", minute: "2-digit" }).format(instante);
  const diferenca = (id: string) => {
    const d = (deslocamento(zona(id), instante) - deslocamento(zona("brasilia"), instante)) / 60;
    return d === 0 ? "0 h" : `${d > 0 ? "+" : "−"}${numero(lang, Math.abs(d), 2)} h`;
  };
  return (
    <div className="mt-8 max-w-xl font-sans text-sm">
      <ul className="divide-y divide-rule border-y border-rule">
        {escolhidas.map((id) => (
          <li key={id} className="flex items-center justify-between gap-3 py-2">
            <span>
              <span className="block font-semibold">{nomes[id]}</span>
              <span className="text-xs text-ink-soft">{s.offset}: {diferenca(id)}</span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-mono text-xl">{formatar(id)}</span>
              <button type="button" onClick={() => setEscolhidas(escolhidas.filter((c) => c !== id))} aria-label={`${s.remove}: ${nomes[id]}`} className="cursor-pointer px-1 hover:text-oxblood">✕</button>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-end gap-2">
        <label className="block flex-1">
          {s.add}
          <select value={nova} onChange={(e) => setNova(e.target.value)} className={field}>
            <option value="">…</option>
            {CIDADES.filter(([c]) => !escolhidas.includes(c)).map(([c]) => (
              <option key={c} value={c}>{nomes[c]}</option>
            ))}
          </select>
        </label>
        <button type="button" className={claro} disabled={!nova} onClick={() => { setEscolhidas([...escolhidas, nova]); setNova(""); }}>{s.add}</button>
      </div>
      <fieldset className="mt-5 border-t border-rule pt-4">
        <legend className={rotulo}>{s.compare}</legend>
        <div className="mt-2 flex flex-wrap items-end gap-2">
          <label className="block">
            {s.when}
            <input value={hora} onChange={(e) => setHora(e.target.value)} placeholder="14:30" inputMode="numeric" className={`${field} w-28`} />
          </label>
          <label className="block flex-1">
            {s.in}
            <select value={base} onChange={(e) => setBase(e.target.value)} className={field}>
              {CIDADES.map(([c]) => (
                <option key={c} value={c}>{nomes[c]}</option>
              ))}
            </select>
          </label>
          {hora && <button type="button" className={claro} onClick={() => setHora("")}>{s.now}</button>}
        </div>
      </fieldset>
      <p className="mt-4 text-ink-soft">{s.help}</p>
    </div>
  );
}

// ───────────── Cores e contraste ─────────────

export function Cores({ s }: { s: T["colors"] }) {
  const [cor, setCor] = useState("#c21f16");
  const [texto, setTexto] = useState("#1f1a14");
  const [fundo, setFundo] = useState("#f4ecd8");
  const ler = (hex: string): Rgb | null => {
    try {
      return lerHex(hex);
    } catch {
      return null;
    }
  };
  const rgb = ler(cor);
  const t = ler(texto);
  const f = ler(fundo);
  const razao = t && f ? contraste(t, f) : null;
  const amostra = (hex: string) => (
    <button key={hex} type="button" onClick={() => setCor(hex)} className="flex cursor-pointer items-center gap-2 border border-rule bg-parchment-deep px-2 py-1 font-mono hover:border-ink" title={s.use}>
      <span aria-hidden className="h-6 w-6 border border-ink" style={{ background: hex }} />
      {hex}
    </button>
  );
  const passa = (minimo: number) => (razao !== null && razao >= minimo ? `✓ ${s.pass}` : `✕ ${s.fail}`);
  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          {s.color}
          <input type="color" value={rgb ? paraHex(rgb) : "#000000"} onChange={(e) => setCor(e.target.value)} className="mt-1 block h-12 w-20 cursor-pointer border-2 border-ink" />
        </label>
        <label className="block">
          HEX
          <input value={cor} onChange={(e) => setCor(e.target.value)} spellCheck={false} className={`${field} w-32 font-mono`} />
        </label>
      </div>
      {rgb ? (
        <>
          <p className="mt-3 font-mono">
            RGB({rgb.r}, {rgb.g}, {rgb.b}) · HSL({paraHsl(rgb).h}°, {paraHsl(rgb).s}%, {paraHsl(rgb).l}%)
          </p>
          <p className={`mt-5 ${rotulo}`}>{s.harmonies}</p>
          {(["complementar", "analogas", "triade"] as const).map((tipo) => (
            <div key={tipo} className="mt-2 flex flex-wrap items-center gap-2">
              <span className="w-28">{(s.kinds as Record<string, string>)[tipo]}</span>
              {amostra(paraHex(rgb))}
              {harmonias(rgb)[tipo].map(amostra)}
            </div>
          ))}
        </>
      ) : (
        <p role="status" className="mt-3 text-oxblood">{s.invalid}</p>
      )}
      <section className="mt-8 border-t border-rule pt-5">
        <p className={rotulo}>{s.contrast}</p>
        <div className="mt-2 flex flex-wrap gap-3">
          {[
            [s.text, texto, setTexto],
            [s.background, fundo, setFundo],
          ].map(([nome, valor, mudar]) => (
            <label key={nome as string} className="block">
              {nome as string}
              <span className="mt-1 flex items-center gap-2">
                <input type="color" value={ler(valor as string) ? paraHex(ler(valor as string)!) : "#000000"} onChange={(e) => (mudar as (v: string) => void)(e.target.value)} className="h-10 w-14 cursor-pointer border-2 border-ink" />
                <input value={valor as string} onChange={(e) => (mudar as (v: string) => void)(e.target.value)} spellCheck={false} className="w-28 border-2 border-ink bg-parchment-deep px-2 py-2 font-mono" />
              </span>
            </label>
          ))}
        </div>
        {razao !== null && t && f && (
          <div role="status" className="mt-4">
            <p className="border-2 border-ink p-4 text-lg" style={{ color: paraHex(t), background: paraHex(f) }}>{s.sample}</p>
            <p className="mt-2 font-mono text-xl">{preencher(s.ratio, { r: razao.toFixed(2) })}</p>
            <ul className="mt-1 space-y-0.5">
              <li>{s.aaNormal}: {passa(4.5)}</li>
              <li>{s.aaLarge}: {passa(3)}</li>
              <li>{s.aaa}: {passa(7)}</li>
            </ul>
          </div>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          {s.source}{" "}
          <a href="https://www.w3.org/TR/WCAG21/#contrast-minimum" target="_blank" rel="noopener noreferrer" className="underline">WCAG 2.1</a>
        </p>
      </section>
    </div>
  );
}

// ───────────── Mais-valia ─────────────

export function MaisValia({ s, lang }: { s: T["surplus"]; lang: string }) {
  const [jornada, setJornada] = useState("8");
  const [necessario, setNecessario] = useState("4");
  const [salario, setSalario] = useState("100");
  let r: ReturnType<typeof maisValia> | null = null;
  try {
    r = maisValia(lerNumero(jornada), lerNumero(necessario), lerNumero(salario));
  } catch {
    r = null;
  }
  const dinheiro = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          {s.day}
          <input value={jornada} onChange={(e) => setJornada(e.target.value)} inputMode="decimal" className={field} />
        </label>
        <label className="block">
          {s.needed}
          <input value={necessario} onChange={(e) => setNecessario(e.target.value)} inputMode="decimal" className={field} />
        </label>
        <label className="block">
          {s.wage}
          <input value={salario} onChange={(e) => setSalario(e.target.value)} inputMode="decimal" className={field} />
        </label>
      </div>
      {!r ? (
        <p role="status" className="mt-4 text-oxblood">{s.invalid}</p>
      ) : (
        <div role="status" className="mt-5">
          <p className={rotulo}>{s.bar}</p>
          <div className="mt-2 flex h-10 w-full border-2 border-ink font-mono text-xs" aria-hidden>
            <span className="flex items-center justify-center bg-ink text-parchment" style={{ width: `${(lerNumero(necessario) / lerNumero(jornada)) * 100}%` }}>{numero(lang, lerNumero(necessario))} h</span>
            <span className="flex items-center justify-center bg-oxblood text-parchment" style={{ width: `${(r.excedente / lerNumero(jornada)) * 100}%` }}>{numero(lang, r.excedente)} h</span>
          </div>
          <p className="mt-1 flex justify-between text-xs">
            <span>{s.neededShort}</span>
            <span>{s.surplusHours}</span>
          </p>
          <dl className="mt-4 space-y-1">
            {[
              [s.perHour, `${dinheiro(lerNumero(salario))} ÷ ${numero(lang, lerNumero(necessario))} h = ${dinheiro(r.valorPorHora)}`],
              [s.newValue, `${dinheiro(r.valorPorHora)} × ${numero(lang, lerNumero(jornada))} h = ${dinheiro(r.valorNovo)}`],
              [s.surplus, `${dinheiro(r.valorNovo)} − ${dinheiro(lerNumero(salario))} = ${dinheiro(r.maisValia)}`],
              [s.rate, `${dinheiro(r.maisValia)} ÷ ${dinheiro(lerNumero(salario))} = ${numero(lang, r.taxa * 100, 1)}%`],
            ].map(([nome, conta]) => (
              <div key={nome} className="border-b border-rule py-1.5">
                <dt className="font-semibold">{nome}</dt>
                <dd className="font-mono">{conta}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="mt-5">{s.explain}</p>
      <p className="mt-2 text-ink-soft">{s.assume}</p>
      <p className="mt-3 text-xs text-ink-soft">
        {s.source}{" "}
        <a href="https://www.marxists.org/portugues/marx/1867/capital/livro1/cap07/cap01.htm" target="_blank" rel="noopener noreferrer" className="underline">marxists.org</a>
      </p>
    </div>
  );
}

// ───────────── Ateliê de HTML ─────────────

/**
 * HTML, CSS e JavaScript com o resultado ao lado. O resultado roda num iframe com sandbox e sem "allow-same-origin":
 * é uma origem à parte, que não lê os cookies, o armazenamento nem a página do site. Só "allow-scripts" é liberado.
 */
export function AtelieHtml({ s }: { s: T["html"] }) {
  const exemplo = { html: s.sampleHtml, css: "body { font-family: sans-serif; background: #f4ecd8; color: #1f1a14; padding: 1rem; }\nh1 { color: #c21f16; }\nbutton { padding: .5rem 1rem; }", js: `document.querySelector("button").addEventListener("click", () => {\n  document.querySelector("p").textContent = ${JSON.stringify(s.sampleClicked)};\n});` };
  const [codigo, setCodigo] = useState(exemplo);
  const [aba, setAba] = useState<"html" | "css" | "js">("html");
  const [auto, setAuto] = useState(true);
  const [documento, setDocumento] = useState("");
  const montar = () =>
    setDocumento(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${codigo.css}</style></head><body>${codigo.html}<script>${codigo.js.replace(/<\/script/gi, "<\\/script")}</script></body></html>`);
  useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(montar, 500);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, auto]);
  return (
    <div className="mt-8 font-sans text-sm">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div role="tablist" className="flex gap-5 border-b border-rule">
            {(["html", "css", "js"] as const).map((id) => (
              <button key={id} type="button" role="tab" aria-selected={aba === id} className={tab(aba === id)} onClick={() => setAba(id)}>
                {id === "js" ? "JavaScript" : id.toUpperCase()}
              </button>
            ))}
          </div>
          <textarea
            value={codigo[aba]}
            onChange={(e) => setCodigo({ ...codigo, [aba]: e.target.value })}
            spellCheck={false}
            aria-label={aba}
            rows={16}
            className="mt-2 w-full border-2 border-ink bg-parchment-deep p-3 font-mono text-sm"
          />
          <p className="mt-2 flex flex-wrap items-center gap-4">
            <button type="button" className={button} onClick={montar}>{s.run}</button>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              {s.auto}
            </label>
            <button type="button" className="cursor-pointer underline hover:text-oxblood" onClick={() => setCodigo(exemplo)}>{s.reset}</button>
          </p>
        </div>
        <div>
          <p className={rotulo}>{s.preview}</p>
          <iframe title={s.preview} sandbox="allow-scripts" srcDoc={documento} className="mt-2 h-96 w-full border-2 border-ink bg-white" />
        </div>
      </div>
      <p className="mt-3 text-ink-soft">{s.sandbox}</p>
    </div>
  );
}

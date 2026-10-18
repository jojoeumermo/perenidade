// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState, useRef } from "react";
import { fill } from "@/i18n/config";
import type { Dict } from "@/i18n/types";
import { calculate } from "@/lib/expressao";
import { explain } from "@/lib/steps";
import elements from "@/lib/elementos.json";

type Tools = Dict["tools"];
type Element = (typeof elements)[number];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2 font-mono";
const button = "cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood";
const number = (lang: string, value: number, digits = 2) =>
  new Intl.NumberFormat(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

// ───────────── Tabela periódica ─────────────

/** Linha e coluna de cada elemento na tabela de 18 colunas, a partir do número atômico. */
function place(n: number): [row: number, column: number] {
  if (n === 1) return [1, 1];
  if (n === 2) return [1, 18];
  if (n <= 10) return [2, n <= 4 ? n - 2 : n + 8];
  if (n <= 18) return [3, n <= 12 ? n - 10 : n];
  if (n <= 36) return [4, n - 18];
  if (n <= 54) return [5, n - 36];
  if (n <= 56) return [6, n - 54];
  if (n <= 71) return [9, n - 54]; // lantanídeos, na faixa de baixo
  if (n <= 86) return [6, n - 68];
  if (n <= 88) return [7, n - 86];
  if (n <= 103) return [10, n - 86]; // actinídeos
  return [7, n - 100];
}

// Um matiz por família, sempre misturado ao tom do papel para valer nos temas claro e escuro.
const HUES: Record<string, string> = {
  "nao-metal": "#3f8f5f",
  "gas-nobre": "#7a5fb0",
  "metal-alcalino": "#c0504d",
  "alcalino-terroso": "#c98a2b",
  semimetal: "#4f8a8b",
  halogenio: "#2f7fb8",
  "outro-metal": "#7d8a99",
  "metal-de-transicao": "#b5a13a",
  lantanideo: "#b06a8f",
  actinideo: "#8f6a4a",
};
const tint = (group: string) => `color-mix(in srgb, ${HUES[group] ?? "#888"} 26%, var(--parchment))`;

export function PeriodicTable({ s, lang }: { s: Tools["table"]; lang: string }) {
  const [selected, setSelected] = useState<Element>(elements[0]);
  const detalhe = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const name = (element: Element) => (lang === "pt" ? element.pt : element.en);
  const groups = s.groups as Record<string, string>;
  const states = s.states as Record<string, string>;
  const wanted = query.trim().toLowerCase();
  const matches = (element: Element) =>
    !wanted || element.s.toLowerCase() === wanted || name(element).toLowerCase().includes(wanted) || String(element.n) === wanted;

  return (
    <div className="mt-8 font-sans text-sm">
      <label className="block max-w-sm">
        {s.search}
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} className={field} />
      </label>

      <div ref={detalhe} className="mt-5 scroll-mt-4 border border-rule bg-parchment-deep p-5" aria-live="polite">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-24 w-24 flex-col items-center justify-center border-2 border-ink" style={{ background: tint(selected.g) }}>
            <span className="font-mono text-xs">{selected.n}</span>
            <span className="font-serif text-4xl font-semibold leading-none">{selected.s}</span>
          </div>
          <div>
            <p className="font-serif text-3xl font-semibold">{name(selected)}</p>
            <p className="text-ink-soft">{groups[selected.g]}</p>
          </div>
        </div>
        <dl className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {[
            [s.number, String(selected.n)],
            [s.mass, `${selected.m} u`],
            [s.config, selected.c],
            [s.state, states[selected.e] ?? selected.e],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-rule py-1.5">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="text-right font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-5 overflow-x-auto pb-2">
        <div className="grid min-w-[760px] gap-0.5" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))" }}>
          {elements.map((element) => {
            const [row, column] = place(element.n);
            const on = matches(element);
            return (
              <button
                key={element.n}
                type="button"
                onClick={() => { setSelected(element); detalhe.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}
                aria-label={`${element.n} ${name(element)}`}
                aria-pressed={selected.n === element.n}
                className={`flex aspect-square cursor-pointer flex-col items-center justify-center border ${selected.n === element.n ? "border-2 border-ink" : "border-rule"} ${on ? "" : "opacity-25"}`}
                style={{ gridRow: row, gridColumn: column, background: tint(element.g) }}
              >
                <span className="font-mono text-[9px] leading-none">{element.n}</span>
                <span className="font-semibold leading-tight">{element.s}</span>
              </button>
            );
          })}
          {/* Faixa vazia que separa lantanídeos e actinídeos do corpo da tabela. */}
          <span aria-hidden style={{ gridRow: 8, gridColumn: 1 }} className="h-3" />
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {Object.keys(HUES).map((group) => (
          <li key={group} className="flex items-center gap-2">
            <span aria-hidden className="h-3.5 w-3.5 border border-rule" style={{ background: tint(group) }} />
            {groups[group]}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-ink-soft">{s.source}</p>
    </div>
  );
}

// ───────────── Calculadora ─────────────

// A conta é lida pelo analisador único do site (lib/expressao): nada do que se digita é executado como código.
const PAD = ["7", "8", "9", "÷", "(", "4", "5", "6", "×", ")", "1", "2", "3", "−", "^", "0", ",", "π", "+", "√(", "sin(", "cos(", "tan(", "log(", "ln(", "asin(", "acos(", "atan(", "!", "ans"];

export function Calculator({ s, lang }: { s: Tools["calc"]; lang: string }) {
  const [text, setText] = useState("");
  const [degrees, setDegrees] = useState(true);
  const [history, setHistory] = useState<[string, string][]>([]);
  const [invalid, setInvalid] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  // O último resultado (ans) e a memória (M+, M−, MR, MC), como nas calculadoras de mão.
  const [ans, setAns] = useState(0);
  const [memory, setMemory] = useState(0);
  const format = (value: number) => new Intl.NumberFormat(lang, { maximumSignificantDigits: 12, useGrouping: false }).format(Number(value.toPrecision(12)));

  function solve() {
    if (!text.trim()) return;
    try {
      const value = calculate(text.replace(/²/g, "^2").replace(/³/g, "^3"), { degrees, scope: { ans } });
      const result = format(value);
      setAns(value);
      setHistory((lines) => [[text, result] as [string, string], ...lines].slice(0, 12));
      setInvalid(false);
      setCopied(false);
      // As passagens usam menos casas para caber na linha; o resultado acima continua com a precisão toda.
      try {
        setSteps(explain(text, degrees, (value) => new Intl.NumberFormat(lang, { maximumSignificantDigits: 8, useGrouping: false }).format(Number(value.toPrecision(8)))));
      } catch {
        setSteps([]);
      }
    } catch {
      setInvalid(true);
      setSteps([]);
    }
  }

  async function copySteps() {
    try {
      await navigator.clipboard.writeText(["```conta", ...steps, "```"].join("\n"));
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-8 max-w-md font-sans text-sm">
      <label className="block">
        {s.expression}
        <input
          value={text}
          onChange={(e) => { setText(e.target.value); setInvalid(false); }}
          onKeyDown={(e) => e.key === "Enter" && solve()}
          placeholder={s.placeholder}
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={invalid}
          className={`${field} text-lg`}
        />
      </label>
      <p role="status" className="mt-2 min-h-8 text-right font-mono text-2xl">
        {invalid ? <span className="font-sans text-sm text-oxblood">{s.invalid}</span> : history[0]?.[0] === text ? `= ${history[0][1]}` : ""}
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {PAD.map((key) => {
          // O seno é "sen" em português e espanhol; a vírgula decimal vira ponto em inglês e chinês.
          const typed = key === "sin(" ? `${s.sin}(` : key === "asin(" ? `a${s.sin}(` : key === "," ? s.decimal : key;
          // As inversas aparecem como no caderno (sen⁻¹), mas entram no texto como asen( ), que o analisador entende.
          const label = key === "asin(" ? `${s.sin}⁻¹` : key === "acos(" ? "cos⁻¹" : key === "atan(" ? "tan⁻¹" : typed.replace("(", "");
          return (
            <button key={key} type="button" onClick={() => { setText((value) => value + typed); setInvalid(false); }} className="cursor-pointer border border-rule bg-parchment-deep py-2.5 font-mono hover:border-gold">
              {label}
            </button>
          );
        })}
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button type="button" onClick={() => { setText(""); setInvalid(false); }} className="cursor-pointer border-2 border-ink py-2.5 font-medium">{s.clear}</button>
        <button type="button" onClick={() => setText((value) => value.slice(0, -1))} aria-label={s.erase} className="cursor-pointer border-2 border-ink py-2.5 font-medium">⌫</button>
        <button type="button" onClick={solve} aria-label={s.result} className={`${button} px-0`}>=</button>
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1.5" role="group" aria-label={s.memory}>
        {(
          [
            ["MC", s.memoryClear, () => setMemory(0)],
            ["MR", s.memoryRecall, () => setText((value) => value + String(memory).replace(".", s.decimal))],
            ["M+", s.memoryAdd, () => setMemory((m) => m + ans)],
            ["M−", s.memorySubtract, () => setMemory((m) => m - ans)],
          ] as [string, string, () => void][]
        ).map(([key, label, action]) => (
          <button key={key} type="button" onClick={action} aria-label={label} title={label} className="cursor-pointer border border-rule py-2 font-mono hover:border-gold">
            {key}
          </button>
        ))}
      </div>
      {memory !== 0 && <p className="mt-1 text-right font-mono text-xs text-ink-soft">M = {format(memory)}</p>}
      <fieldset className="mt-4 flex gap-5">
        <legend className="sr-only">{s.angle}</legend>
        {[true, false].map((value) => (
          <label key={String(value)} className="flex cursor-pointer items-center gap-2">
            <input type="radio" name="angulo" checked={degrees === value} onChange={() => setDegrees(value)} />
            {value ? s.degrees : s.radians}
          </label>
        ))}
      </fieldset>
      {steps.length > 2 && history[0]?.[0] === text && (
        <section aria-labelledby="passos" className="mt-6">
          <p id="passos" className="font-mono text-xs uppercase tracking-widest text-gold">{s.steps}</p>
          <div className="conta !my-2 font-serif" role="math" aria-label={steps.join(" ")}>
            {steps.map((line, i) => (
              <div key={i} className={line.startsWith("=") ? "passo" : undefined}>
                {line}
              </div>
            ))}
          </div>
          <button type="button" onClick={copySteps} className="cursor-pointer underline hover:text-oxblood">
            {copied ? s.stepsCopied : s.stepsCopy}
          </button>
        </section>
      )}
      {history.length > 0 && (
        <>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-gold">{s.history}</p>
          <ul className="mt-2 divide-y divide-rule font-mono">
            {history.map(([expression, result], i) => (
              <li key={i} className="flex justify-between gap-4 py-1.5">
                <button type="button" onClick={() => setText(expression)} className="cursor-pointer truncate text-left hover:text-oxblood">{expression}</button>
                <span>{result}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-5 text-ink-soft">{s.help}</p>
    </div>
  );
}

// ───────────── Juros compostos ─────────────

export function CompoundInterest({ s, lang }: { s: Tools["interest"]; lang: string }) {
  const [initial, setInitial] = useState("1000");
  const [monthly, setMonthly] = useState("100");
  const [rate, setRate] = useState("1");
  const [yearly, setYearly] = useState(false);
  const [months, setMonths] = useState("24");

  const result = useMemo(() => {
    const read = (value: string) => Number(value.replace(",", "."));
    const [capital, deposit, percent, time] = [read(initial), read(monthly), read(rate), Math.floor(read(months))];
    if (![capital, deposit, percent, time].every(Number.isFinite) || capital < 0 || deposit < 0 || percent < 0 || percent > 1000 || time < 1 || time > 1200) return null;
    // Taxa ao ano vira a taxa mensal equivalente: (1 + a)^(1/12) − 1.
    const i = yearly ? (1 + percent / 100) ** (1 / 12) - 1 : percent / 100;
    const rows: [number, number, number][] = [];
    let total = capital;
    for (let month = 1; month <= time; month++) {
      total = total * (1 + i) + deposit;
      if (month % 12 === 0 || month === time) rows.push([month, capital + deposit * month, total]);
    }
    // Juros simples, para comparar: cada valor rende só sobre si mesmo, pelo tempo que ficou guardado.
    const simple = capital * (1 + i * time) + deposit * (time + (i * time * (time - 1)) / 2);
    return { total, invested: capital + deposit * time, simple, rows };
  }, [initial, monthly, rate, yearly, months]);

  const input = (label: string, value: string, set: (value: string) => void) => (
    <label className="block">
      {label}
      <input value={value} onChange={(e) => set(e.target.value)} inputMode="decimal" className={field} />
    </label>
  );

  return (
    <div className="mt-8 font-sans text-sm">
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
        {input(s.initial, initial, setInitial)}
        {input(s.monthly, monthly, setMonthly)}
        <div>
          {input(s.rate, rate, setRate)}
          <div className="mt-2 flex gap-5">
            {[false, true].map((value) => (
              <label key={String(value)} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="periodo" checked={yearly === value} onChange={() => setYearly(value)} />
                {value ? s.perYear : s.perMonth}
              </label>
            ))}
          </div>
        </div>
        {input(s.months, months, setMonths)}
      </div>

      <div role="status" className="mt-6">
        {!result ? (
          <p className="text-oxblood">{s.invalid}</p>
        ) : (
          <>
            <dl className="grid max-w-2xl gap-3 sm:grid-cols-3">
              {[
                [s.total, result.total],
                [s.invested, result.invested],
                [s.earned, result.total - result.invested],
              ].map(([label, value]) => (
                <div key={label as string} className="border border-rule bg-parchment-deep p-4">
                  <dt className="text-ink-soft">{label}</dt>
                  <dd className="mt-1 font-serif text-2xl font-semibold">{number(lang, value as number)}</dd>
                </div>
              ))}
            </dl>
            {result.total - result.simple >= 0.01 && (
              <p className="mt-4 max-w-2xl text-ink-soft">{fill(s.compare, { simple: number(lang, result.simple), diff: number(lang, result.total - result.simple) })}</p>
            )}
            <div className="mt-5 max-w-2xl overflow-x-auto">
              <table className="w-full text-right font-mono">
                <thead>
                  <tr className="border-b-2 border-ink text-xs uppercase tracking-widest">
                    <th scope="col" className="py-2 text-left font-medium">{s.month}</th>
                    <th scope="col" className="py-2 font-medium">{s.invested}</th>
                    <th scope="col" className="py-2 font-medium">{s.total}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map(([month, invested, total]) => (
                    <tr key={month} className="border-b border-rule">
                      <td className="py-1.5 text-left">{month}</td>
                      <td>{number(lang, invested)}</td>
                      <td>{number(lang, total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
      <p className="mt-5 max-w-2xl text-ink-soft">{s.note}</p>
    </div>
  );
}

// ───────────── Bases numéricas ─────────────

const BASES = [
  [2, /^[01]+$/],
  [8, /^[0-7]+$/],
  [10, /^\d+$/],
  [16, /^[0-9a-f]+$/i],
] as const;
const SUPER = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const superscript = (value: number) => [...String(value)].map((digit) => SUPER[Number(digit)]).join("");

export function NumberBases({ s }: { s: Tools["bases"] }) {
  const [text, setText] = useState("42");
  const [base, setBase] = useState<number>(10);
  const names: Record<number, string> = { 2: s.binary, 8: s.octal, 10: s.decimal, 16: s.hex };
  const clean = text.trim().replace(/\s+/g, "");
  const valid = clean.length > 0 && clean.length <= 64 && BASES.find(([value]) => value === base)![1].test(clean);

  // BigInt: o resultado continua exato mesmo com números enormes.
  const value = useMemo(() => {
    if (!valid) return null;
    let total = BigInt(0);
    for (const digit of clean.toLowerCase()) total = total * BigInt(base) + BigInt(parseInt(digit, 16));
    return total;
  }, [valid, clean, base]);

  const steps = useMemo(() => {
    if (value === null) return [];
    if (base !== 10) {
      // Cada algarismo vale ele mesmo vezes a base elevada à sua posição.
      const digits = [...clean.toLowerCase()];
      if (digits.length > 16) return [];
      return [`${digits.map((digit, i) => `${parseInt(digit, 16)}×${base}${superscript(digits.length - 1 - i)}`).join(" + ")} = ${value}`];
    }
    // Do decimal para o binário: divide por 2 e guarda os restos, lidos de baixo para cima.
    const lines: string[] = [];
    for (let rest = value; rest > BigInt(0) && lines.length < 24; rest /= BigInt(2)) lines.push(`${rest} ÷ 2 = ${rest / BigInt(2)}  ${s.remainder} ${rest % BigInt(2)}`);
    return value >> BigInt(24) > BigInt(0) ? [] : lines;
  }, [value, base, clean, s.remainder]);

  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          {s.number}
          <input value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={!valid} className={`${field} text-lg`} />
        </label>
        <label className="block">
          {s.base}
          <select value={base} onChange={(e) => setBase(Number(e.target.value))} className={field}>
            {BASES.map(([option]) => (
              <option key={option} value={option}>
                {names[option]} ({option})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div role="status" className="mt-6">
        {value === null ? (
          <p className="text-oxblood">{fill(s.invalid, { base: names[base] })}</p>
        ) : (
          <dl className="divide-y divide-rule border-y border-rule">
            {BASES.map(([option]) => (
              <div key={option} className="flex flex-wrap items-baseline justify-between gap-3 py-2.5">
                <dt className="text-ink-soft">
                  {names[option]} <span className="font-mono text-xs">({option})</span>
                </dt>
                <dd className="break-all text-right font-mono text-lg">{value.toString(option).toUpperCase()}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {steps.length > 0 && (
        <>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-gold">{base === 10 ? s.division : s.expansion}</p>
          <pre className="mt-2 overflow-x-auto border border-rule bg-parchment-deep p-4 font-mono text-sm leading-relaxed">{steps.join("\n")}</pre>
          {base === 10 && <p className="mt-2 text-ink-soft">{s.readUp}</p>}
        </>
      )}
      <p className="mt-5 text-ink-soft">{s.note}</p>
    </div>
  );
}

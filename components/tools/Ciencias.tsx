// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Dict } from "@/i18n/types";
import elementos from "@/lib/elementos.json";
import { corpos, pesoEm, tempoDaLuz } from "@/lib/ferramentas/diversas";
import { cruzar, ErroDeGenetica, proporcao, type Cruzamento } from "@/lib/ferramentas/genetica";
import { balancear, ErroDeQuimica, escreverEquacao, lerFormula, massaMolar, type Balanceamento, type MassaMolar } from "@/lib/ferramentas/quimica";
import { converter, grandezas } from "@/lib/ferramentas/unidades";

type T = Dict["tools"];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const button = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const rotulo = "font-mono text-xs uppercase tracking-widest text-gold";
const preencher = (modelo: string, valores: Record<string, string | number>) => modelo.replace(/\{(\w+)\}/g, (_, k: string) => String(valores[k] ?? ""));
const numero = (lang: string, v: number, casas = 6) => new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang, { maximumFractionDigits: casas }).format(v);
const lerNumero = (texto: string) => Number(texto.trim().replace(/\s/g, "").replace(",", "."));
const existe = (simbolo: string) => elementos.some((e) => e.s === simbolo);

// ───────────── Conversor de unidades ─────────────

export function Conversor({ s, lang }: { s: T["units"]; lang: string }) {
  const [grandeza, setGrandeza] = useState("comprimento");
  const g = grandezas.find((item) => item.id === grandeza)!;
  const [de, setDe] = useState(g.unidades[2].id);
  const [para, setPara] = useState(g.unidades[3].id);
  const [valor, setValor] = useState("1");
  const nomes = s.unitNames as Record<string, string>;
  const v = lerNumero(valor);
  let saida: { texto: string; detalhe: string } | { erro: string } = { erro: s.invalid };
  if (valor.trim() && Number.isFinite(v)) {
    try {
      const r = converter(grandeza, v, de, para);
      saida = {
        texto: `${numero(lang, v, 10)} ${nomes[de]} = ${numero(lang, r.resultado, 10)} ${nomes[para]}`,
        detalhe: r.fator !== null ? preencher(s.factor, { de: nomes[de], f: numero(lang, r.fator, 12), para: nomes[para] }) : `${s.formula}: ${(s.formulas as Record<string, string>)[r.formula ?? "igual"]}`,
      };
    } catch {
      saida = { erro: grandeza === "temperatura" ? s.below : s.invalid };
    }
  }
  const trocarGrandeza = (id: string) => {
    const nova = grandezas.find((item) => item.id === id)!;
    setGrandeza(id);
    setDe(nova.unidades[0].id);
    setPara(nova.unidades[Math.min(1, nova.unidades.length - 1)].id);
  };
  return (
    <div className="mt-8 max-w-xl font-sans text-sm">
      <label className="block">
        {s.quantity}
        <select value={grandeza} onChange={(e) => trocarGrandeza(e.target.value)} className={field}>
          {grandezas.map((item) => (
            <option key={item.id} value={item.id}>{(s.quantities as Record<string, string>)[item.id]}</option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto_1fr] sm:items-end">
        <label className="block">
          {s.value}
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" className={field} />
        </label>
        <label className="block">
          {s.from}
          <select value={de} onChange={(e) => setDe(e.target.value)} className={field}>
            {g.unidades.map((u) => (
              <option key={u.id} value={u.id}>{nomes[u.id]}</option>
            ))}
          </select>
        </label>
        <button type="button" onClick={() => { setDe(para); setPara(de); }} aria-label={s.swap} title={s.swap} className="cursor-pointer border-2 border-ink px-3 py-2">⇄</button>
        <label className="block">
          {s.to}
          <select value={para} onChange={(e) => setPara(e.target.value)} className={field}>
            {g.unidades.map((u) => (
              <option key={u.id} value={u.id}>{nomes[u.id]}</option>
            ))}
          </select>
        </label>
      </div>
      <div role="status" className="mt-5 border-2 border-ink bg-parchment-deep p-4">
        {"erro" in saida ? <p className="text-oxblood">{saida.erro}</p> : (
          <>
            <p className="font-mono text-xl">{saida.texto}</p>
            <p className="mt-1 text-ink-soft">{saida.detalhe}</p>
          </>
        )}
      </div>
      {grandeza === "area" && <p className="mt-3 text-ink-soft">{s.regional}</p>}
    </div>
  );
}

// ───────────── Massa molar ─────────────

const errosDeQuimica = (s: { errors: Record<string, string> }, falha: unknown) =>
  falha instanceof ErroDeQuimica ? preencher(s.errors[falha.codigo] ?? s.errors.simbolo, { x: falha.detalhe }) : s.errors.simbolo;

export function MassaMolarTool({ s, lang }: { s: T["molar"]; lang: string }) {
  const [formula, setFormula] = useState("H2SO4");
  const resultado = useMemo<MassaMolar | string>(() => {
    if (!formula.trim()) return "";
    try {
      return massaMolar(formula, elementos);
    } catch (falha) {
      return errosDeQuimica(s as unknown as { errors: Record<string, string> }, falha);
    }
  }, [formula, s]);
  return (
    <div className="mt-8 max-w-xl font-sans text-sm">
      <label className="block">
        {s.formula}
        <input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder={s.placeholder} spellCheck={false} autoComplete="off" className={`${field} font-mono text-lg`} />
      </label>
      <p className="mt-2 text-ink-soft">{s.help}</p>
      {typeof resultado === "string" ? resultado && <p role="status" className="mt-4 text-oxblood">{resultado}</p> : (
        <div role="status" className="mt-5">
          <p className="font-mono text-2xl">{s.result}: {numero(lang, resultado.total, 3)} g/mol</p>
          <table className="mt-3 w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-ink">
                <th className="py-1 pr-2">{s.element}</th>
                <th className="py-1 pr-2">{s.count}</th>
                <th className="py-1 pr-2">{s.mass}</th>
                <th className="py-1 pr-2">{s.subtotal}</th>
                <th className="py-1">{s.percent}</th>
              </tr>
            </thead>
            <tbody>
              {resultado.partes.map((p) => (
                <tr key={p.simbolo} className="border-b border-rule font-mono">
                  <td className="py-1 pr-2">{p.simbolo}</td>
                  <td className="py-1 pr-2">{p.quantidade}</td>
                  <td className="py-1 pr-2">{numero(lang, p.massa, 3)}</td>
                  <td className="py-1 pr-2">{numero(lang, p.quantidade)} × {numero(lang, p.massa, 3)} = {numero(lang, p.subtotal, 3)}</td>
                  <td className="py-1">{numero(lang, p.porcento, 2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-4 text-xs text-ink-soft">{s.source}</p>
    </div>
  );
}

// ───────────── Balanceamento ─────────────

function ResolverEquacao({ s }: { s: T["balance"] }) {
  const [texto, setTexto] = useState("CH4 + O2 -> CO2 + H2O");
  const [resultado, setResultado] = useState<Balanceamento | string | null>(null);
  const rodar = (valor = texto) => {
    try {
      setResultado(balancear(valor, existe));
    } catch (falha) {
      setResultado(errosDeQuimica(s as unknown as { errors: Record<string, string> }, falha));
    }
  };
  return (
    <div className="mt-6 max-w-xl font-sans text-sm">
      <label className="block">
        {s.equation}
        <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => e.key === "Enter" && rodar()} placeholder={s.placeholder} spellCheck={false} autoComplete="off" className={`${field} font-mono text-lg`} />
      </label>
      <p className="mt-2 flex flex-wrap gap-2">
        {["+", "->", "(", ")", "·"].map((tecla) => (
          <button key={tecla} type="button" onClick={() => setTexto((v) => `${v}${tecla === "+" || tecla === "->" ? ` ${tecla} ` : tecla}`)} className="min-w-9 cursor-pointer border border-rule bg-parchment-deep px-2 py-1.5 font-mono hover:border-gold">{tecla}</button>
        ))}
      </p>
      <button type="button" className={`mt-3 ${button}`} onClick={() => rodar()} disabled={!texto.trim()}>{s.balance}</button>
      <p className="mt-3 text-ink-soft">{s.help}</p>
      {typeof resultado === "string" && <p role="status" className="mt-4 text-oxblood">{resultado}</p>}
      {resultado && typeof resultado !== "string" && (
        <div role="status" className="mt-5">
          <p className={rotulo}>{s.balanced}</p>
          <p className="mt-1 font-mono text-2xl">{escreverEquacao(resultado)}</p>
          <p className={`mt-5 ${rotulo}`}>{s.check}</p>
          <table className="mt-2 w-full max-w-sm border-collapse text-left font-mono">
            <thead>
              <tr className="border-b-2 border-ink font-sans">
                <th className="py-1 pr-3">{s.element}</th>
                <th className="py-1 pr-3">{s.left}</th>
                <th className="py-1">{s.right}</th>
              </tr>
            </thead>
            <tbody>
              {resultado.conferencia.map((c) => (
                <tr key={c.simbolo} className="border-b border-rule">
                  <td className="py-1 pr-3">{c.simbolo}</td>
                  <td className="py-1 pr-3">{c.esquerda}</td>
                  <td className="py-1">{c.direita} ✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───────────── Quadro de Punnett ─────────────

export function Punnett({ s }: { s: T["punnett"] }) {
  const [mae, setMae] = useState("Aa");
  const [pai, setPai] = useState("Aa");
  const [resultado, setResultado] = useState<Cruzamento | string | null>(null);
  const erros = s.errors as Record<string, string>;
  const rodar = (m = mae, p = pai) => {
    try {
      setResultado(cruzar(m, p));
    } catch (falha) {
      setResultado(erros[falha instanceof ErroDeGenetica ? falha.codigo : "genotipo"]);
    }
  };
  const fenotipo = (texto: string) => {
    if (texto.includes(":")) {
      const [sexo, estado] = texto.split(":");
      return `${(s.sex as Record<string, string>)[sexo]}, ${(s.status as Record<string, string>)[estado]}`;
    }
    // "A_B_" → "com os dois traços dominantes"; cada gene em uma linha curta.
    return (texto.match(/../g) ?? []).map((par) => (par.endsWith("_") ? preencher(s.dominant, { g: par }) : preencher(s.recessive, { g: par }))).join(" · ");
  };
  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end">
        <label className="block">
          {s.mother}
          <input value={mae} onChange={(e) => setMae(e.target.value)} spellCheck={false} autoComplete="off" className={`${field} font-mono text-lg`} />
        </label>
        <span className="pb-2 text-center font-mono text-xl">×</span>
        <label className="block">
          {s.father}
          <input value={pai} onChange={(e) => setPai(e.target.value)} spellCheck={false} autoComplete="off" className={`${field} font-mono text-lg`} />
        </label>
      </div>
      <button type="button" className={`mt-3 ${button}`} onClick={() => rodar()}>{s.cross}</button>
      <p className="mt-3 text-ink-soft">{s.help}</p>
      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        <span className="text-ink-soft">{s.examples}:</span>
        {[["Aa", "Aa"], ["AaBb", "AaBb"], ["AaBb", "aabb"], ["XAXa", "XAY"]].map(([m, p]) => (
          <button key={m + p} type="button" className="cursor-pointer font-mono underline hover:text-oxblood" onClick={() => { setMae(m); setPai(p); rodar(m, p); }}>
            {m} × {p}
          </button>
        ))}
      </p>
      {typeof resultado === "string" && <p role="status" className="mt-4 text-oxblood">{resultado}</p>}
      {resultado && typeof resultado !== "string" && (
        <div role="status" className="mt-5">
          <div className="overflow-x-auto">
            <table className="border-collapse text-center font-mono">
              <caption className="sr-only">{s.title}</caption>
              <thead>
                <tr>
                  <th className="p-2" />
                  {resultado.gametasPai.map((g, i) => (
                    <th key={i} scope="col" className="border-2 border-ink bg-parchment-deep p-2">{g}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultado.quadro.map((linha, i) => (
                  <tr key={i}>
                    <th scope="row" className="border-2 border-ink bg-parchment-deep p-2">{resultado.gametasMae[i]}</th>
                    {linha.map((celula, j) => (
                      <td key={j} className="border border-rule p-2 text-base">{celula}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            <section>
              <p className={rotulo}>{s.genotypes}</p>
              <ul className="mt-2 space-y-1">
                {resultado.genotipos.map((g) => (
                  <li key={g.genotipo} className="font-mono">{g.genotipo}: {g.vezes}/{resultado.total} ({numero("pt", (g.vezes / resultado.total) * 100, 2)}%)</li>
                ))}
              </ul>
              <p className="mt-1 text-ink-soft">{s.ratio}: {proporcao(resultado.genotipos.map((g) => g.vezes)).join(" : ")}</p>
            </section>
            <section>
              <p className={rotulo}>{s.phenotypes}</p>
              <ul className="mt-2 space-y-1">
                {resultado.fenotipos.map((f) => (
                  <li key={f.fenotipo}>{fenotipo(f.fenotipo)}: {f.vezes}/{resultado.total}</li>
                ))}
              </ul>
              <p className="mt-1 text-ink-soft">{s.ratio}: {proporcao(resultado.fenotipos.map((f) => f.vezes)).join(" : ")}</p>
            </section>
          </div>
          <p className="mt-4 text-ink-soft">{resultado.tipo === "ligada_x" ? s.explainX : resultado.gametasMae[0].length > 1 ? s.explainDi : s.explainMono}</p>
        </div>
      )}
    </div>
  );
}

// ───────────── Sistema solar ─────────────

function TabelaSolar({ s, lang }: { s: T["solar"]; lang: string }) {
  const [peso, setPeso] = useState("60");
  const kg = lerNumero(peso);
  const nomes = s.names as Record<string, string>;
  const maior = Math.max(...corpos.map((c) => c.diametro));
  const tempo = (segundos: number) => {
    if (segundos < 60) return preencher(s.seconds, { s: numero(lang, segundos, 1) });
    if (segundos < 3600) return preencher(s.minutes, { m: Math.floor(segundos / 60), s: Math.round(segundos % 60) });
    return preencher(s.hours, { h: Math.floor(segundos / 3600), m: Math.round((segundos % 3600) / 60) });
  };
  return (
    <div className="mt-8 font-sans text-sm">
      <label className="block max-w-xs">
        {s.weight}
        <input value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="decimal" className={field} />
      </label>
      <p className={`mt-6 ${rotulo}`}>{s.scale}</p>
      <div className="mt-2 flex items-end gap-2 overflow-x-auto pb-2" aria-hidden>
        {corpos.map((c) => {
          const tamanho = Math.max(3, (c.diametro / maior) * 140);
          return (
            <div key={c.id} className="flex shrink-0 flex-col items-center gap-1">
              <span className="rounded-full bg-ink" style={{ width: tamanho, height: tamanho, background: c.id === "terra" ? "var(--oxblood)" : undefined }} />
              <span className="text-xs">{nomes[c.id]}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-ink">
              <th className="py-1 pr-2">{s.body}</th>
              <th className="py-1 pr-2">{s.diameter}</th>
              <th className="py-1 pr-2">{s.gravity}</th>
              <th className="py-1 pr-2">{s.distance}</th>
              <th className="py-1 pr-2">{s.light}</th>
              <th className="py-1">{s.yourWeight}</th>
            </tr>
          </thead>
          <tbody>
            {corpos.map((c) => (
              <tr key={c.id} className="border-b border-rule">
                <th scope="row" className="py-1.5 pr-2 font-semibold">{nomes[c.id]}</th>
                <td className="py-1.5 pr-2 font-mono">{numero(lang, c.diametro)} km</td>
                <td className="py-1.5 pr-2 font-mono">{numero(lang, c.gravidade, 1)} m/s²</td>
                <td className="py-1.5 pr-2 font-mono">{c.id === "lua" ? "—" : `${numero(lang, c.distancia, 1)} × 10⁶ km`}</td>
                <td className="py-1.5 pr-2 font-mono">{c.id === "lua" ? "—" : tempo(tempoDaLuz(c.distancia))}</td>
                <td className="py-1.5 font-mono">{Number.isFinite(kg) && kg > 0 ? `${numero(lang, pesoEm(kg, c.gravidade), 1)} kg` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-ink-soft">{s.notes}</p>
      <p className="mt-2 text-xs text-ink-soft">
        {s.source} <a href="https://nssdc.gsfc.nasa.gov/planetary/factsheet/" target="_blank" rel="noopener noreferrer" className="underline">nssdc.gsfc.nasa.gov/planetary/factsheet</a>
      </p>
    </div>
  );
}

// ───────────── Balanceamento: resolver ou treinar ─────────────

export function Balanceador({ s }: { s: T["balance"] }) {
  const [modo, setModo] = useState<"resolver" | "treinar">("resolver");
  return (
    <div>
      <div className="mt-8 flex flex-wrap gap-2 font-sans text-sm" role="group">
        {(["resolver", "treinar"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)} className={`cursor-pointer border-2 px-4 py-2 ${modo === m ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
            {m === "resolver" ? s.modeSolve : s.modePractice}
          </button>
        ))}
      </div>
      {modo === "resolver" ? <ResolverEquacao s={s} /> : <TreinoDeBalanceamento s={s} />}
    </div>
  );
}

const EXERCICIOS_DE_BALANCEAMENTO = [
  "H2 + O2 -> H2O",
  "N2 + H2 -> NH3",
  "Na + Cl2 -> NaCl",
  "CH4 + O2 -> CO2 + H2O",
  "Mg + HCl -> MgCl2 + H2",
  "Al + O2 -> Al2O3",
  "Fe + O2 -> Fe2O3",
  "KClO3 -> KCl + O2",
  "C3H8 + O2 -> CO2 + H2O",
  "Fe2O3 + CO -> Fe + CO2",
  "Ca(OH)2 + HCl -> CaCl2 + H2O",
  "C6H12O6 + O2 -> CO2 + H2O",
];
const mdcInteiro = (a: number, b: number): number => (b === 0 ? a : mdcInteiro(b, a % b));

/** O aluno escreve os coeficientes e a tabela mostra, átomo por átomo, o que já fecha. */
function TreinoDeBalanceamento({ s }: { s: T["balance"] }) {
  const [indice, setIndice] = useState(0);
  const equacao = EXERCICIOS_DE_BALANCEAMENTO[indice];
  const { esq, dir, formulas, contagens } = useMemo(() => {
    const [e, d] = equacao.split("->").map((lado) => lado.split("+").map((f) => f.trim()));
    const todas = [...e, ...d];
    return { esq: e, dir: d, formulas: todas, contagens: todas.map((f) => lerFormula(f, existe)) };
  }, [equacao]);
  const [coef, setCoef] = useState<string[]>(() => formulas.map(() => ""));
  const [conferido, setConferido] = useState(false);
  const [mostrar, setMostrar] = useState(false);
  const resposta = useMemo(() => balancear(equacao, existe), [equacao]);
  const numeros = coef.map((c) => Math.max(0, Math.floor(Number(c) || 0)));
  const elementos = [...new Set(contagens.flatMap((c) => [...c.keys()]))];
  const linhas = elementos.map((simbolo) => {
    const esquerda = esq.reduce((soma, _, j) => soma + numeros[j] * (contagens[j].get(simbolo) ?? 0), 0);
    const direita = dir.reduce((soma, _, k) => soma + numeros[esq.length + k] * (contagens[esq.length + k].get(simbolo) ?? 0), 0);
    return { simbolo, esquerda, direita, ok: esquerda === direita && esquerda > 0 };
  });
  const fecha = numeros.every((n) => n > 0) && linhas.every((l) => l.ok);
  const divisor = fecha ? numeros.reduce((a, b) => mdcInteiro(a, b)) : 1;
  const trocar = (proximo: number) => {
    const nova = EXERCICIOS_DE_BALANCEAMENTO[proximo];
    setIndice(proximo);
    setCoef(nova.split(/->|\+/).map(() => ""));
    setConferido(false);
    setMostrar(false);
  };
  return (
    <div className="mt-6 max-w-2xl font-sans text-sm">
      <p className="text-ink-soft">{s.practiceHint}</p>
      <p className="mt-2 font-mono text-xs text-ink-soft">{preencher(s.exerciseOf, { i: indice + 1, n: EXERCICIOS_DE_BALANCEAMENTO.length })}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 font-mono text-lg">
        {formulas.map((formula, j) => (
          <span key={`${formula}-${j}`} className="flex items-center gap-1">
            {j > 0 && <span className="px-1 text-ink-soft">{j === esq.length ? "→" : "+"}</span>}
            <input
              value={coef[j] ?? ""}
              onChange={(e) => {
                const valor = e.target.value.replace(/\D/g, "").slice(0, 2);
                setCoef((atual) => atual.map((c, i) => (i === j ? valor : c)));
                setConferido(false);
              }}
              inputMode="numeric"
              aria-label={preencher(s.coefficient, { f: formula })}
              placeholder="1"
              className="w-10 border-2 border-ink bg-parchment-deep px-1 py-1 text-center"
            />
            <span>{formula}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" className={button} onClick={() => { setCoef((atual) => atual.map((c) => c || "1")); setConferido(true); }}>{s.verify}</button>
        <button type="button" className="cursor-pointer border-2 border-ink px-4 py-2 hover:bg-ink hover:text-parchment" onClick={() => setMostrar(true)}>{s.showAnswer}</button>
        <button type="button" className="cursor-pointer border-2 border-rule px-4 py-2 hover:border-gold" onClick={() => trocar((indice + 1) % EXERCICIOS_DE_BALANCEAMENTO.length)}>{s.nextOne}</button>
      </div>
      {conferido && (
        <div role="status" className="mt-5">
          <p className={fecha && divisor === 1 ? "font-semibold text-ok" : "font-semibold text-oxblood"}>{fecha ? (divisor === 1 ? s.allGood : preencher(s.notMinimal, { n: divisor })) : s.fix}</p>
          <table className="mt-3 w-full max-w-sm border-collapse text-left font-mono">
            <thead>
              <tr className="border-b-2 border-ink font-sans">
                <th className="py-1 pr-3">{s.element}</th>
                <th className="py-1 pr-3">{s.left}</th>
                <th className="py-1 pr-3">{s.right}</th>
                <th className="py-1" />
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.simbolo} className="border-b border-rule">
                  <td className="py-1 pr-3">{l.simbolo}</td>
                  <td className="py-1 pr-3">{l.esquerda}</td>
                  <td className="py-1 pr-3">{l.direita}</td>
                  <td className={`py-1 ${l.ok ? "text-ok" : "text-oxblood"}`}>{l.ok ? "✓" : "✗"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {mostrar && <p className="mt-4 font-mono text-lg">{escreverEquacao(resposta)}</p>}
    </div>
  );
}

// ───────────── Sistema solar: órbitas, queda e tabela ─────────────

/** Período orbital de cada planeta, em dias terrestres (NASA, Planetary Fact Sheet). */
const PERIODOS: Record<string, number> = { mercurio: 88.0, venus: 224.7, terra: 365.2, marte: 687.0, jupiter: 4331, saturno: 10747, urano: 30589, netuno: 59800, plutao: 90560 };
const VELOCIDADES = [1, 10, 30, 100, 365, 3650];

export function SistemaSolar({ s, lang }: { s: T["solar"]; lang: string }) {
  return (
    <div>
      <Orbitas s={s} lang={lang} />
      <QuedaPorPlaneta s={s} lang={lang} />
      <TabelaSolar s={s} lang={lang} />
    </div>
  );
}

function Orbitas({ s, lang }: { s: T["solar"]; lang: string }) {
  const tela = useRef<HTMLCanvasElement>(null);
  const [alcance, setAlcance] = useState(260); // milhões de km mostrados do Sol até a borda
  const [velocidade, setVelocidade] = useState(2); // índice em VELOCIDADES
  const [rodando, setRodando] = useState(true);
  const estado = useRef({ dia: 0, alcance, diasPorSegundo: VELOCIDADES[velocidade], rodando });
  useEffect(() => {
    estado.current.alcance = alcance;
    estado.current.diasPorSegundo = VELOCIDADES[velocidade];
    estado.current.rodando = rodando;
  }, [alcance, velocidade, rodando]);
  const nomes = s.names as Record<string, string>;
  useEffect(() => {
    const canvas = tela.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let quadro = 0;
    let antes = performance.now();
    const cor = (nome: string) => getComputedStyle(canvas).getPropertyValue(nome).trim() || "#000";
    const desenhar = (agora: number) => {
      const passo = Math.min(0.1, (agora - antes) / 1000);
      antes = agora;
      const e = estado.current;
      if (e.rodando) e.dia += passo * e.diasPorSegundo;
      const lado = canvas.clientWidth;
      if (canvas.width !== lado * devicePixelRatio) {
        canvas.width = lado * devicePixelRatio;
        canvas.height = lado * devicePixelRatio;
      }
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      ctx.clearRect(0, 0, lado, lado);
      const centro = lado / 2;
      const escala = (centro - 16) / e.alcance;
      const tinta = cor("--ink");
      ctx.fillStyle = cor("--gold");
      ctx.beginPath();
      ctx.arc(centro, centro, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = "11px system-ui, sans-serif";
      for (const corpo of corpos) {
        if (corpo.id === "lua") continue;
        const raio = corpo.distancia * escala;
        if (raio > centro * 1.5) continue;
        ctx.strokeStyle = cor("--rule");
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(centro, centro, raio, 0, Math.PI * 2);
        ctx.stroke();
        const angulo = (e.dia / PERIODOS[corpo.id]) * Math.PI * 2;
        const x = centro + raio * Math.cos(angulo);
        const y = centro - raio * Math.sin(angulo);
        ctx.fillStyle = corpo.id === "terra" ? cor("--oxblood") : tinta;
        ctx.beginPath();
        ctx.arc(x, y, corpo.id === "jupiter" || corpo.id === "saturno" ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (raio < centro - 4) {
          ctx.fillStyle = tinta;
          ctx.fillText(nomes[corpo.id], x + 6, y - 4);
        }
      }
      ctx.fillStyle = tinta;
      ctx.fillText(preencher(s.dayCount, { d: Math.floor(e.dia).toLocaleString(lang === "pt" ? "pt-BR" : lang) }), 8, lado - 10);
      quadro = requestAnimationFrame(desenhar);
    };
    quadro = requestAnimationFrame(desenhar);
    return () => cancelAnimationFrame(quadro);
  }, [nomes, s.dayCount, lang]);
  return (
    <section className="mt-8 font-sans text-sm">
      <h3 className="font-serif text-xl">{s.orbitsTitle}</h3>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,26rem)_1fr]">
        <canvas ref={tela} role="img" aria-label={s.orbitsTitle} className="aspect-square w-full border-2 border-ink bg-parchment-deep" />
        <div className="space-y-4">
          <label className="block">
            {s.zoom}
            <input type="range" min={80} max={6200} step={20} value={alcance} onChange={(e) => setAlcance(Number(e.target.value))} className="mt-1 block w-full accent-[var(--oxblood)]" />
            <span className="font-mono text-xs text-ink-soft">{preencher(s.zoomValue, { d: numero(lang, alcance, 0) })}</span>
          </label>
          <label className="block">
            {s.speed}
            <input type="range" min={0} max={VELOCIDADES.length - 1} value={velocidade} onChange={(e) => setVelocidade(Number(e.target.value))} className="mt-1 block w-full accent-[var(--oxblood)]" />
            <span className="font-mono text-xs text-ink-soft">{preencher(s.speedValue, { d: numero(lang, VELOCIDADES[velocidade], 0) })}</span>
          </label>
          <button type="button" className={button} onClick={() => setRodando((r) => !r)}>{rodando ? s.pause : s.resume}</button>
          <p className="text-ink-soft">{s.orbitNote}</p>
        </div>
      </div>
    </section>
  );
}

function QuedaPorPlaneta({ s, lang }: { s: T["solar"]; lang: string }) {
  const altura = 10;
  const [corpo, setCorpo] = useState("terra");
  const [caindo, setCaindo] = useState<{ id: string; inicio: number } | null>(null);
  const [agora, setAgora] = useState(0);
  const nomes = s.names as Record<string, string>;
  const g = corpos.find((c) => c.id === corpo)?.gravidade ?? 9.8;
  const tempoDe = (gravidade: number) => Math.sqrt((2 * altura) / gravidade);
  useEffect(() => {
    if (!caindo) return;
    let quadro = 0;
    const passo = (instante: number) => {
      setAgora(instante);
      if ((instante - caindo.inicio) / 1000 < tempoDe(g)) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [caindo, g]);
  const decorrido = caindo ? Math.max(0, (agora - caindo.inicio) / 1000) : 0;
  const caiu = Math.min(altura, 0.5 * g * decorrido * decorrido);
  return (
    <section className="mt-10 font-sans text-sm">
      <h3 className="font-serif text-xl">{s.dropTitle}</h3>
      <p className="mt-1 text-ink-soft">{preencher(s.dropHint, { h: altura })}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {corpos.map((c) => (
          <button key={c.id} type="button" aria-pressed={corpo === c.id} onClick={() => { setCorpo(c.id); setCaindo(null); }} className={`cursor-pointer border-2 px-3 py-1.5 ${corpo === c.id ? "border-ink bg-ink text-parchment" : "border-rule hover:border-gold"}`}>
            {nomes[c.id]}
          </button>
        ))}
      </div>
      <div className="mt-4 flex items-end gap-6">
        <div className="relative h-48 w-16 border-b-4 border-ink bg-parchment-deep" aria-hidden>
          <span className="absolute left-1/2 h-6 w-6 -translate-x-1/2 rounded-full bg-oxblood" style={{ top: `calc(${(caiu / altura) * 100}% - ${(caiu / altura) * 24}px)` }} />
        </div>
        <div>
          <p className="font-mono text-lg">{preencher(s.fallTime, { t: numero(lang, tempoDe(g), 2) })}</p>
          <p className="font-mono text-xs text-ink-soft">g = {numero(lang, g, 1)} m/s² · t = √(2h/g)</p>
          <button type="button" className={`mt-3 ${button}`} onClick={() => setCaindo({ id: corpo, inicio: performance.now() })}>{s.drop}</button>
        </div>
      </div>
    </section>
  );
}

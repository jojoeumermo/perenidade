// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import type { Dict } from "@/i18n/types";
import elementos from "@/lib/elementos.json";
import { corpos, pesoEm, tempoDaLuz } from "@/lib/ferramentas/diversas";
import { cruzar, ErroDeGenetica, proporcao, type Cruzamento } from "@/lib/ferramentas/genetica";
import { balancear, ErroDeQuimica, escreverEquacao, massaMolar, type Balanceamento, type MassaMolar } from "@/lib/ferramentas/quimica";
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

export function Balanceador({ s }: { s: T["balance"] }) {
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
    <div className="mt-8 max-w-xl font-sans text-sm">
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

export function SistemaSolar({ s, lang }: { s: T["solar"]; lang: string }) {
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

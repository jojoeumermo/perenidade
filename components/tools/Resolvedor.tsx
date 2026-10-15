// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/types";
import { porcentagemDe, quantoPorcento, regraDeTres, resolver, ResolverError, variacao, type Passo, type Resolucao } from "@/lib/ferramentas/resolvedor";

type S = Dict["tools"]["solver"];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const button = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const tab = (on: boolean) => `cursor-pointer border-b-2 pb-1.5 ${on ? "border-ink font-semibold" : "border-transparent text-ink-soft hover:text-ink"}`;

/** Teclas da conta que o teclado do celular esconde. */
const TECLAS = ["x", "y", "=", "/", "÷", "×", "^", "²", "(", ")", "−", "+", ";", "%", ","];
const EXEMPLOS = ["1/2 + 3/4", "2/3 ÷ 4/9", "2x + 3 = 11", "x/2 + x/3 = 5", "x² − 5x + 6 = 0", "x + y = 10; x − y = 2"];

const preencher = (modelo: string, valores: Record<string, string> = {}) => modelo.replace(/\{(\w+)\}/g, (_, chave: string) => valores[chave] ?? "");

function Passos({ resolucao, s, decimal }: { resolucao: Resolucao; s: S; decimal: string }) {
  const [copiado, setCopiado] = useState(false);
  const textos = s.stepTexts as Record<string, string>;
  // As contas saem com vírgula decimal; em inglês e chinês, a casa decimal é o ponto.
  const conta = (texto?: string) => (texto && decimal === "." ? texto.replace(/(\d),(\d)/g, "$1.$2") : texto);
  const linhas = (p: Passo) => [preencher(textos[p.chave] ?? p.chave, p.valores), conta(p.conta)].filter(Boolean).join("\n");
  async function copiar() {
    try {
      await navigator.clipboard.writeText(resolucao.passos.map(linhas).join("\n\n"));
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }
  return (
    <div className="mt-6">
      {resolucao.respostas.length > 0 && (
        <div role="status" className="border-2 border-ink bg-parchment-deep p-4">
          <p className="font-mono text-xs uppercase tracking-widest text-gold">{s.answer}</p>
          {resolucao.respostas.map((r) => (
            <p key={r} className="mt-1 font-mono text-2xl">{conta(r)}</p>
          ))}
          {resolucao.aproximadas.length > 0 && resolucao.respostas.some((r) => /[/√]/.test(r)) && (
            <p className="mt-1 text-ink-soft">
              {s.approx}: {resolucao.aproximadas.map((v) => new Intl.NumberFormat(decimal === "," ? "pt-BR" : "en", { maximumFractionDigits: 6 }).format(v)).join("  ·  ")}
            </p>
          )}
        </div>
      )}
      <p className="mt-6 font-mono text-xs uppercase tracking-widest text-gold">{s.steps}</p>
      <ol className="mt-2 space-y-3">
        {resolucao.passos.map((p, i) => (
          <li key={i} className="border-l-2 border-rule pl-3">
            <p>{preencher(textos[p.chave] ?? p.chave, p.valores)}</p>
            {p.conta && <p className="mt-1 overflow-x-auto whitespace-nowrap font-mono text-base">{conta(p.conta)}</p>}
          </li>
        ))}
      </ol>
      <button type="button" onClick={() => void copiar()} className="mt-4 cursor-pointer underline hover:text-oxblood">
        {copiado ? s.copied : s.copy}
      </button>
    </div>
  );
}

/**
 * O resolvedor passo a passo: a alternativa livre aos aplicativos fechados. A conta é lida e resolvida aqui mesmo, no
 * navegador, sem mandar nada para fora. `foto` liga o botão "Foto do exercício" (quando o assistente estiver ligado).
 */
export function Resolvedor({ s, lang, foto }: { s: S; lang: string; foto?: React.ReactNode }) {
  const decimal = lang === "en" || lang === "zh" ? "." : ",";
  const [modo, setModo] = useState<"conta" | "porcentagem" | "regra">("conta");
  const [texto, setTexto] = useState("");
  const [complexas, setComplexas] = useState(false);
  const [metodo, setMetodo] = useState<"adicao" | "substituicao">("adicao");
  const [resolucao, setResolucao] = useState<Resolucao | null>(null);
  const [erro, setErro] = useState("");
  const [pct, setPct] = useState({ tipo: "de" as "de" | "quanto" | "variacao", a: "", b: "", aumento: true });
  const [regra, setRegra] = useState({ a: "", b: "", c: "", inversa: false });
  const erros = s.errors as Record<string, string>;

  function rodar(fazer: () => Resolucao) {
    try {
      setResolucao(fazer());
      setErro("");
    } catch (falha) {
      setResolucao(null);
      setErro(erros[falha instanceof ResolverError ? falha.codigo : "leitura"] ?? erros.leitura);
    }
  }

  const resolverConta = (valor = texto) => rodar(() => resolver(valor.replace(/²/g, "^2"), { complexas, metodo }));

  return (
    <div className="mt-8 max-w-2xl font-sans text-sm">
      <div role="tablist" className="flex flex-wrap gap-x-6 gap-y-1 border-b border-rule">
        {(["conta", "porcentagem", "regra"] as const).map((id) => (
          <button key={id} type="button" role="tab" aria-selected={modo === id} className={tab(modo === id)} onClick={() => { setModo(id); setResolucao(null); setErro(""); }}>
            {(s.modes as Record<string, string>)[id]}
          </button>
        ))}
      </div>

      {modo === "conta" && (
        <div className="mt-5">
          <label className="block">
            {s.input}
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  resolverConta();
                }
              }}
              rows={2}
              placeholder={s.placeholder}
              spellCheck={false}
              autoComplete="off"
              className={`${field} font-mono text-lg`}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label={s.keys}>
            {TECLAS.map((tecla) => (
              <button key={tecla} type="button" onClick={() => setTexto((v) => v + (tecla === "," ? decimal : tecla === ";" ? "; " : tecla))} className="min-w-9 cursor-pointer border border-rule bg-parchment-deep px-2 py-1.5 font-mono hover:border-gold">
                {tecla === "," ? decimal : tecla}
              </button>
            ))}
            <button type="button" onClick={() => setTexto((v) => v.slice(0, -1))} aria-label={s.erase} className="cursor-pointer border border-rule bg-parchment-deep px-3 py-1.5 hover:border-gold">⌫</button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
            <button type="button" className={button} onClick={() => resolverConta()} disabled={!texto.trim()}>{s.solve}</button>
            {foto}
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={complexas} onChange={(e) => setComplexas(e.target.checked)} />
              {s.complex}
            </label>
            <label className="flex items-center gap-2">
              {s.method}
              <select value={metodo} onChange={(e) => setMetodo(e.target.value as "adicao" | "substituicao")} className="border border-rule bg-parchment-deep px-2 py-1">
                <option value="adicao">{s.addition}</option>
                <option value="substituicao">{s.substitution}</option>
              </select>
            </label>
          </div>
          <p className="mt-3 text-ink-soft">{s.help}</p>
          <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            <span className="text-ink-soft">{s.examples}:</span>
            {EXEMPLOS.map((exemplo) => (
              <button key={exemplo} type="button" className="cursor-pointer font-mono underline hover:text-oxblood" onClick={() => { setTexto(exemplo); resolverConta(exemplo); }}>
                {exemplo}
              </button>
            ))}
          </p>
        </div>
      )}

      {modo === "porcentagem" && (
        <div className="mt-5 space-y-4">
          <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
            <legend className="sr-only">{s.modes.porcentagem}</legend>
            {(["de", "quanto", "variacao"] as const).map((tipo) => (
              <label key={tipo} className="flex items-center gap-2">
                <input type="radio" name="pct" checked={pct.tipo === tipo} onChange={() => setPct({ ...pct, tipo })} />
                {(s.pct as Record<string, string>)[tipo]}
              </label>
            ))}
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              {pct.tipo === "de" ? s.pct.percent : pct.tipo === "quanto" ? s.pct.part : s.pct.value}
              <input value={pct.a} onChange={(e) => setPct({ ...pct, a: e.target.value })} inputMode="decimal" className={field} />
            </label>
            <label className="block">
              {pct.tipo === "de" ? s.pct.value : pct.tipo === "quanto" ? s.pct.whole : s.pct.percent}
              <input value={pct.b} onChange={(e) => setPct({ ...pct, b: e.target.value })} inputMode="decimal" className={field} />
            </label>
          </div>
          {pct.tipo === "variacao" && (
            <div className="flex gap-5">
              {[true, false].map((aumento) => (
                <label key={String(aumento)} className="flex items-center gap-2">
                  <input type="radio" name="variacao" checked={pct.aumento === aumento} onChange={() => setPct({ ...pct, aumento })} />
                  {aumento ? s.pct.increase : s.pct.discount}
                </label>
              ))}
            </div>
          )}
          <button type="button" className={button} disabled={!pct.a.trim() || !pct.b.trim()} onClick={() => rodar(() => (pct.tipo === "de" ? porcentagemDe(pct.a, pct.b) : pct.tipo === "quanto" ? quantoPorcento(pct.a, pct.b) : variacao(pct.a, pct.b, pct.aumento)))}>
            {s.solve}
          </button>
        </div>
      )}

      {modo === "regra" && (
        <div className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(["a", "b", "c"] as const).map((campo) => (
              <label key={campo} className="block">
                {(s.rule as Record<string, string>)[campo]}
                <input value={regra[campo]} onChange={(e) => setRegra({ ...regra, [campo]: e.target.value })} inputMode="decimal" className={field} />
              </label>
            ))}
            <p className="self-end pb-2 font-mono text-lg">x = ?</p>
          </div>
          <fieldset className="space-y-1">
            {[false, true].map((inversa) => (
              <label key={String(inversa)} className="flex items-start gap-2">
                <input type="radio" name="regra" checked={regra.inversa === inversa} onChange={() => setRegra({ ...regra, inversa })} className="mt-1" />
                {inversa ? s.rule.inverse : s.rule.direct}
              </label>
            ))}
          </fieldset>
          <p className="text-ink-soft">{s.rule.help}</p>
          <button type="button" className={button} disabled={!regra.a.trim() || !regra.b.trim() || !regra.c.trim()} onClick={() => rodar(() => regraDeTres(regra.a, regra.b, regra.c, regra.inversa))}>
            {s.solve}
          </button>
        </div>
      )}

      {erro && <p role="status" className="mt-4 text-oxblood">{erro}</p>}
      {resolucao && <Passos resolucao={resolucao} s={s} decimal={decimal} />}
    </div>
  );
}

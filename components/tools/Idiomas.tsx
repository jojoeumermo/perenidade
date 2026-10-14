// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import type { Dict } from "@/i18n/types";

type Tools = Dict["tools"];
const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const button = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";

interface Sentido {
  classe: string;
  definicoes: { texto: string; exemplo?: string }[];
}

/** Dicionário de português (Dicionário Aberto) e de inglês (Free Dictionary), consultados pelo nosso servidor. */
export function Dictionary({ s, initial }: { s: Tools["dictionary"]; initial: "pt" | "en" }) {
  const [lingua, setLingua] = useState<"pt" | "en">(initial);
  const [palavra, setPalavra] = useState("");
  const [estado, setEstado] = useState<"idle" | "busy" | "none" | "fail">("idle");
  const [resultado, setResultado] = useState<{ palavra: string; fonetica?: string; sentidos: Sentido[]; fonte: string; link: string; licenca: string } | null>(null);

  async function buscar() {
    const termo = palavra.trim();
    if (!termo) return;
    setEstado("busy");
    setResultado(null);
    try {
      const resposta = await fetch(`/api/dicionario?lingua=${lingua}&palavra=${encodeURIComponent(termo)}`);
      const dados = await resposta.json();
      if (dados.erro) return setEstado("fail");
      if (!dados.sentidos?.length) return setEstado("none");
      setResultado(dados);
      setEstado("idle");
    } catch {
      setEstado("fail");
    }
  }

  return (
    <div className="font-sans">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void buscar(); }}>
        <label className="block min-w-48 flex-1">
          {s.word}
          <input value={palavra} onChange={(e) => setPalavra(e.target.value)} maxLength={40} lang={lingua} className={field} />
        </label>
        <label className="block">
          {s.language}
          <select value={lingua} onChange={(e) => setLingua(e.target.value as "pt" | "en")} className={field}>
            <option value="pt">Português</option>
            <option value="en">English</option>
          </select>
        </label>
        <button type="submit" disabled={estado === "busy" || !palavra.trim()} className={button}>{s.search}</button>
      </form>
      <p role="status" className="mt-3 min-h-5 text-oxblood">{estado === "none" ? s.none : estado === "fail" ? s.fail : ""}</p>
      {resultado && (
        <article className="mt-2 border border-rule bg-parchment-deep p-5" lang={lingua}>
          <h2 className="font-serif text-3xl font-semibold">
            {resultado.palavra} {resultado.fonetica && <span className="font-sans text-lg font-normal text-ink-soft">{resultado.fonetica}</span>}
          </h2>
          {resultado.sentidos.map((sentido, i) => (
            <section key={i} className="mt-4">
              {sentido.classe && <p className="text-sm font-semibold uppercase tracking-[0.12em] text-ink-soft">{sentido.classe}</p>}
              <ol className="mt-1 list-decimal space-y-1 pl-6 font-serif text-lg">
                {sentido.definicoes.map((definicao, j) => (
                  <li key={j}>
                    {definicao.texto}
                    {definicao.exemplo && <span className="block text-base italic text-ink-soft">“{definicao.exemplo}”</span>}
                  </li>
                ))}
              </ol>
            </section>
          ))}
          <p className="mt-5 text-xs text-ink-soft" lang="pt-BR">
            {s.source}{" "}
            <a href={resultado.link} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-oxblood">{resultado.fonte}</a> · {resultado.licenca}
            {lingua === "pt" && ` · ${s.oldSpelling}`}
          </p>
        </article>
      )}
    </div>
  );
}

interface Frase {
  id: number;
  texto: string;
  traducao: string;
  autores: string[];
  link: string;
}

const linguas: [string, string][] = [["eng", "English"], ["fra", "Français"], ["spa", "Español"], ["por", "Português"]];

/** Frases de verdade, escritas e traduzidas por gente, do Tatoeba: boas para quem está aprendendo outra língua. */
export function Sentences({ s, initial }: { s: Tools["sentences"]; initial: string }) {
  const [de, setDe] = useState(initial);
  const [para, setPara] = useState("por");
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<"idle" | "busy" | "none" | "fail">("idle");
  const [frases, setFrases] = useState<Frase[]>([]);

  async function buscar() {
    const termo = busca.trim();
    if (!termo || de === para) return;
    setEstado("busy");
    setFrases([]);
    try {
      const resposta = await fetch(`/api/frases?de=${de}&para=${para}&q=${encodeURIComponent(termo)}`);
      const dados = await resposta.json();
      if (dados.erro) return setEstado("fail");
      setFrases(dados.frases ?? []);
      setEstado(dados.frases?.length ? "idle" : "none");
    } catch {
      setEstado("fail");
    }
  }

  return (
    <div className="font-sans">
      <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); void buscar(); }}>
        <label className="block min-w-48 flex-1">
          {s.word}
          <input value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={60} className={field} />
        </label>
        <label className="block">
          {s.from}
          <select value={de} onChange={(e) => setDe(e.target.value)} className={field}>
            {linguas.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
        </label>
        <label className="block">
          {s.to}
          <select value={para} onChange={(e) => setPara(e.target.value)} className={field}>
            {linguas.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
        </label>
        <button type="submit" disabled={estado === "busy" || !busca.trim() || de === para} className={button}>{s.search}</button>
      </form>
      <p role="status" className="mt-3 min-h-5 text-oxblood">{de === para ? s.same : estado === "none" ? s.none : estado === "fail" ? s.fail : ""}</p>
      {frases.length > 0 && (
        <ul className="mt-2 divide-y divide-rule border-y border-rule">
          {frases.map((frase) => (
            <li key={frase.id} className="py-3">
              <p className="font-serif text-xl" lang={de.slice(0, 2)}>{frase.texto}</p>
              <p className="font-serif text-lg text-ink-soft" lang={para.slice(0, 2)}>{frase.traducao}</p>
              <p className="mt-1 text-xs text-ink-soft">
                <a href={frase.link} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-oxblood">Tatoeba #{frase.id}</a>
                {frase.autores.length > 0 && ` · ${frase.autores.join(", ")}`} · CC BY 2.0 FR
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import type { ItemDeRepertorio, Proposta } from "@/lib/enem";
import { lerEnem, mudarEnem, relogio } from "@/lib/enem-aparelho";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { normalize } from "@/lib/text";

type S = TextosDoEstudo["enem"]["oficina"];
const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const botao = "cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood";
const PASSOS = ["tema", "recorte", "tese", "argumento1", "argumento2", "intervencao"] as const;

/**
 * A oficina de redação do curso: escolher uma proposta (com os textos motivadores), planejar no roteiro (tema → recorte →
 * tese → dois argumentos com repertório → proposta de intervenção), escrever na folha de 30 linhas com o relógio da prova
 * e conferir pela revisão guiada da ferramenta de redação (passada como `folha`). O plano fica só no aparelho. Nenhuma
 * correção automática: para correção, a aula de reforço ou o educador da sala.
 */
export function OficinaDeRedacao({ propostas, repertorio, folha, eixos, s }: { propostas: Proposta[]; repertorio: ItemDeRepertorio[]; folha: React.ReactNode; eixos: Record<string, string>; s: S }) {
  const [id, setId] = useState(propostas[0]?.id ?? "");
  const [plano, setPlano] = useState<Record<string, string>>({});
  const [minutos, setMinutos] = useState(90);
  const [fim, setFim] = useState<number | null>(null);
  const [agora, setAgora] = useState(0);
  const [busca, setBusca] = useState("");
  const [eixo, setEixo] = useState("");
  const proposta = propostas.find((p) => p.id === id);

  useEffect(() => {
    const guardado = (lerEnem().oficina ?? {})[id];
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o planejamento guardado só existe no navegador
    setPlano(guardado ?? {});
  }, [id]);
  useEffect(() => {
    if (!fim) return;
    const t = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [fim]);

  const mudarPlano = (passo: string, valor: string) => {
    const novo = { ...plano, [passo]: valor };
    setPlano(novo);
    mudarEnem((e) => (e.oficina = { ...(e.oficina ?? {}), [id]: novo }));
  };
  const achados = useMemo(() => {
    const q = normalize(busca);
    return repertorio.filter((r) => (!eixo || r.eixos.includes(eixo)) && (!q || normalize(`${r.titulo} ${r.resumo} ${r.como_usar}`).includes(q)));
  }, [busca, eixo, repertorio]);
  const restante = fim ? (fim - agora) / 1000 : minutos * 60;

  return (
    <div className="mt-8 font-sans text-sm">
      <section className="border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">1. {s.proposta}</h2>
        <label className="mt-2 block">
          {s.escolha}
          <select value={id} onChange={(e) => setId(e.target.value)} className={campo}>
            {propostas.map((p) => <option key={p.id} value={p.id}>{p.tema}</option>)}
          </select>
        </label>
        {proposta && (
          <div className="mt-4">
            <p className="font-serif text-xl font-semibold">{proposta.tema}</p>
            <p className="mt-1 text-xs text-ink-soft">{s.emRevisao}</p>
            {proposta.textos.map((t) => (
              <figure key={t.titulo} className="mt-3 border border-rule bg-parchment p-3">
                <figcaption className="font-semibold">{t.titulo}</figcaption>
                <p className="mt-1 whitespace-pre-line font-serif text-base">{t.texto}</p>
                <p className="mt-1 text-xs text-ink-soft">{t.fonte}</p>
              </figure>
            ))}
            <details className="mt-3">
              <summary className="cursor-pointer font-semibold">{s.oQueOTemaPede}</summary>
              <p className="mt-1">{proposta.recorte}</p>
            </details>
          </div>
        )}
      </section>

      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">2. {s.planejar}</h2>
        <p className="mt-1 text-ink-soft">{s.planejarLead}</p>
        <div className="mt-3 grid gap-3">
          {PASSOS.map((p) => (
            <label key={p} className="block">
              {s.passos[p]}
              <textarea rows={2} value={plano[p] ?? ""} onChange={(e) => mudarPlano(p, e.target.value)} className={campo} />
            </label>
          ))}
        </div>
      </section>

      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">3. {s.escrever}</h2>
        <div className="mt-2 flex flex-wrap items-end gap-3">
          <label className="block">
            {s.minutos}
            <input type="number" min={10} max={180} value={minutos} disabled={Boolean(fim)} onChange={(e) => setMinutos(Math.max(10, Math.min(180, Number(e.target.value) || 90)))} className={campo} />
          </label>
          {!fim ? (
            <button type="button" className={botao} onClick={() => (setAgora(Date.now()), setFim(Date.now() + minutos * 60_000))}>{s.iniciar}</button>
          ) : (
            <button type="button" className={claro} onClick={() => setFim(null)}>{s.parar}</button>
          )}
          <span className={`font-mono text-lg ${fim && restante < 600 ? "text-oxblood" : ""}`} role="timer" aria-live="off">{restante > 0 ? relogio(restante) : s.acabou}</span>
        </div>
        <p className="mt-1 text-ink-soft">{s.tempoDica}</p>
        <div className="mt-4">{folha}</div>
      </section>

      <section className="mt-6 border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">4. {s.repertorio}</h2>
        <p className="mt-1 text-ink-soft">{s.repertorioLead}</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            {s.buscar}
            <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} />
          </label>
          <label className="block">
            {s.eixo}
            <select value={eixo} onChange={(e) => setEixo(e.target.value)} className={campo}>
              <option value="">{s.todos}</option>
              {Object.entries(eixos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
        </div>
        <p className="mt-2" role="status">{fill(s.achados, { n: achados.length })}</p>
        <ul className="mt-2 space-y-3">
          {achados.map((r) => (
            <li key={r.id} className="border border-rule bg-parchment p-3">
              <p className="font-semibold">{r.titulo}{r.coringa ? ` · ${s.coringa}` : ""}</p>
              <p className="mt-1">{r.resumo}</p>
              <p className="mt-1"><strong>{s.comoUsar}:</strong> {r.como_usar}</p>
              <p className="mt-1 text-xs text-ink-soft">
                {r.fonte.url ? <a href={r.fonte.url} className="underline hover:text-oxblood" rel="noopener noreferrer">{r.fonte.titulo}</a> : r.fonte.titulo}, {r.fonte.autor}{r.fonte.ano ? `, ${r.fonte.ano}` : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { lerEnem, mudarEnem, type Placar } from "@/lib/enem-aparelho";
import { AREAS_DO_PLANO, type AreaDoPlano, gerarPlano, icsDoPlano, MODOS, type Modo, type Plano, type Topico } from "@/lib/enem-plano";
import { hoje } from "@/lib/estudo";
import type { TextosDoEstudo } from "@/lib/textos-estudo";
import { L } from "../I18n";

type S = TextosDoEstudo["enem"]["plano"];
const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const botao = "cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const claro = "cursor-pointer border-2 border-ink px-3 py-1.5 font-semibold hover:border-oxblood hover:text-oxblood";

interface Escolhas {
  modo: Modo;
  horas: number;
  dias: number[];
  trabalha: boolean;
  pesos: Partial<Record<AreaDoPlano, number>>;
  hora: string;
}
interface Guardado {
  escolhas: Escolhas;
  plano: Plano;
}
const PADRAO: Escolhas = { modo: "reta-final", horas: 8, dias: [1, 2, 3, 4, 5], trabalha: true, pesos: {}, hora: "19:00" };

/** O último diagnóstico guardado no aparelho, como acerto (0 a 1) por área. */
function acertoDoDiagnostico(): Partial<Record<AreaDoPlano, number>> | undefined {
  const d = lerEnem().diagnosticos[0] as { porArea?: Record<string, Placar> } | undefined;
  if (!d?.porArea) return undefined;
  return Object.fromEntries(Object.entries(d.porArea).map(([a, [x, t]]) => [a, t ? x / t : 0.5]));
}

/**
 * O plano de estudos: a pessoa diz quanto tempo tem e quando, e o plano monta as semanas até a prova (lib/enem-plano.ts),
 * com o diagnóstico (se feito) e o que mais cai. Atrasou? "Refazer a partir de hoje", sem culpa. Fica só no aparelho;
 * pode ir para a agenda (.ics).
 */
export function MeuPlano({ topicos, prova, areas, s }: { topicos: Topico[]; prova: string; areas: Record<string, string>; s: S }) {
  const [esc, setEsc] = useState<Escolhas>(PADRAO);
  const [plano, setPlano] = useState<Plano | null>(null);
  const [comDiagnostico, setComDiagnostico] = useState(false);

  useEffect(() => {
    const g = lerEnem().plano as Guardado | null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- o plano guardado só existe no navegador
    setComDiagnostico(Boolean(acertoDoDiagnostico()));
    if (g?.plano && g.escolhas) {
      setEsc({ ...PADRAO, ...g.escolhas });
      setPlano(g.plano);
    }
  }, []);

  const montar = () => {
    const p = gerarPlano({ hoje: hoje(), prova, modo: esc.modo, horasPorSemana: esc.horas, dias: esc.dias, trabalha: esc.trabalha, pesos: esc.pesos, diagnostico: acertoDoDiagnostico(), topicos });
    setPlano(p);
    mudarEnem((e) => (e.plano = { escolhas: esc, plano: p } satisfies Guardado));
  };
  const baixar = () => {
    if (!plano) return;
    const url = URL.createObjectURL(new Blob([icsDoPlano(plano, esc.hora, `${window.location.origin}/pt`)], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "plano-enem.ics";
    a.click();
    URL.revokeObjectURL(url);
  };
  const DIAS = s.dias;

  return (
    <div className="mt-8 font-sans text-sm">
      <section className="border-2 border-ink bg-parchment-deep p-5">
        <h2 className="font-serif text-2xl font-semibold">{s.escolhas}</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="block">
            {s.modo}
            <select value={esc.modo} onChange={(e) => setEsc({ ...esc, modo: e.target.value as Modo })} className={campo}>
              {(Object.keys(MODOS) as Modo[]).map((m) => <option key={m} value={m}>{s.modos[m]}</option>)}
            </select>
          </label>
          <label className="block">
            {s.horas}
            <input type="number" min={1} max={80} value={esc.horas} onChange={(e) => setEsc({ ...esc, horas: Math.max(1, Math.min(80, Number(e.target.value) || 1)) })} className={campo} />
          </label>
          <fieldset className="sm:col-span-2">
            <legend>{s.quaisDias}</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {DIAS.map((nome, d) => (
                <label key={nome} className="inline-flex items-center gap-1">
                  <input type="checkbox" checked={esc.dias.includes(d)} onChange={(e) => setEsc({ ...esc, dias: e.target.checked ? [...esc.dias, d] : esc.dias.filter((x) => x !== d) })} /> {nome}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={esc.trabalha} onChange={(e) => setEsc({ ...esc, trabalha: e.target.checked })} /> {s.trabalha}
          </label>
          <label className="block">
            {s.hora}
            <input type="time" value={esc.hora} onChange={(e) => setEsc({ ...esc, hora: e.target.value || "19:00" })} className={campo} />
          </label>
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer font-semibold">{s.pesos}</summary>
          <p className="mt-1 text-ink-soft">{s.pesosLead}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-4">
            {AREAS_DO_PLANO.map((a) => (
              <label key={a} className="block">
                {areas[a]}
                <input type="number" min={0} max={10} step={0.5} value={esc.pesos[a] ?? 1} onChange={(e) => setEsc({ ...esc, pesos: { ...esc.pesos, [a]: Math.max(0, Math.min(10, Number(e.target.value) || 0)) } })} className={campo} />
              </label>
            ))}
          </div>
        </details>
        <p className="mt-3 text-ink-soft">{comDiagnostico ? s.comDiagnostico : s.semDiagnostico} {!comDiagnostico && <L href="/enem/diagnostico" className="underline hover:text-oxblood">{s.fazerDiagnostico}</L>}</p>
        <p className="mt-4 flex flex-wrap gap-3">
          <button type="button" className={botao} disabled={!esc.dias.length} onClick={montar}>{plano ? s.refazer : s.montar}</button>
          {plano && <button type="button" className={claro} onClick={baixar}>{s.agenda}</button>}
        </p>
      </section>

      {plano && (
        <section className="mt-8">
          <h2 className="font-serif text-2xl font-semibold">{s.suasSemanas}</h2>
          {plano.provaPassou && <p className="mt-2 text-oxblood">{s.provaPassou}</p>}
          {plano.diasAteAProva !== null && !plano.provaPassou && <p className="mt-2">{fill(s.diasAte, { n: plano.diasAteAProva })}</p>}
          {plano.ficaramDeFora > 0 && <p className="mt-2 text-ink-soft">{fill(s.foraDoTempo, { n: plano.ficaramDeFora })}</p>}
          <p className="mt-2 text-ink-soft">{fill(s.feitoEm, { data: plano.feitoEm.split("-").reverse().join("/") })} {s.semCulpa}</p>
          <ol className="mt-4 space-y-4">
            {plano.semanas.map((sem, i) => (
              <li key={sem.inicio} className="border border-rule bg-parchment-deep p-4">
                <p className="font-semibold">{fill(s.semana, { n: i + 1, de: sem.inicio.split("-").reverse().join("/"), ate: sem.fim.split("-").reverse().join("/") })}</p>
                {sem.itens.length === 0 ? (
                  <p className="text-ink-soft">{s.semanaLivre}</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {sem.itens.map((it, k) => (
                      <li key={`${it.dia}-${k}`} className="flex flex-wrap gap-x-2">
                        <span className="font-mono text-xs text-ink-soft">{it.dia.slice(8, 10)}/{it.dia.slice(5, 7)}</span>
                        <span className="font-mono text-xs">{s.tipos[it.tipo]}</span>
                        <L href={it.href} className="underline hover:text-oxblood">{it.titulo}</L>
                        <span className="text-ink-soft">({fill(s.minutos, { n: it.minutos })}{it.area ? ` · ${areas[it.area]}` : ""})</span>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

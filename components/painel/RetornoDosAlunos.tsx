// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useState } from "react";
import { useI18n } from "../I18n";
import { useTrackOptions } from "../useTrackOptions";
import { Aviso, useLista } from "./comum";

// O retorno dos alunos (uma das ideias do painel): as contagens anônimas de cada aula (abriu, terminou, fez o teste,
// acertou, "ajudou" e "não ajudou"), que o site já guarda sem identificar ninguém (aulas_funcionam, docs/MEDIR-SE-AS-AULAS-FUNCIONAM.md).
// Aqui viram uma tabela que aponta as aulas que precisam de cuidado: muita gente abre e pouca termina, ou muita gente
// diz que não ajudou.

interface Linha {
  aula: string;
  abriu: number;
  terminou: number;
  teste: number;
  acertou: number;
  ajudou: number;
  nao_ajudou: number;
}
type Ordem = "abertas" | "conclusao" | "nao_ajudou";

const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : null);

export function RetornoDosAlunos() {
  const { lang } = useI18n();
  const [dias, setDias] = useState(90);
  const lista = useLista<Linha[]>("aulas_funcionam", { p_dias: dias });
  const trilhas = useTrackOptions(lang);
  const [ordem, setOrdem] = useState<Ordem>("abertas");
  const titulos = useMemo(() => {
    const mapa = new Map<string, { aula: string; trilha: string }>();
    for (const t of trilhas) for (const l of t.lessons ?? []) mapa.set(`${t.slug}/${l.slug}`, { aula: l.title, trilha: t.title });
    return mapa;
  }, [trilhas]);
  const linhas = [...(lista.dados ?? [])].filter((l) => l.abriu >= 5);
  linhas.sort((a, b) =>
    ordem === "abertas" ? b.abriu - a.abriu : ordem === "conclusao" ? (pct(a.terminou, a.abriu) ?? 0) - (pct(b.terminou, b.abriu) ?? 0) : b.nao_ajudou - b.ajudou - (a.nao_ajudou - a.ajudou),
  );
  const cuidado = (l: Linha) => (pct(l.terminou, l.abriu) ?? 100) < 25 || (l.nao_ajudou >= 3 && l.nao_ajudou > l.ajudou);

  return (
    <section aria-labelledby="retorno" className="mt-10">
      <h2 id="retorno" className="font-serif text-2xl font-semibold">Retorno dos alunos</h2>
      <p className="mt-1 max-w-3xl text-sm text-ink-soft">
        Contagens anônimas de cada aula: quantas vezes foi aberta, terminada, quantos fizeram o teste e acertaram, e quantos disseram que ajudou ou não. Ninguém é identificado. Só entram aulas abertas pelo menos cinco vezes.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <label>
          Período{" "}
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} className="painel-campo border-2 border-ink bg-parchment-deep px-2 py-1">
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={365}>1 ano</option>
          </select>
        </label>
        <span role="group" aria-label="Ordenar" className="flex flex-wrap gap-1.5">
          {([["abertas", "Mais abertas"], ["conclusao", "Menos terminadas"], ["nao_ajudou", "Mais “não ajudou”"]] as [Ordem, string][]).map(([id, nome]) => (
            <button key={id} type="button" aria-pressed={ordem === id} onClick={() => setOrdem(id)} className={`cursor-pointer border-2 border-ink px-2.5 py-0.5 text-[0.8rem] font-semibold ${ordem === id ? "bg-ink text-parchment" : "bg-folha"}`}>
              {nome}
            </button>
          ))}
        </span>
      </div>
      <Aviso texto={lista.erro} />
      {lista.dados && linhas.length === 0 && <p className="mt-3 text-ink-soft">Ainda não há aulas com cinco aberturas neste período.</p>}
      {linhas.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-ink text-left">
                <th className="py-2 pr-3">Aula</th>
                <th className="px-2 text-right">Abriram</th>
                <th className="px-2 text-right">Terminaram</th>
                <th className="px-2 text-right">Acertaram o teste</th>
                <th className="px-2 text-right">Ajudou / não</th>
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, 60).map((l) => {
                const t = titulos.get(l.aula);
                return (
                  <tr key={l.aula} className={`border-b border-rule ${cuidado(l) ? "bg-oxblood/5" : ""}`}>
                    <td className="py-2 pr-3">
                      <a href={`/${lang}/trilhas/${l.aula}`} target="_blank" rel="noopener noreferrer" className="font-semibold hover:text-prelo-texto">{t?.aula ?? l.aula}</a>
                      {t && <span className="block text-xs text-ink-soft">{t.trilha}</span>}
                      {cuidado(l) && <span className="text-xs font-semibold text-oxblood">precisa de cuidado</span>}
                    </td>
                    <td className="px-2 text-right font-mono">{l.abriu}</td>
                    <td className="px-2 text-right font-mono">{pct(l.terminou, l.abriu) ?? "—"}%</td>
                    <td className="px-2 text-right font-mono">{l.teste ? `${pct(l.acertou, l.teste)}%` : "—"}</td>
                    <td className="px-2 text-right font-mono">{l.ajudou} / {l.nao_ajudou}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import type { TextosDoEstudo } from "@/lib/textos-estudo";

const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const LIMITE = 100;
const fmt = (n: number) => n.toFixed(1).replace(".", ",");

/** Uma linha do ranking em public/escolas/: [código, nome, município, rede (1 fed, 2 est, 3 mun, 4 priv),
 * participantes, geral, CN, CH, LC, MT, RED] — médias com uma casa decimal. */
export type LinhaEscola = [string, string, string, number, number, number, number, number, number, number, number];
export type IndiceEscolas = {
  fonte: string;
  gerado: string;
  ano: number;
  participantesMinimo: number;
  areas: string[];
  escolas: number;
  ufs: Record<string, number>;
  topo: LinhaEscola[];
};

const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();

/** As escolas do Brasil pelas médias do Enem 2024 (public/escolas/, gerado dos microdados do Inep por
 * scripts/enem/gerar-ranking-escolas.mjs). Tudo filtrado no aparelho; a UF escolhida baixa só o arquivo dela. */
export function RankingEscolas({ areas, s }: { areas: string[]; s: TextosDoEstudo["enem"]["escolas"] }) {
  const [indice, setIndice] = useState<IndiceEscolas | null>(null);
  const [falha, setFalha] = useState(false);
  const [uf, setUf] = useState("");
  const [rede, setRede] = useState(0);
  const [min, setMin] = useState(10);
  const [busca, setBusca] = useState("");
  const [porUf, setPorUf] = useState<Record<string, LinhaEscola[]>>({});

  useEffect(() => {
    fetch("/escolas/indice.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setIndice)
      .catch(() => setFalha(true));
  }, []);

  useEffect(() => {
    if (uf === "" || porUf[uf]) return;
    fetch(`/escolas/uf-${uf.toLowerCase()}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((lista: LinhaEscola[]) => setPorUf((mapa) => ({ ...mapa, [uf]: lista })))
      .catch(() => setFalha(true));
  }, [uf, porUf]);

  const ufs = useMemo(() => Object.keys(indice?.ufs ?? {}).sort(), [indice]);
  const nomesRede = [s.depFederal, s.depEstadual, s.depMunicipal, s.depPrivada];
  const base = uf === "" ? indice?.topo ?? null : porUf[uf] ?? null;
  const achadas = useMemo(() => {
    if (!base) return [];
    const q = norm(busca.trim());
    return base.filter(
      (e) =>
        e[4] >= min &&
        (rede === 0 || e[3] === rede) &&
        (q === "" || norm(e[1]).includes(q) || norm(e[2]).includes(q)),
    );
  }, [base, busca, min, rede]);

  return (
    <div className="mt-8 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block">
          {s.uf}
          <select className={campo} value={uf} onChange={(e) => setUf(e.target.value)}>
            <option value="">{s.topNacional}</option>
            {ufs.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.rede}
          <select className={campo} value={rede} onChange={(e) => setRede(Number(e.target.value))}>
            <option value={0}>{s.todasRedes}</option>
            {nomesRede.map((nome, i) => (
              <option key={nome} value={i + 1}>{nome}</option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.minParticipantes}
          <select className={campo} value={min} onChange={(e) => setMin(Number(e.target.value))}>
            {[10, 30, 50, 100].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.busca}
          <input className={campo} value={busca} onChange={(e) => setBusca(e.target.value)} />
        </label>
      </div>

      <p className="mt-4 text-ink-soft">
        {falha
          ? s.falha
          : base === null
            ? s.carregando
            : achadas.length === 0
              ? s.semResultado
              : achadas.length > LIMITE
                ? fill(s.mostrando, { m: LIMITE, n: achadas.length })
                : fill(s.resultados, { n: achadas.length })}
      </p>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-rule">
              <th className="py-1 pr-2">{s.posicao}</th>
              <th className="py-1 pr-2">{s.escola}</th>
              <th className="py-1 pr-2">{s.municipio}</th>
              <th className="py-1 pr-2">{s.participantes}</th>
              <th className="py-1 pr-2">{s.geral}</th>
              {areas.map((a) => (
                <th key={a} className="py-1 pr-2">{a}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {achadas.slice(0, LIMITE).map((e, i) => (
              <tr key={e[0]} className="border-b border-rule">
                <td className="py-1 pr-2 text-ink-soft">{i + 1}</td>
                <td className="py-1 pr-2">
                  {e[1]}
                  <span className="ml-1 text-ink-soft">({nomesRede[e[3] - 1] ?? "?"})</span>
                </td>
                <td className="py-1 pr-2">{e[2]}</td>
                <td className="py-1 pr-2">{e[4]}</td>
                <td className="py-1 pr-2 font-semibold">{fmt(e[5])}</td>
                {(e.slice(6) as number[]).map((n, j) => (
                  <td key={j} className="py-1 pr-2">{fmt(n)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

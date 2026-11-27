// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import { fill } from "@/i18n/config";
import { mediaDaOferta, ultimoCorte, PROVAS_DO_SISU, type CatalogoSisu, type OfertaSisu, type ProvaDoSisu } from "@/lib/enem-sisu";
import type { TextosDoEstudo } from "@/lib/textos-estudo";

const campo = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const LIMITE = 60;
const fmt = (n: number) => n.toFixed(2).replace(".", ",");

/** As notas da pessoa contra as ofertas reais do Sisu: pesos de cada curso e notas de corte da ampla
 * concorrência desde 2020 (dados públicos do MEC via sisu-data, MIT). Tudo calculado no aparelho. */
export function SimuladorSisu({ nomes, s }: { nomes: Record<ProvaDoSisu, string>; s: TextosDoEstudo["enem"]["sisu"] }) {
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [busca, setBusca] = useState("");
  const [uf, setUf] = useState("");
  const [catalogo, setCatalogo] = useState<CatalogoSisu | null>(null);
  const [falha, setFalha] = useState(false);

  useEffect(() => {
    fetch("/sisu/ofertas.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setCatalogo)
      .catch(() => setFalha(true));
  }, []);

  const ler = (v: string | undefined) => (v === undefined || v.trim() === "" ? undefined : Number(v.replace(",", ".")));
  const notasLidas = useMemo(() => Object.fromEntries(PROVAS_DO_SISU.map((p) => [p, ler(notas[p])])), [notas]);

  const ufs = useMemo(() => [...new Set((catalogo?.ofertas ?? []).map((o) => o.uf))].sort(), [catalogo]);
  const achadas = useMemo(() => {
    if (!catalogo) return [];
    const q = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
    const porTexto = (o: OfertaSisu) =>
      q === "" || [o.curso, o.ies, o.sg, o.cidade, o.campus].some((t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().includes(q));
    const comMedia = catalogo.ofertas
      .filter((o) => (uf === "" || o.uf === uf) && porTexto(o))
      .map((o) => ({ o, media: mediaDaOferta(notasLidas, o), corte: ultimoCorte(o) }));
    // com as notas preenchidas, o mais perto do alcance vem primeiro; sem notas, o maior corte recente primeiro
    comMedia.sort((a, b) =>
      a.media !== null && b.media !== null
        ? (b.corte ? b.media - b.corte.nota : -1) - (a.corte ? a.media - a.corte.nota : -1)
        : (b.corte?.nota ?? 0) - (a.corte?.nota ?? 0),
    );
    return comMedia;
  }, [catalogo, busca, uf, notasLidas]);

  return (
    <div className="mt-8 border-2 border-ink bg-parchment-deep p-5 font-sans text-sm">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-rule">
            <th className="py-1 pr-2">{s.prova}</th>
            <th className="py-1">{s.nota}</th>
          </tr>
        </thead>
        <tbody>
          {PROVAS_DO_SISU.map((p) => (
            <tr key={p} className="border-b border-rule">
              <td className="py-1 pr-2">{nomes[p]}</td>
              <td className="py-1">
                <input inputMode="decimal" aria-label={`${s.nota}: ${nomes[p]}`} value={notas[p] ?? ""} onChange={(e) => setNotas({ ...notas, [p]: e.target.value })} className={campo} placeholder="0 a 1000" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-4 grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="block">
          <span className="font-mono text-xs uppercase">{s.busca}</span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} className={campo} placeholder="Medicina, USP, Maceió…" />
        </label>
        <label className="block">
          <span className="font-mono text-xs uppercase">{s.uf}</span>
          <select value={uf} onChange={(e) => setUf(e.target.value)} className={campo}>
            <option value="">{s.todasUfs}</option>
            {ufs.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-4 font-mono text-xs" role="status">
        {falha ? s.falha : catalogo === null ? s.carregando : achadas.length > LIMITE ? fill(s.mostrando, { m: String(LIMITE), n: String(achadas.length) }) : fill(s.resultados, { n: String(achadas.length) })}
      </p>
      <ul className="mt-2 space-y-3">
        {achadas.slice(0, LIMITE).map(({ o, media, corte }) => (
          <li key={`${o.co ?? o.cod}`} className="border-2 border-ink bg-parchment p-4">
            <p className="font-serif text-base">
              {o.curso} <span className="font-sans text-xs">({o.grau}, {o.turno.toLowerCase()})</span>
            </p>
            <p className="font-sans text-xs">{o.ies} ({o.sg}) — {o.campus}, {o.cidade}/{o.uf}{o.cod ? ` · ${s.codigoMec} ${o.cod}` : ""}</p>
            <p className="mt-2 font-mono text-xs">{o.sm ? s.semPesos : `${s.pesosDaOferta}: ${(o.p ?? []).join(" · ")}`}</p>
            <p className="mt-1 font-mono text-xs">
              {s.historico}:{" "}
              {Object.keys(o.c).sort().map((a) => `${a}: ${fmt(o.c[a])}`).join(" · ")}
            </p>
            {media !== null && corte && (
              <p className="mt-2 font-serif text-lg" role="status">
                {s.suaMedia}: {fmt(media)} — {fill(media >= corte.nota ? s.dentro : s.fora, { c: fmt(corte.nota), a: String(corte.ano), d: fmt(Math.abs(media - corte.nota)) })}
              </p>
            )}
          </li>
        ))}
        {catalogo !== null && achadas.length === 0 && <li className="font-sans text-sm">{s.semResultado}</li>}
      </ul>
    </div>
  );
}

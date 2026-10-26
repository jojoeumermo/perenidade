// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";

type Estado = { ok: boolean | null; ms: number };

/** Mede um serviço: responde ou não, e em quanto tempo (dez segundos no máximo). */
async function medir(teste: () => Promise<unknown>): Promise<Estado> {
  const inicio = performance.now();
  try {
    await Promise.race([teste(), new Promise((_, falhar) => setTimeout(() => falhar(new Error("demorou")), 10000))]);
    return { ok: true, ms: Math.round(performance.now() - inicio) };
  } catch {
    return { ok: false, ms: Math.round(performance.now() - inicio) };
  }
}

/**
 * O status do site, conferido daqui mesmo, do aparelho de quem abre: o site responde, o banco (Comunidade, painel,
 * contas) responde e o índice da busca abre. Não guarda nada.
 */
export function StatusDoSite({ lang, s }: { lang: string; s: Dict["status"] }) {
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [quando, setQuando] = useState("");
  const conferir = useCallback(async () => {
    setEstados({});
    // Só o cabeçalho (HEAD): confere que responde sem baixar o arquivo, que no caso do índice da busca é grande.
    const pedir = async (url: string) => {
      const r = await fetch(url, { method: "HEAD", cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
    };
    const [site, banco, busca] = await Promise.all([
      medir(() => pedir("/robots.txt")),
      hasBackend ? medir(() => rpc("site")) : Promise.resolve({ ok: null, ms: 0 }),
      medir(() => pedir(`/${lang}/indice.json`)),
    ]);
    setEstados({ site, banco, busca });
    setQuando(new Date().toLocaleTimeString(lang));
  }, [lang]);
  useEffect(() => {
    queueMicrotask(() => void conferir());
  }, [conferir]);

  const linhas: [string, string, string][] = [["site", s.site, s.siteAjuda], ["banco", s.banco, s.bancoAjuda], ["busca", s.busca, s.buscaAjuda]];
  const tudo = Object.values(estados);
  const geral = tudo.length < 3 ? null : tudo.every((e) => e.ok !== false);

  return (
    <div className="font-sans">
      <p role="status" className={`border-2 border-ink p-4 text-lg font-bold ${geral === null ? "bg-folha" : geral ? "bg-[#d9ead3]" : "bg-[#f4cccc]"} text-[#1f1a14]`}>
        {geral === null ? s.conferindo : geral ? s.tudoOk : s.problema}
      </p>
      <ul className="mt-6 divide-y divide-rule border-y-2 border-ink">
        {linhas.map(([id, nome, ajuda]) => {
          const e = estados[id];
          return (
            <li key={id} className="flex items-center gap-4 py-4">
              <span aria-hidden className={`h-4 w-4 shrink-0 rounded-full ${!e ? "bg-rule" : e.ok === null ? "bg-gold" : e.ok ? "bg-[#2f6f4f]" : "bg-[#c21f16]"}`} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{nome}</p>
                <p className="text-sm text-ink-soft">{ajuda}</p>
              </div>
              <p className="text-right font-mono text-sm">
                {!e ? "…" : e.ok === null ? s.semBanco : e.ok ? `${s.noAr} · ${e.ms} ms` : s.fora}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 flex flex-wrap items-center gap-4 text-sm text-ink-soft">
        {quando && <span>{s.conferidoAs.replace("{hora}", quando)}</span>}
        <button type="button" onClick={() => void conferir()} className="cursor-pointer border-2 border-ink px-4 py-2 font-semibold text-ink hover:border-oxblood hover:text-oxblood">{s.deNovo}</button>
      </p>
      <p className="mt-8 max-w-2xl text-sm">{s.foraDoAr}</p>
    </div>
  );
}

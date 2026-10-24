// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import type { Dict } from "@/i18n/types";

interface Checagem {
  alegacao: string;
  autor: string;
  avaliacoes: { agencia: string; veredito: string; titulo: string; link: string; data: string }[];
}

/**
 * Busca nas checagens que as agências já publicaram (Google Fact Check Tools, pelo nosso servidor).
 * Só aparece quando a chave do serviço está configurada no servidor.
 */
export function FactCheckSearch({ s }: { s: Dict["factCheck"] }) {
  const [ativo, setAtivo] = useState(false);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState<"idle" | "busy" | "none" | "fail">("idle");
  const [lista, setLista] = useState<Checagem[]>([]);

  useEffect(() => {
    fetch("/api/checagens")
      .then((resposta) => (resposta.ok ? resposta.json() : null))
      .then((dados: { ativo?: boolean } | null) => setAtivo(dados?.ativo === true))
      .catch(() => {});
  }, []);

  if (!ativo) return null;

  async function buscar() {
    if (busca.trim().length < 3) return;
    setEstado("busy");
    try {
      const dados = await (await fetch(`/api/checagens?q=${encodeURIComponent(busca.trim())}`)).json();
      if (dados.erro) return setEstado("fail");
      setLista(dados.checagens ?? []);
      setEstado(dados.checagens?.length ? "idle" : "none");
    } catch {
      setEstado("fail");
    }
  }

  return (
    <section aria-labelledby="ja-foi-checado" className="cartao-v p-6 font-sans sm:p-9">
      <p className="rotulo">{s.eyebrow}</p>
      <h2 id="ja-foi-checado" className="mt-2 font-serif text-[2.2rem] font-medium leading-[1.05] sm:text-5xl">{s.searchTitle}</h2>
      <p className="mt-3 max-w-2xl font-serif text-xl leading-snug text-ink-soft">{s.searchLead}</p>
      <form className="mt-6 flex max-w-2xl shadow-[5px_5px_0_var(--sombra)]" onSubmit={(e) => { e.preventDefault(); void buscar(); }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={100} placeholder={s.searchPlaceholder} aria-label={s.searchTitle} className="min-h-12 min-w-0 flex-1 border-2 border-r-0 border-ink bg-parchment px-4 py-3 text-base text-ink outline-none placeholder:text-ink-soft" />
        <button type="submit" disabled={estado === "busy" || busca.trim().length < 3} className="cursor-pointer border-2 border-ink bg-[#c21f16] px-5 font-extrabold text-white hover:bg-[#a51810] disabled:cursor-not-allowed disabled:opacity-60 sm:px-7">{s.searchButton}</button>
      </form>
      <p role="status" className="mt-3 min-h-6 font-semibold text-prelo-texto">{estado === "none" ? s.searchNone : estado === "fail" ? s.searchFail : ""}</p>
      {lista.length > 0 && (
        <ul className="mt-2 flex flex-col border-t-2 border-ink">
          {lista.map((item, i) => (
            <li key={i} className="border-b-[1.5px] border-dashed border-rule py-5">
              <p className="font-serif text-xl leading-snug">
                “{item.alegacao}”{item.autor && <span className="text-ink-soft"> ({item.autor})</span>}
              </p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {item.avaliacoes.map((avaliacao) => (
                  <li key={avaliacao.link} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="border-2 border-ink px-2 py-0.5 font-mono text-xs font-semibold uppercase tracking-[0.08em]">{avaliacao.veredito || "—"}</span>
                    <span className="text-sm text-ink-soft">{avaliacao.agencia}</span>
                    <a href={avaliacao.link} target="_blank" rel="noopener noreferrer nofollow" className="font-semibold text-ink underline decoration-[#c21f16] decoration-2 underline-offset-4 hover:text-prelo-texto">
                      {avaliacao.titulo || avaliacao.link} ↗
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-sm text-ink-soft">{s.searchSource}</p>
    </section>
  );
}

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
    <section className="mt-10 border-2 border-ink bg-parchment-deep p-5 font-sans sm:p-6">
      <h2 className="font-serif text-2xl font-semibold">{s.searchTitle}</h2>
      <p className="mt-1 text-ink-soft">{s.searchLead}</p>
      <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); void buscar(); }}>
        <input value={busca} onChange={(e) => setBusca(e.target.value)} maxLength={100} placeholder={s.searchPlaceholder} aria-label={s.searchTitle} className="min-w-0 flex-1 border-2 border-ink bg-parchment px-3 py-2" />
        <button type="submit" disabled={estado === "busy" || busca.trim().length < 3} className="cursor-pointer bg-ink px-5 py-2 font-medium text-parchment hover:bg-oxblood disabled:opacity-50">{s.searchButton}</button>
      </form>
      <p role="status" className="mt-2 min-h-5 text-oxblood">{estado === "none" ? s.searchNone : estado === "fail" ? s.searchFail : ""}</p>
      <ul className="mt-2 space-y-4">
        {lista.map((item, i) => (
          <li key={i} className="border-t border-rule pt-3">
            <p className="font-serif text-lg">“{item.alegacao}”{item.autor && <span className="text-ink-soft"> ({item.autor})</span>}</p>
            <ul className="mt-1 space-y-1">
              {item.avaliacoes.map((avaliacao) => (
                <li key={avaliacao.link}>
                  <strong>{avaliacao.veredito || "—"}</strong>, {avaliacao.agencia}:{" "}
                  <a href={avaliacao.link} target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-oxblood">{avaliacao.titulo || avaliacao.link}</a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-ink-soft">{s.searchSource}</p>
    </section>
  );
}

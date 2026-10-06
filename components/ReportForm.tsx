"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { github } from "@/lib/site";

// Os valores precisam bater com as opções de .github/ISSUE_TEMPLATE/denuncia.yml.
const reasons = [
  "Violação de direitos autorais",
  "Informação errada ou enganosa",
  "Conteúdo ofensivo ou impróprio",
  "Link quebrado ou fonte ilegítima",
  "Outro",
];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

export function ReportForm() {
  const params = useSearchParams();
  const [item, setItem] = useState(params.get("item") ?? "");
  const [reason, setReason] = useState(reasons[0]);
  const [details, setDetails] = useState("");
  const ready = item.trim().length > 0 && details.trim().length >= 20;

  const href = github.newIssue("denuncia.yml", {
    title: `Denúncia: ${item.trim()}`,
    item: item.trim(),
    motivo: reason,
    detalhes: details.trim(),
  });

  return (
    <form className="mt-10 space-y-5 font-sans text-sm" onSubmit={(e) => e.preventDefault()}>
      <label className="block">
        Página ou item denunciado
        <input
          value={item}
          onChange={(e) => setItem(e.target.value)}
          placeholder="/acervo/nome-da-obra"
          className={`${field} font-mono`}
        />
      </label>
      <label className="block">
        Motivo
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
          {reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="block">
        O que está errado
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={6}
          placeholder="Explique o problema. Em caso de direitos autorais, diga qual é a obra e quem é o titular."
          className={field}
        />
      </label>
      {ready ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block bg-oxblood px-8 py-3 font-medium text-parchment hover:bg-ink"
        >
          Registrar denúncia no GitHub ↗
        </a>
      ) : (
        <p className="text-ink-soft">Informe o item e descreva o problema (pelo menos 20 caracteres) para continuar.</p>
      )}
    </form>
  );
}

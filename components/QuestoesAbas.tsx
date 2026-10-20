// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { useI18n } from "./I18n";

/**
 * O banco de questões em duas partes iguais, lado a lado: as questões das aulas do instituto e as provas públicas
 * (ENEM, vestibulares, olimpíadas, OAB, Revalida). A pessoa escolhe qual abrir; nenhuma fica escondida embaixo da outra.
 * O endereço guarda a escolha (#do-instituto ou #provas-publicas), para dar para mandar o link certo.
 */
export function QuestoesAbas({ instituto, publicas, totalInstituto }: { instituto: React.ReactNode; publicas: React.ReactNode; totalInstituto: number }) {
  const { lang, t } = useI18n();
  const s = t.lists;
  const [aba, setAba] = useState<"instituto" | "publicas">("instituto");
  useEffect(() => {
    if (window.location.hash === "#provas-publicas") void Promise.resolve().then(() => setAba("publicas"));
  }, []);
  const escolher = (nova: "instituto" | "publicas") => {
    setAba(nova);
    window.history.replaceState(null, "", nova === "publicas" ? "#provas-publicas" : "#do-instituto");
  };
  const cartao = (id: "instituto" | "publicas", titulo: string, dica: string, icone: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={aba === id}
      aria-controls={`painel-${id}`}
      onClick={() => escolher(id)}
      className={`flex cursor-pointer items-start gap-3 border-2 p-4 text-left transition-colors ${aba === id ? "border-ink bg-ink text-parchment" : "border-ink/25 bg-parchment-deep hover:border-ink"}`}
    >
      <span aria-hidden className="text-3xl leading-none">{icone}</span>
      <span>
        <span className="block font-serif text-xl font-semibold">{titulo}</span>
        <span className={`block font-sans text-sm ${aba === id ? "text-parchment/80" : "text-ink-soft"}`}>{dica}</span>
      </span>
    </button>
  );
  return (
    <div className="mt-8">
      <div role="tablist" aria-label={s.bankTitle} className="grid gap-3 sm:grid-cols-2">
        {cartao("instituto", s.bankTabInstitute, fill(s.bankTabInstituteHint, { n: totalInstituto.toLocaleString(lang) }), "🏫")}
        {cartao("publicas", s.publicTitle, s.bankTabPublicHint, "📜")}
      </div>
      <div id="painel-instituto" role="tabpanel" hidden={aba !== "instituto"}>{aba === "instituto" && instituto}</div>
      <div id="painel-publicas" role="tabpanel" hidden={aba !== "publicas"}>{aba === "publicas" && publicas}</div>
    </div>
  );
}

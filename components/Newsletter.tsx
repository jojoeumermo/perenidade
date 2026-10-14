// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { site } from "@/lib/site";
import { useI18n } from "./I18n";

/** Caixa de assinatura do boletim do jornal. Guarda só o endereço; quem escreve o jornal é quem envia. */
export function Newsletter({ s }: { s: Dict["journal"]["newsletter"] }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  if (!hasBackend) return null;

  async function submit() {
    setState("sending");
    setError("");
    try {
      await rpc("boletim_assinar", { p_email: email, p_site: trap });
      setState("done");
      setEmail("");
    } catch (failure) {
      setError(errorText(t, failure instanceof BackendError ? failure.code : "falha"));
      setState("idle");
    }
  }

  return (
    <section aria-labelledby="boletim" className="no-print mt-10 border-4 border-ink bg-parchment-deep">
      <h2 id="boletim" className="jornal-preto px-5 py-3 font-sans text-xl font-black uppercase italic tracking-tight sm:text-2xl">{s.title}</h2>
      <div className="px-5 py-4">
      <p className="max-w-2xl font-sans text-sm text-ink-soft">{s.lead}</p>
      {state === "done" ? (
        <p role="status" className="mt-3 font-sans text-sm font-medium">{s.done}</p>
      ) : (
        <form className="mt-3 flex flex-wrap items-end gap-2 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <label className="block min-w-48 flex-1">
            {s.email}
            <input type="email" required autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full border-2 border-ink bg-parchment px-3 py-2" />
          </label>
          <label className="sr-only" aria-hidden>
            Site
            <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
          </label>
          <button type="submit" disabled={state === "sending" || !email.includes("@")} className="cursor-pointer whitespace-nowrap border-2 border-ink bg-ink px-4 py-2 font-extrabold uppercase tracking-wide text-parchment hover:border-oxblood hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
            {s.button}
          </button>
        </form>
      )}
      {error && <p role="alert" className="mt-2 font-sans text-sm text-oxblood">{error}</p>}
      <p className="mt-2 font-sans text-xs text-ink-soft">
        {s.leave} <a href={`mailto:${site.newsletter}`} className="underline hover:text-oxblood">{site.newsletter}</a>.
      </p>
      </div>
    </section>
  );
}

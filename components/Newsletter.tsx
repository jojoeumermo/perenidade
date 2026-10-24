// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { site } from "@/lib/site";
import { useI18n } from "./I18n";

/** Caixa de assinatura do boletim do jornal. Guarda só o endereço; quem escreve o jornal é quem envia. */
export function Newsletter({ s, faixa = false }: { s: Dict["journal"]["newsletter"]; faixa?: boolean }) {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  /** O endereço só entra na lista depois do clique no link do e-mail. */
  const [confirmar, setConfirmar] = useState(false);

  // Quem chega pelo link do e-mail ("?boletim=confirmar&codigo=…" ou "sair"): confirma ou sai da lista na hora.
  useEffect(() => {
    if (!hasBackend) return;
    const params = new URLSearchParams(window.location.search);
    const acao = params.get("boletim");
    const codigo = params.get("codigo") ?? "";
    if ((acao !== "confirmar" && acao !== "sair") || !codigo) return;
    // O código não fica no histórico do navegador nem vai adiante em links.
    window.history.replaceState(null, "", window.location.pathname);
    rpc(acao === "confirmar" ? "boletim_confirmar" : "boletim_sair", { p_codigo: codigo })
      .then(() => setLink(acao === "confirmar" ? s.confirmed : s.left))
      .catch(() => setLink(s.badLink));
  }, [s.confirmed, s.left, s.badLink]);

  if (!hasBackend) return null;

  async function submit() {
    setState("sending");
    setError("");
    try {
      const r = await rpc<{ confirmar?: boolean }>("boletim_assinar", { p_email: email, p_site: trap });
      setConfirmar(r?.confirmar === true);
      setState("done");
      setEmail("");
    } catch (failure) {
      setError(errorText(t, failure instanceof BackendError ? failure.code : "falha"));
      setState("idle");
    }
  }

  // A faixa vermelha de ponta a ponta da capa do jornal: o convite à esquerda, o campo e o botão à direita.
  if (faixa)
    return (
      <section aria-labelledby="boletim" className="no-print border-y-[3px] border-ink bg-[#c21f16] text-white">
        <div className="mx-auto flex max-w-[78rem] flex-wrap items-center justify-between gap-x-10 gap-y-5 px-4 py-9 sm:px-6 lg:px-8">
          <div className="min-w-0 max-w-xl">
            <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em]">{s.bandLabel}</p>
            <h2 id="boletim" className="mt-1.5 font-serif text-[1.9rem] font-semibold leading-tight">{s.bandTitle}</h2>
            <p className="mt-2 font-sans text-sm text-white/90">{s.lead}</p>
          </div>
          <div className="w-full max-w-[29rem] font-sans">
            {link && <p role="status" className="mb-3 border-l-4 border-white pl-3 text-sm font-semibold">{link}</p>}
            {state === "done" ? (
              <p role="status" className="border-2 border-ink bg-folha p-4 text-sm font-semibold text-ink">{confirmar ? s.done : s.doneDirect}</p>
            ) : (
              <form className="flex shadow-[5px_5px_0_#1f1a14]" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{s.email}</span>
                  <input type="email" required autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={s.email} className="h-full w-full border-2 border-r-0 border-ink bg-folha px-4 py-3.5 text-base text-ink placeholder:text-ink-soft" />
                </label>
                <label className="sr-only" aria-hidden>
                  Site
                  <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
                </label>
                <button type="submit" disabled={state === "sending" || !email.includes("@")} className="cursor-pointer whitespace-nowrap border-2 border-ink bg-[#1f1a14] px-5 font-extrabold text-[#f4ecd8] hover:bg-black disabled:cursor-not-allowed disabled:opacity-60">
                  {s.button}
                </button>
              </form>
            )}
            {error && <p role="alert" className="mt-2 text-sm font-semibold">{error}</p>}
            <p className="mt-3 text-xs text-white/90">
              {s.leave} <a href={`mailto:${site.newsletter}`} className="underline hover:text-white">{site.newsletter}</a>.
            </p>
          </div>
        </div>
      </section>
    );

  return (
    <section aria-labelledby="boletim" className="no-print mt-10 border-4 border-ink bg-parchment-deep">
      <h2 id="boletim" className="jornal-preto px-5 py-3 font-sans text-xl font-black uppercase italic tracking-tight sm:text-2xl">{s.title}</h2>
      <div className="px-5 py-4">
      <p className="max-w-2xl font-sans text-sm text-ink-soft">{s.lead}</p>
      {link && <p role="status" className="mt-3 border-l-4 border-oxblood pl-3 font-sans text-sm font-semibold">{link}</p>}
      {state === "done" ? (
        <p role="status" className="mt-3 font-sans text-sm font-medium">{confirmar ? s.done : s.doneDirect}</p>
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

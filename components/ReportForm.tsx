// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Dict } from "@/i18n/types";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { errorText } from "@/i18n/core";
import { useI18n } from "./I18n";

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";

export function ReportForm({ s }: { s: Dict["report"] }) {
  const { t } = useI18n();
  const params = useSearchParams();
  const [item, setItem] = useState(params.get("item") ?? "");
  const [reason, setReason] = useState(s.reasons[0]);
  const [details, setDetails] = useState("");
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<{ status: "idle" | "sending" | "sent" | "error"; message?: string }>({ status: "idle" });
  const ready = item.trim().length > 0 && details.trim().length >= 20;

  async function send() {
    setState({ status: "sending" });
    try {
      await rpc("denunciar", { p_alvo: item.trim(), p_motivo: reason, p_detalhes: details.trim(), p_site: trap });
      setDetails("");
      setState({ status: "sent" });
    } catch (error) {
      setState({ status: "error", message: errorText(t, error instanceof BackendError ? error.code : "falha") });
    }
  }

  if (state.status === "sent") return <p role="status" className="mt-10 border-l-2 border-ok pl-4 font-sans text-ok">{s.sent}</p>;

  return (
    <form className="mt-10 space-y-5 font-sans text-sm" onSubmit={(e) => e.preventDefault()}>
      <label className="block">
        {s.item}
        <input value={item} onChange={(e) => setItem(e.target.value)} placeholder="/acervo/…" maxLength={300} className={`${field} font-mono`} />
      </label>
      <label className="block">
        {s.reason}
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={field}>
          {s.reasons.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </label>
      <label className="block">
        {s.details}
        <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={6} maxLength={4000} placeholder={s.detailsPlaceholder} className={field} />
      </label>
      <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Site
          <input tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>
      {!hasBackend ? (
        <p className="text-ink-soft">{s.offline}</p>
      ) : (
        <button
          type="button"
          disabled={!ready || state.status === "sending"}
          onClick={send}
          className="cursor-pointer bg-oxblood px-8 py-3 font-medium text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
        >
          {s.submit}
        </button>
      )}
      {!ready && hasBackend && <p className="text-ink-soft">{s.notReady}</p>}
      {state.status === "error" && <p role="alert" className="text-oxblood">{state.message}</p>}
    </form>
  );
}

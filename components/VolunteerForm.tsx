// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import { useI18n } from "./I18n";

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
/** A ordem em que as funções aparecem: primeiro as que mais precisam de gente. */
export const volunteerRoles = ["educacao", "educacao_secundaria", "mediacao", "revisao", "traducao", "jornalismo", "mentoria", "design", "marketing", "desenvolvimento", "curadoria"] as const;
// "site" é um campo-isca: gente não vê, robô preenche, e o envio é descartado sem aviso.
const empty = { nome: "", email: "", papel: "educacao", disciplina: "", mensagem: "", site: "" };

/**
 * Candidatura a voluntário, sem precisar de conta: nome completo, e-mail de contato, função pretendida e uma
 * apresentação. Vai para a fila da coordenação, que responde por e-mail.
 */
export function VolunteerForm({ s, id = "candidatura" }: { s: Dict["volunteer"]; id?: string }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(empty);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const servico = useCadastro();
  const roles = s.roles as Record<string, string>;
  const bySubject = draft.papel === "educacao" || draft.papel === "educacao_secundaria" || draft.papel === "mentoria";
  const ready = draft.nome.trim().length >= 5 && /^\S+@\S+\.\S+$/.test(draft.email.trim()) && draft.mensagem.trim().length >= 30 && (!bySubject || draft.disciplina !== "");

  // Serviço desligado, ou banco que ainda não recebeu a fila de candidaturas: avisa em vez de mostrar um formulário que falharia.
  if (!hasBackend || (servico.pronto && !servico.novo)) return <p id={id} className="mt-6 scroll-mt-24 font-sans text-sm text-ink-soft">{s.offline}</p>;

  async function send() {
    setState("sending");
    setError("");
    try {
      await rpc("voluntariar", { p: { ...draft, disciplina: bySubject ? draft.disciplina : "" } });
      setDraft(empty);
      setState("sent");
    } catch (failure) {
      setError(errorText(t, failure instanceof BackendError ? failure.code : "falha"));
      setState("idle");
    }
  }

  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="no-print mt-10 scroll-mt-24 border border-rule bg-parchment-deep p-5 font-sans text-sm sm:p-6">
      <h2 id={`${id}-titulo`} className="font-serif text-2xl font-semibold">{s.title}</h2>
      <p className="mt-1 text-ink-soft">{s.lead}</p>
      {state === "sent" ? (
        <p role="status" className="mt-4 border-l-2 border-ok pl-4 text-base">{s.sent}</p>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              {s.name}
              <input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} required minLength={5} maxLength={120} autoComplete="name" className={field} />
            </label>
            <label className="block">
              {s.email}
              <input type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} required maxLength={200} autoComplete="email" className={field} />
            </label>
            <label className="block">
              {s.role}
              <select value={draft.papel} onChange={(e) => setDraft({ ...draft, papel: e.target.value })} className={field}>
                {volunteerRoles.map((role) => (
                  <option key={role} value={role}>{roles[role]}</option>
                ))}
              </select>
            </label>
            {bySubject && (
              <label className="block">
                {s.discipline}
                <select value={draft.disciplina} onChange={(e) => setDraft({ ...draft, disciplina: e.target.value })} required className={field}>
                  <option value="">{s.chooseDiscipline}</option>
                  {areaSlugs.map((slug) => (
                    <option key={slug} value={slug}>{t.areas[slug][0]}</option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <label className="block">
            {s.message}
            <textarea value={draft.mensagem} onChange={(e) => setDraft({ ...draft, mensagem: e.target.value })} required minLength={30} maxLength={2000} rows={5} className={field} />
            <span className="mt-1 block text-ink-soft">{s.messageHint}</span>
          </label>
          <label className="sr-only" aria-hidden>
            Site
            <input tabIndex={-1} autoComplete="off" value={draft.site} onChange={(e) => setDraft({ ...draft, site: e.target.value })} />
          </label>
          <button type="submit" disabled={!ready || state === "sending"} className="cursor-pointer bg-oxblood px-6 py-2.5 font-medium text-parchment hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50">
            {s.send}
          </button>
          <p role="alert" className="min-h-5 text-oxblood">{error}</p>
          <p className="text-ink-soft">{s.privacy}</p>
        </form>
      )}
    </section>
  );
}

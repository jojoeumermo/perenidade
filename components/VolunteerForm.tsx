// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import { useCadastro } from "@/lib/cadastro";
import { useI18n } from "./I18n";

const field = "mt-1 w-full border-2 border-ink bg-folha px-3 py-2";
/** A ordem em que as funções aparecem: primeiro as que mais precisam de gente. */
export const volunteerRoles = ["educacao", "educacao_secundaria", "mediacao", "revisao", "traducao", "jornalismo", "mentoria", "design", "marketing", "desenvolvimento", "curadoria"] as const;
// "site" é um campo-isca: gente não vê, robô preenche, e o envio é descartado sem aviso.
const empty = { nome: "", sobrenome: "", instagram: "", email: "", papel: "educacao", disciplina: "", mensagem: "", site: "" };
/** O usuário do Instagram, sem o @ e sem o endereço: aceita "@fulana", "fulana" ou "instagram.com/fulana". */
const usuarioDoInstagram = (valor: string) => valor.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/\/.*$/, "");

/**
 * Candidatura a voluntário, sem precisar de conta: nome e sobrenome, o Instagram (se tiver), e-mail de contato, função
 * pretendida e uma apresentação. A coordenação precisa saber a quem está dando acesso ao painel: vai tudo para a fila
 * dela, que responde por e-mail.
 */
export function VolunteerForm({ s, id = "candidatura", tarefas = [] }: { s: Dict["volunteer"]; id?: string; tarefas?: { id: string; titulo: string }[] }) {
  const { t } = useI18n();
  const [draft, setDraft] = useState(empty);
  // Veio de "Quero fazer esta" (uma das tarefas rápidas): a apresentação já começa com a tarefa escolhida.
  useEffect(() => {
    const escolher = () => {
      const tarefa = tarefas.find((x) => x.id === new URLSearchParams(window.location.search).get("tarefa"));
      if (tarefa) setDraft((d) => (d.mensagem.trim() ? d : { ...d, mensagem: `Quero ajudar com a tarefa "${tarefa.titulo}".\n\nO que sei fazer: \nQuanto tempo tenho por semana: ` }));
    };
    escolher();
    window.addEventListener("popstate", escolher);
    window.addEventListener("hashchange", escolher);
    return () => {
      window.removeEventListener("popstate", escolher);
      window.removeEventListener("hashchange", escolher);
    };
  }, [tarefas]);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const servico = useCadastro();
  const roles = s.roles as Record<string, string>;
  const bySubject = draft.papel === "educacao" || draft.papel === "educacao_secundaria" || draft.papel === "mentoria";
  const instagram = usuarioDoInstagram(draft.instagram);
  const instagramOk = instagram === "" || /^[A-Za-z0-9._]{1,30}$/.test(instagram);
  const nomeCompleto = `${draft.nome.trim()} ${draft.sobrenome.trim()}`.replace(/\s+/g, " ");
  const ready = draft.nome.trim().length >= 2 && draft.sobrenome.trim().length >= 2 && instagramOk && /^\S+@\S+\.\S+$/.test(draft.email.trim()) && draft.mensagem.trim().length >= 30 && (!bySubject || draft.disciplina !== "");

  // Serviço desligado, ou banco que ainda não recebeu a fila de candidaturas: avisa em vez de mostrar um formulário que falharia.
  if (!hasBackend || (servico.pronto && !servico.novo)) return <p id={id} className="mt-6 scroll-mt-24 font-sans text-sm text-ink-soft">{s.offline}</p>;

  async function send() {
    setState("sending");
    setError("");
    try {
      await rpc("voluntariar", { p: { nome: nomeCompleto, instagram, email: draft.email, papel: draft.papel, mensagem: draft.mensagem, site: draft.site, disciplina: bySubject ? draft.disciplina : "" } });
      setDraft(empty);
      setState("sent");
    } catch (failure) {
      setError(errorText(t, failure instanceof BackendError ? failure.code : "falha"));
      setState("idle");
    }
  }

  return (
    <section id={id} aria-labelledby={`${id}-titulo`} className="cartao-v no-print mt-10 scroll-mt-24 p-5 font-sans text-sm sm:p-7">
      <h2 id={`${id}-titulo`} className="font-serif text-2xl font-semibold">{s.title}</h2>
      <p className="mt-1 text-ink-soft">{s.lead}</p>
      {state === "sent" ? (
        <p role="status" className="mt-4 border-l-2 border-ok pl-4 text-base">{s.sent}</p>
      ) : (
        <form className="mt-4 space-y-4" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              {s.firstName}
              <input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} required minLength={2} maxLength={60} autoComplete="given-name" className={field} />
            </label>
            <label className="block">
              {s.lastName}
              <input value={draft.sobrenome} onChange={(e) => setDraft({ ...draft, sobrenome: e.target.value })} required minLength={2} maxLength={60} autoComplete="family-name" className={field} />
            </label>
            <label className="block">
              {s.instagram}
              <span className="mt-1 flex border-2 border-ink bg-folha">
                <span aria-hidden className="border-r-2 border-ink px-2.5 py-2 font-mono text-ink-soft">@</span>
                <input value={draft.instagram} onChange={(e) => setDraft({ ...draft, instagram: e.target.value })} maxLength={80} autoComplete="off" inputMode="url" placeholder="usuario" className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none" />
              </span>
              <span className={`mt-1 block ${instagramOk ? "text-ink-soft" : "text-oxblood"}`}>{instagramOk ? s.instagramHint : s.instagramInvalid}</span>
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
            <input tabIndex={-1} aria-hidden autoComplete="off" value={draft.site} onChange={(e) => setDraft({ ...draft, site: e.target.value })} />
          </label>
          <button type="submit" disabled={!ready || state === "sending"} className="botao botao-prelo">
            {s.send}
          </button>
          <p role="alert" className="min-h-5 text-oxblood">{error}</p>
          <p className="text-ink-soft">{s.privacy}</p>
        </form>
      )}
    </section>
  );
}

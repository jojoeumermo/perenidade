// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
"use client";

import { useEffect, useState } from "react";
import { htmlLang } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { L, useI18n } from "./I18n";

interface Request {
  id: string;
  disciplina: string;
  assunto: string;
  status: "aberto" | "em_atendimento" | "atendido" | "cancelado";
  nota: string;
  criado_em: string;
}

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const empty = { disciplina: "", assunto: "", duvida: "", email: "" };

/** Pedido de aula de reforço: a pessoa escreve a dúvida e alguém da equipe responde por e-mail. */
export function Tutoring({ s }: { s: Dict["tutoring"] }) {
  const { lang, t } = useI18n();
  const me = useMe();
  const [form, setForm] = useState(empty);
  const [list, setList] = useState<Request[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const logged = me.status === "in";
  const date = new Intl.DateTimeFormat(htmlLang[lang]);

  useEffect(() => {
    if (!logged) return;
    let cancelled = false;
    rpc<Request[]>("reforco_meus")
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [logged, tick]);

  if (!hasBackend) return <p className="mt-10 text-lg text-ink-soft">{s.offline}</p>;

  async function run(fn: string, args: Record<string, unknown>, done: string) {
    setBusy(true);
    setMessage("");
    try {
      await rpc(fn, args);
      setMessage(done);
      setTick((value) => value + 1);
      return true;
    } catch (error) {
      setMessage(errorText(t, error instanceof BackendError ? error.code : "falha"));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  return (
    <div className="mt-8 font-sans text-sm">
      {logged ? (
        <form
          className="max-w-2xl space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("reforco_pedir", { p: form }, s.sent)) setForm({ ...empty, email: form.email });
          }}
        >
          <label className="block">
            {s.discipline}
            <select value={form.disciplina} onChange={set("disciplina")} required className={field}>
              <option value="">{s.choose}</option>
              {areaSlugs.map((slug) => (
                <option key={slug} value={slug}>
                  {t.areas[slug][0]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            {s.subject}
            <input value={form.assunto} onChange={set("assunto")} required minLength={4} maxLength={140} className={field} />
          </label>
          <label className="block">
            {s.question}
            <textarea value={form.duvida} onChange={set("duvida")} required minLength={20} maxLength={3000} rows={6} className={field} />
          </label>
          <label className="block">
            {s.email}
            <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" maxLength={200} className={field} />
            <span className="mt-1 block text-ink-soft">{s.emailHint}</span>
          </label>
          <button type="submit" disabled={busy} className="cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
            {s.send}
          </button>
        </form>
      ) : (
        <p className="text-lg">
          <L href="/entrar" className="underline hover:text-oxblood">
            {s.signIn}
          </L>
        </p>
      )}
      <p role="status" className="mt-3 min-h-5 text-oxblood">
        {message}
      </p>

      {list.length > 0 && (
        <section className="mt-8">
          <h2 className="font-serif text-2xl font-semibold">{s.mine}</h2>
          <ul className="mt-3 divide-y divide-rule border-y border-rule">
            {list.map((item) => (
              <li key={item.id} className="py-3">
                <p className="font-serif text-xl font-semibold">{item.assunto}</p>
                <p className="text-ink-soft">
                  {t.areas[item.disciplina as keyof typeof t.areas]?.[0] ?? item.disciplina} · {date.format(new Date(item.criado_em))} · {s.status[item.status]}
                </p>
                {item.nota && <p className="mt-1">{item.nota}</p>}
                {(item.status === "aberto" || item.status === "em_atendimento") && (
                  <button type="button" disabled={busy} className="mt-1 cursor-pointer underline hover:text-oxblood" onClick={() => run("reforco_cancelar", { p_id: item.id }, s.cancelled)}>
                    {s.cancel}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

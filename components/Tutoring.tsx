// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import synonyms from "@/content/busca.json";
import { htmlLang, localePath } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, hasBackend, rpc, useAssistantOn, useMe } from "@/lib/backend";
import { buildSearch, type SearchEntry } from "@/lib/search";
import { Assistente } from "./Assistente";
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
// "site" é um campo-isca: gente não vê, robô preenche, e o pedido é descartado sem aviso.
const empty = { disciplina: "", assunto: "", duvida: "", email: "", site: "" };
/** O que vale sugerir para quem está com dúvida: aulas, trilhas, verbetes do glossário e obras do acervo. */
const SUGERIVEIS = new Set(["aula", "trilha", "verbete", "obra"]);

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
  const assistente = useAssistantOn();
  const [indice, setIndice] = useState<SearchEntry[] | null>(null);
  const [escrevendo, setEscrevendo] = useState(false);

  // Veio de "Não entendi este trecho" numa aula: disciplina, assunto e o trecho já entram no formulário.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    // Veio da Folha de redação: o texto foi deixado na aba (sem passar pelo endereço) para um voluntário corrigir.
    if (p.get("redacao") === "1") {
      let redacao = "";
      try {
        redacao = sessionStorage.getItem("lucia:redacao-para-correcao") ?? "";
        sessionStorage.removeItem("lucia:redacao-para-correcao");
      } catch {
        // sem armazenamento: a pessoa cola o texto
      }
      if (redacao.trim()) {
        void Promise.resolve().then(() =>
          setForm((f) => ({ ...f, disciplina: "enem", assunto: f.assunto || "Correção de redação do ENEM", duvida: `Peço a correção da minha redação (comentários pelas cinco competências, sem nota):\n\n${redacao}`.slice(0, 3000) })),
        );
      }
      return;
    }
    const trecho = (p.get("trecho") ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
    if (!trecho) return;
    const disciplina = p.get("disciplina") ?? "";
    const aula = /^\/[a-z0-9/-]{1,200}$/.test(p.get("aula") ?? "") ? (p.get("aula") as string) : "";
    void Promise.resolve().then(() =>
      setForm((f) => ({
        ...f,
        disciplina: (areaSlugs as readonly string[]).includes(disciplina) ? disciplina : f.disciplina,
        assunto: f.assunto || (p.get("assunto") ?? "").slice(0, 140),
        duvida: f.duvida || `“${trecho}”${aula ? ` (${location.origin}/${lang}${aula})` : ""}\n\n`,
      })),
    );
  }, [lang]);

  // Enquanto a pessoa escreve, o próprio site sugere aulas e verbetes, sem mandar nada para fora (é o índice da busca,
  // baixado só quando ela começa a escrever).
  useEffect(() => {
    if (!escrevendo) return;
    let cancelled = false;
    fetch(localePath(lang, "/indice.json"))
      .then((response) => (response.ok ? (response.json() as Promise<SearchEntry[]>) : null))
      .then((data) => {
        if (!cancelled) setIndice(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [escrevendo, lang]);
  const buscar = useMemo(() => (indice ? buildSearch(indice, synonyms) : null), [indice]);
  const consulta = useDeferredValue((form.assunto.trim() || form.duvida.trim().split(/\s+/).slice(0, 12).join(" ")).trim());
  const area = form.disciplina ? (t.areas[form.disciplina as keyof typeof t.areas]?.[0] ?? "") : "";
  // Quais disciplinas têm voluntário que passou pelo painel hoje (só a lista de disciplinas, sem nomes).
  const [disponiveis, setDisponiveis] = useState<string[]>([]);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<string[]>("reforco_disponibilidade")
      .then((lista) => {
        if (vivo && Array.isArray(lista)) setDisponiveis(lista);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  const sugestoes = useMemo(
    () => (buscar && consulta.length >= 4 ? buscar(consulta, 60).filter((hit) => SUGERIVEIS.has(hit.entry.kind) && (!area || !hit.entry.area || hit.entry.area === area)).slice(0, 5) : []),
    [buscar, consulta, area],
  );
  const kinds = t.search.kinds as Record<string, string>;

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

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => {
    if (key === "assunto" || key === "duvida") setEscrevendo(true);
    setForm({ ...form, [key]: e.target.value });
  };

  return (
    <div className="mt-8 font-sans text-sm">
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
                  {t.areas[slug][0]}{disponiveis.includes(slug) ? ` · ${t.lists.availableToday}` : ""}
                </option>
              ))}
            </select>
            {form.disciplina && disponiveis.length > 0 && !disponiveis.includes(form.disciplina) && <span className="mt-1 block text-xs text-ink-soft">{t.lists.mayTakeLonger}</span>}
          </label>
          <label className="block">
            {s.subject}
            <input value={form.assunto} onChange={set("assunto")} required minLength={4} maxLength={140} className={field} />
          </label>
          <label className="block">
            {s.question}
            <textarea value={form.duvida} onChange={set("duvida")} required minLength={20} maxLength={3000} rows={6} className={field} />
          </label>
          {sugestoes.length > 0 && (
            <section aria-labelledby="sugestoes-titulo" className="border-l-4 border-gold pl-4">
              <h2 id="sugestoes-titulo" className="font-semibold">{s.suggestTitle}</h2>
              <ul className="mt-2 space-y-1.5">
                {sugestoes.map((hit) => (
                  <li key={hit.entry.href}>
                    <span className="font-mono text-xs uppercase tracking-wider text-ink-soft">{kinds[hit.entry.kind] ?? hit.entry.kind}</span>{" "}
                    <L href={hit.entry.href} className="underline hover:text-oxblood">{hit.entry.title}</L>
                    {hit.entry.context && <span className="text-ink-soft"> · {hit.entry.context}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {assistente && (
            <Assistente
              s={s.assistant}
              disciplina={form.disciplina}
              pergunta={[form.assunto, form.duvida].map((parte) => parte.trim()).filter(Boolean).join("\n\n")}
              aulas={sugestoes.filter((hit) => hit.entry.kind !== "obra").map((hit) => ({ titulo: hit.entry.title, caminho: hit.entry.href }))}
            />
          )}
          <label className="block">
            {s.email}
            <input type="email" value={form.email} onChange={set("email")} required autoComplete="email" maxLength={200} className={field} />
            <span className="mt-1 block text-ink-soft">{s.emailHint}</span>
          </label>
          <p className="text-ink-soft">{s.textOnly}</p>
          <label className="sr-only" aria-hidden>
            Site
            <input tabIndex={-1} aria-hidden autoComplete="off" value={form.site} onChange={set("site")} />
          </label>
          <button type="submit" disabled={busy} className="cursor-pointer bg-ink px-6 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50">
            {s.send}
          </button>
      </form>
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

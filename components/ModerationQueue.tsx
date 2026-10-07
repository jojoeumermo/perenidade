"use client";

import { useEffect, useState } from "react";
import { fill, htmlLang } from "@/i18n/config";
import type { Dict } from "@/i18n/pt";
import { repoApi, repoUrl } from "@/lib/site";
import { useI18n } from "./I18n";

// Lê só dados públicos da API do GitHub, sem chave nem login.
// Aprovar ou recusar acontece no GitHub, que é quem confere a permissão de cada pessoa.

interface ApiItem {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  draft?: boolean;
  user: { login: string } | null;
  pull_request?: unknown;
}

type State = { status: "loading" } | { status: "error"; code: number } | { status: "ready"; pulls: ApiItem[]; reports: ApiItem[] };

async function load(path: string): Promise<ApiItem[]> {
  const response = await fetch(`${repoApi}${path}`, { headers: { Accept: "application/vnd.github+json" } });
  if (!response.ok) throw new Error(String(response.status));
  return (await response.json()) as ApiItem[];
}

interface QueueProps {
  title: string;
  empty: string;
  items: ApiItem[];
  action: (item: ApiItem) => [string, string];
  m: Dict["moderation"];
  locale: string;
}

function Queue({ title, empty, items, action, m, locale }: QueueProps) {
  return (
    <section className="mt-12">
      <h2 className="border-b border-rule pb-3 text-3xl font-semibold">
        {title} <span className="font-mono text-base text-gold">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="mt-5 text-lg text-ink-soft">{empty}</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full border-collapse font-sans text-sm">
            <thead>
              <tr className="text-left font-mono text-xs uppercase tracking-widest text-gold">
                <th className="py-2 pr-4 font-normal">{m.colTitle}</th>
                <th className="py-2 pr-4 font-normal">{m.colAuthor}</th>
                <th className="py-2 pr-4 font-normal">{m.colDate}</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">{m.colAction}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const [label, href] = action(item);
                return (
                  <tr key={item.number} className="border-t border-rule">
                    <td className="py-3 pr-4">
                      <span className="font-mono text-ink-soft">#{item.number}</span> {item.title}
                      {item.draft && <span className="ml-2 font-mono text-xs text-ink-soft">({m.draft})</span>}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{item.user?.login ?? "?"}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{new Date(item.created_at).toLocaleDateString(locale)}</td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <a href={href} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
                        {label} ↗
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export function ModerationQueue() {
  const { lang, t } = useI18n();
  const m = t.moderation;
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([load("/pulls?state=open&per_page=50"), load("/issues?state=open&labels=denuncia&per_page=50")])
      .then(([pulls, issues]) => {
        if (!cancelled) setState({ status: "ready", pulls, reports: issues.filter((issue) => !issue.pull_request) });
      })
      .catch((error: unknown) => {
        // Código 0: a consulta nem chegou ao GitHub (sem conexão).
        if (!cancelled) setState({ status: "error", code: error instanceof Error ? Number(error.message) || 0 : 0 });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p role="status" className="mt-12 font-mono text-xs text-ink-soft">{m.loading}</p>;
  }
  if (state.status === "error") {
    const reason =
      state.code === 404
        ? m.private
        : state.code === 403 || state.code === 429
          ? m.limited
          : state.code === 0
            ? m.offline
            : fill(m.error, { code: state.code });
    return (
      <p role="alert" className="mt-12 border-l-2 border-oxblood pl-4 font-sans text-sm">
        {m.failed} {reason}{" "}
        <a href={`${repoUrl}/pulls`} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
          {m.seeOnGitHub} ↗
        </a>
      </p>
    );
  }

  const locale = htmlLang[lang];
  return (
    <>
      <Queue m={m} locale={locale} title={m.pulls} empty={m.noPulls} items={state.pulls} action={(item) => [m.review, `${item.html_url}/files`]} />
      <Queue m={m} locale={locale} title={m.reports} empty={m.noReports} items={state.reports} action={(item) => [m.open, item.html_url]} />
    </>
  );
}

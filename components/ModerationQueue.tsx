"use client";

import { useEffect, useState } from "react";
import { repoApi, repoUrl } from "@/lib/site";

// Lê só dados públicos da API do GitHub, sem chave nem login.
// Aprovar ou recusar acontece no GitHub, que é quem confere a permissão de cada pessoa.

interface Item {
  number: number;
  title: string;
  url: string;
  author: string;
  date: string;
  draft: boolean;
}

interface ApiItem {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  draft?: boolean;
  user: { login: string } | null;
  pull_request?: unknown;
}

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; pulls: Item[]; reports: Item[] };

async function load(path: string): Promise<ApiItem[]> {
  const response = await fetch(`${repoApi}${path}`, { headers: { Accept: "application/vnd.github+json" } });
  if (response.status === 403 || response.status === 429) {
    throw new Error("O GitHub limitou as consultas deste endereço por alguns minutos.");
  }
  if (response.status === 404) {
    throw new Error("O repositório do acervo ainda não está público, então a fila não pode ser exibida aqui.");
  }
  if (!response.ok) throw new Error(`O GitHub respondeu com o erro ${response.status}.`);
  return (await response.json()) as ApiItem[];
}

const toItem = (item: ApiItem): Item => ({
  number: item.number,
  title: item.title,
  url: item.html_url,
  author: item.user?.login ?? "desconhecido",
  date: new Date(item.created_at).toLocaleDateString("pt-BR"),
  draft: item.draft === true,
});

function Queue({ title, empty, items, action }: { title: string; empty: string; items: Item[]; action: (item: Item) => [string, string] }) {
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
                <th className="py-2 pr-4 font-normal">Título</th>
                <th className="py-2 pr-4 font-normal">Autor</th>
                <th className="py-2 pr-4 font-normal">Data</th>
                <th className="py-2 font-normal">
                  <span className="sr-only">Ação</span>
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
                      {item.draft && <span className="ml-2 font-mono text-xs text-ink-soft">(rascunho)</span>}
                    </td>
                    <td className="py-3 pr-4 whitespace-nowrap">{item.author}</td>
                    <td className="py-3 pr-4 whitespace-nowrap">{item.date}</td>
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
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    Promise.all([load("/pulls?state=open&per_page=50"), load("/issues?state=open&labels=denuncia&per_page=50")])
      .then(([pulls, issues]) => {
        if (cancelled) return;
        setState({
          status: "ready",
          pulls: pulls.map(toItem),
          reports: issues.filter((issue) => !issue.pull_request).map(toItem),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ status: "error", message: error instanceof Error ? error.message : "Falha de conexão." });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return <p role="status" className="mt-12 font-mono text-xs text-ink-soft">Consultando a fila no GitHub…</p>;
  }
  if (state.status === "error") {
    return (
      <p role="alert" className="mt-12 border-l-2 border-oxblood pl-4 font-sans text-sm">
        Não foi possível carregar a fila agora. {state.message}{" "}
        <a href={`${repoUrl}/pulls`} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">
          Ver direto no GitHub ↗
        </a>
      </p>
    );
  }
  return (
    <>
      <Queue
        title="Contribuições aguardando revisão"
        empty="Nenhuma contribuição na fila. A próxima pode ser a sua."
        items={state.pulls}
        action={(item) => ["Revisar mudanças", `${item.url}/files`]}
      />
      <Queue
        title="Denúncias em análise"
        empty="Nenhuma denúncia em aberto."
        items={state.reports}
        action={(item) => ["Abrir", item.url]}
      />
    </>
  );
}

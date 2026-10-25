// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { AVISO_CURTO, novoNaVitrine, type Profissional, registroCompleto } from "@/lib/saude";

/**
 * O cartão da Saúde Solidária na página inicial, entre a busca e as janelas. Mostra só quem entrou na vitrine nos
 * últimos DIAS_NA_INICIAL dias (os do arquivo e os do painel que cumprem todas as condições); passado o prazo, o
 * cartão some da inicial e a pessoa continua na vitrine. Some também se a chave geral estiver desligada.
 * Um profissional: o cartão dele em resumo. Vários: os nomes em ordem alfabética, sem rolagem automática nem ranking.
 * O contato só na vitrine, depois da tela de ciência.
 */
const abertaEm = typeof window === "undefined" ? 0 : Date.now();
const nunca = () => () => {};

export function FaixaDaSaude({ estaticos, href }: { estaticos: Profissional[]; href: string }) {
  const [doBanco, setDoBanco] = useState<Profissional[]>([]);
  const [desligada, setDesligada] = useState(false);
  // A hora de quem abriu a página (no servidor não há "agora": a data seria a do build).
  const agora = useSyncExternalStore(nunca, () => abertaEm, () => 0);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<{ desligada: boolean; perfis: Profissional[] }>("saude_vitrine")
      .then((r) => {
        if (!vivo) return;
        setDesligada(r.desligada);
        setDoBanco(r.perfis ?? []);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  // Quem já está no painel não aparece duas vezes (o cartão do arquivo sai quando o perfil do painel é publicado).
  const nomes = new Set(doBanco.map((p) => p.nome.toLowerCase()));
  // A conta do prazo só no navegador: a página é montada uma vez e a data do servidor ficaria parada.
  const todos = agora
    ? [...doBanco, ...estaticos.filter((p) => !nomes.has(p.nome.toLowerCase()))].filter((p) => novoNaVitrine(p, agora)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    : [];
  if (desligada || todos.length === 0) return null;
  const um = todos.length === 1 ? todos[0] : null;
  return (
    <section className="mx-auto max-w-[78rem] px-4 py-12 sm:px-6 lg:px-8 max-md:py-8">
      <div className="cartao-v grid gap-5 p-6 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
        <div>
          <p className="rotulo">Saúde Solidária</p>
          <h2 className="mt-1.5 text-[2rem] font-semibold leading-tight">Profissionais de saúde voluntários</h2>
          {um ? (
            <p className="mt-2 text-lg">
              <strong>{um.nome}</strong> · {um.profissao} · {registroCompleto(um)}{um.abordagem ? ` · ${um.abordagem}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-lg">{todos.map((p) => `${p.nome} (${p.profissao})`).join(" · ")}</p>
          )}
          <p className="mt-2 max-w-3xl font-sans text-sm text-ink-soft">{AVISO_CURTO}</p>
        </div>
        <Link href={href} className="botao botao-tinta">
          Ver {um ? "o cartão" : "os cartões"} →
        </Link>
      </div>
    </section>
  );
}

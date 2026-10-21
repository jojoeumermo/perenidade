// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { AVISO_CURTO, type Profissional, registroCompleto } from "@/lib/saude";

/**
 * A faixa da Saúde Solidária na página inicial. Aparece só quando há alguém apto na vitrine (os publicados pelo arquivo
 * e os do painel que cumprem todas as condições) e some se a chave geral estiver desligada. Um profissional: o cartão
 * dele em resumo. Vários: os nomes em ordem alfabética, sem rolagem automática nem ranking. O contato só na vitrine,
 * depois da tela de ciência.
 */
export function FaixaDaSaude({ estaticos, href }: { estaticos: Profissional[]; href: string }) {
  const [doBanco, setDoBanco] = useState<Profissional[]>([]);
  const [desligada, setDesligada] = useState(false);
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
  const todos = [...doBanco, ...estaticos.filter((p) => !nomes.has(p.nome.toLowerCase()))].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  if (desligada || todos.length === 0) return null;
  const um = todos.length === 1 ? todos[0] : null;
  return (
    <section className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid gap-5 border-[3px] border-ink bg-parchment-deep p-5 sm:grid-cols-[1fr_auto] sm:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-oxblood">Saúde Solidária</p>
          <h2 className="mt-1 text-3xl font-semibold">Profissionais de saúde voluntários</h2>
          {um ? (
            <p className="mt-2 text-lg">
              <strong>{um.nome}</strong> · {um.profissao} · {registroCompleto(um)}{um.abordagem ? ` · ${um.abordagem}` : ""}
            </p>
          ) : (
            <p className="mt-2 text-lg">{todos.map((p) => `${p.nome} (${p.profissao})`).join(" · ")}</p>
          )}
          <p className="mt-2 max-w-3xl font-sans text-sm text-ink-soft">{AVISO_CURTO}</p>
        </div>
        <Link href={href} className="inline-block border-2 border-ink bg-ink px-5 py-3 text-center font-sans font-semibold text-parchment hover:bg-oxblood">
          Ver {um ? "o cartão" : "os cartões"} →
        </Link>
      </div>
    </section>
  );
}

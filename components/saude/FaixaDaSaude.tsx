// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { NOME_VITRINE } from "@/lib/mural-saude";
import { AVISO_CURTO } from "@/lib/saude";

/**
 * O cartão do Mural de Saúde na página inicial, entre a busca e as janelas. Neutro e SEM nenhum nome: mostrar um
 * profissional sozinho na inicial seria indicação ou destaque, o que as normas de publicidade não permitem. Só leva
 * ao mural, onde todos aparecem em ordem alfabética. Some se a chave geral do mural estiver desligada.
 */
export function FaixaDaSaude({ href }: { href: string }) {
  const [desligada, setDesligada] = useState(false);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<{ desligada: boolean }>("saude_vitrine")
      .then((r) => {
        if (vivo) setDesligada(r.desligada);
      })
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, []);
  if (desligada) return null;
  return (
    <section className="mx-auto max-w-[78rem] px-4 py-12 sm:px-6 lg:px-8 max-md:py-8" lang="pt-BR">
      <div className="grid gap-5 border border-ink/40 bg-parchment-deep p-6 text-ink sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/70">{NOME_VITRINE}</p>
          <h2 className="mt-1.5 text-[2rem] font-semibold leading-tight">Mural de profissionais de saúde</h2>
          <p className="mt-2 max-w-3xl font-sans text-sm">{AVISO_CURTO}</p>
        </div>
        <Link href={href} className="border border-ink bg-ink px-5 py-3 text-center font-sans font-semibold text-parchment hover:bg-ink-soft">
          Ver o mural →
        </Link>
      </div>
    </section>
  );
}

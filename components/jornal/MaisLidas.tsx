// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";

export interface Chamada {
  slug: string;
  title: string;
  href: string;
}

/**
 * A caixa preta da capa. Com as contagens anônimas do banco (só totais por dia, sem identificar quem leu), mostra as
 * mais lidas dos últimos sete dias; sem elas, ou enquanto nada foi lido, mostra as matérias mais novas e diz isso.
 */
export function MaisLidas({ recentes, todas, titulo, tituloSemContagem }: { recentes: Chamada[]; todas: Chamada[]; titulo: string; tituloSemContagem: string }) {
  const [lidas, setLidas] = useState<Chamada[] | null>(null);
  useEffect(() => {
    if (!hasBackend) return;
    let vivo = true;
    rpc<{ slug: string; total: number }[]>("jornal_mais_lidas")
      .then((lista) => {
        const achadas = (lista ?? []).map((l) => todas.find((a) => a.slug === l.slug)).filter((a): a is Chamada => Boolean(a)).slice(0, 3);
        if (vivo && achadas.length >= 2) setLidas(achadas);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [todas]);
  const lista = lidas ?? recentes;
  if (lista.length === 0) return null;
  return (
    <section className="cartao-preto p-5">
      <p className="font-mono text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#e0837a]">{lidas ? titulo : tituloSemContagem}</p>
      <ol className="mt-3 flex flex-col gap-3">
        {lista.map((a, i) => (
          <li key={a.slug} className="flex gap-3">
            <span aria-hidden className="font-serif text-3xl font-bold leading-[0.9] text-[#e0837a]">
              {i + 1}
            </span>
            <Link href={a.href} className="font-serif text-lg leading-tight text-[#f4ecd8] hover:text-white hover:underline">
              {a.title}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Conta uma leitura da matéria (só o total do dia, sem identificar ninguém), uma vez por aparelho e por dia. */
export function ContarLeitura({ slug }: { slug: string }) {
  useEffect(() => {
    if (!hasBackend) return;
    const chave = `lucia:leu:${slug}`;
    const hoje = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(chave) === hoje) return;
      localStorage.setItem(chave, hoje);
    } catch {
      // sem armazenamento: conta assim mesmo
    }
    // Só conta quem ficou na página: quem abre e fecha na hora não leu.
    const espera = window.setTimeout(() => void rpc("contar", { p_tipo: "jornal_leu", p_alvo: slug }).catch(() => {}), 20_000);
    return () => window.clearTimeout(espera);
  }, [slug]);
  return null;
}

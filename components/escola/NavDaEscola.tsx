// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import { abertaNaFaixa, FAIXA_DA_ESCOLA } from "@/lib/escola/rotas";
import type { TextosDaBase } from "@/lib/escola/textos";
import "@/styles/escola-base.css";

/**
 * A faixa de links da Escola, logo abaixo do cabeçalho do site: Entrada, Quem foi Lúcia Maria, Cursos, Matrícula,
 * Calendário, Campus, Turmas, Assistente e Caderneta (lib/escola/rotas.ts). A lista fica centrada no mesmo eixo do
 * conteúdo (as páginas da Escola são colunas centradas); quando não cabe (no celular), rola de lado dentro de si, sem
 * empurrar a página, e o link da página aberta é trazido para a vista.
 */
export function NavDaEscola({ lang, s }: { lang: Locale; s: TextosDaBase["nav"] }) {
  const pathname = usePathname();
  const semIdioma = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const aberta = abertaNaFaixa(semIdioma);
  const faixa = useRef<HTMLElement>(null);

  // Só a faixa rola (scrollLeft): scrollIntoView poderia mexer na rolagem da página também.
  useEffect(() => {
    const nav = faixa.current;
    const atual = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !atual || nav.scrollWidth <= nav.clientWidth) return;
    nav.scrollLeft = Math.max(0, atual.offsetLeft - (nav.clientWidth - atual.offsetWidth) / 2);
  }, [aberta]);

  return (
    <nav ref={faixa} aria-label={s.rotulo} className="faixa-da-escola no-print border-b border-rule font-sans text-sm" data-faixa-da-escola="">
      <ul>
        {FAIXA_DA_ESCOLA.map((r) => (
          <li key={r.chave}>
            <Link href={localePath(lang, r.caminho)} aria-current={aberta === r.chave ? "page" : undefined} className="text-ink-soft hover:text-oxblood aria-[current=page]:text-ink">
              {s[r.chave as keyof TextosDaBase["nav"]]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { usePathname } from "next/navigation";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import { abertaNaFaixa, FAIXA_DA_ESCOLA } from "@/lib/escola/rotas";
import type { TextosDaBase } from "@/lib/escola/textos";
import "@/styles/escola-base.css";

/**
 * A faixa de links da Escola, logo abaixo do cabeçalho do site: Entrada, Quem foi Lúcia Maria, Cursos, Matrícula,
 * Calendário, Campus, Turmas, Acompanhante e Caderneta (lib/escola/rotas.ts). No celular ela rola de lado dentro de si,
 * sem empurrar a página.
 */
export function NavDaEscola({ lang, s }: { lang: Locale; s: TextosDaBase["nav"] }) {
  const pathname = usePathname();
  const semIdioma = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
  const aberta = abertaNaFaixa(semIdioma);
  return (
    <nav aria-label={s.rotulo} className="faixa-da-escola no-print border-b border-rule font-sans text-sm">
      <ul className="mx-auto max-w-4xl px-2">
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

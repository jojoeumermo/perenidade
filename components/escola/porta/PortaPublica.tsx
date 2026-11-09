// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { FaixaDeCores } from "../casca/FaixaDeCores";

/**
 * A moldura das páginas abertas da Escola (o chamado de militantes, o manifesto e o entrar) para quem ainda não é
 * militante: a faixa de cores e a cabeça da porta vermelha, e o conteúdo no escuro da Escola (as cores do site trocadas
 * pelas da Escola em .ef-conteudo, styles/escola-formacao.css). Antes, essas páginas abriam no papel claro do site, com o
 * cabeçalho do instituto, e pareciam ter saído da Escola.
 */
export function PortaPublica({ lang, t, caminho, children }: { lang: Locale; t: TextosDaFormacaoBase["porta"]; caminho: string; children: React.ReactNode }) {
  const noEntrar = /\/escola\/entrar\/?$/.test(caminho);
  return (
    <div className="ef-porta ef-porta-publica" data-escola-formacao="" data-porta-da-escola="publica">
      <FaixaDeCores />
      <header className="ef-porta-cabeca">
        <Link href={localePath(lang, "/")} className="ef-porta-instituto">
          {t.instituto}
        </Link>
        <span aria-hidden className="ef-porta-barra">
          /
        </span>
        <Link href={localePath(lang, "/escola")} className="ef-porta-escola">
          {t.escola}
        </Link>
        {!noEntrar && (
          <Link href={localePath(lang, "/escola/entrar?volta=/escola")} className="ef-porta-entrar" data-porta-entrar="">
            {t.entrar}
          </Link>
        )}
      </header>
      <div className="ef-conteudo ef-porta-publica-corpo">{children}</div>
    </div>
  );
}

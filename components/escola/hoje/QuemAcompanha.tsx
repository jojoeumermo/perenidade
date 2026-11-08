// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import type { EscolaEuDentro } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";

/**
 * Quem acompanha a formação (prancha Hoje): vem de escola_eu, pelo codinome da Alumia (nunca o nome civil). A F4 é quem
 * indica (escola_acompanhar). "Mandar mensagem" abre a conversa na Alumia pelo @ (que some se a pessoa estiver invisível).
 */
export function QuemAcompanha({ lang, t, eu }: { lang: Locale; t: TextosDaFormacaoBase["hoje"]; eu: EscolaEuDentro }) {
  const a = t.acompanha;
  const quem = eu.acompanha;
  return (
    <section aria-labelledby="ef-acompanha" className="ef-cartao ef-acompanha ef-o-acompanha">
      <h2 id="ef-acompanha" className="ef-t">
        {a.titulo}
      </h2>
      {quem ? (
        <>
          <p>{preencher(a.texto, { nome: quem.codinome ?? a.alguem })}</p>
          {quem.handle && (
            <Link href={localePath(lang, `/comunidade/conversas?com=${encodeURIComponent(quem.handle)}`)} className="ef-botao-linha">
              {a.mensagem}
            </Link>
          )}
        </>
      ) : (
        <p className="ef-vazio">{a.ninguem}</p>
      )}
    </section>
  );
}

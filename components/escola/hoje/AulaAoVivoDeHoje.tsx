// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { useDaEscola } from "@/lib/escola/acesso";
import { caminhoDaSalaAoVivo } from "@/lib/escola/contratos";
import { preencher } from "@/lib/escola/textos";
import { horaCurta } from "./tempo";

/**
 * As aulas ao vivo da Escola marcadas para hoje (F3, escola_aulas_hoje). Lista vazia se esconde: sem aula hoje, ou com
 * a função ainda fora do banco, o bloco não aparece (a prancha Hoje não tem lugar fixo para ele).
 */
export function AulaAoVivoDeHoje({ lang, t }: { lang: Locale; t: TextosDaFormacaoBase["hoje"] }) {
  const lido = useDaEscola("escola_aulas_hoje");
  const aulas = lido?.ok ? (lido.dados?.hoje ?? []).filter((a) => a.status !== "encerrada") : [];
  if (aulas.length === 0) return null;
  return (
    <section aria-labelledby="ef-aovivo" className="ef-cartao ef-aovivo ef-o-aovivo">
      <h2 id="ef-aovivo" className="ef-t">
        {t.aoVivo.titulo}
      </h2>
      <ul>
        {aulas.map((a) => (
          <li key={a.id}>
            <strong>{a.titulo}</strong> · {a.status === "ao_vivo" ? t.aoVivo.agora : preencher(t.aoVivo.as, { hora: horaCurta(lang, a.inicio) })}
            <br />
            <Link href={localePath(lang, caminhoDaSalaAoVivo(a.id))} className="ef-botao-linha">
              {t.aoVivo.entrar}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

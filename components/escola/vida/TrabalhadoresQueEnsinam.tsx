// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { type Locale, localePath } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import type { TrabalhadorQueEnsina } from "@/lib/escola/vida";

/** Cartões de pessoas do Memorial ligadas a uma aula: o link do Memorial, o da aula e a fonte. Sem foto e sem rastreio. */
export function TrabalhadoresQueEnsinam({ itens, s, selo, lang }: { itens: TrabalhadorQueEnsina[]; s: TextosDaVida["vozes"]["ensinam"]; selo: string; lang: Locale }) {
  return (
    <ul className="vida-grade" data-trabalhadores-que-ensinam="">
      {itens.map((t) => (
        <li key={t.memorial} className="vida-cartao">
          <h3>{t.nome}</h3>
          <p className="vida-nota" lang="pt">
            {t.tema}
          </p>
          <p lang="pt">
            {t.texto} {t.revisao ? <span className="vida-selo">{selo}</span> : null}
          </p>
          <div className="vida-botoes">
            <Link href={localePath(lang, `/memorial/${t.memorial}`)} className="vida-botao-claro">
              {s.memorial}
            </Link>
            {t.aula ? (
              <Link href={localePath(lang, `/trilhas/${t.aula}`)} className="vida-botao-claro">
                {s.aula}
              </Link>
            ) : null}
          </div>
          <p className="vida-nota">
            {s.fonte}: <Link href={localePath(lang, t.fonte)} className="underline hover:text-oxblood">{t.fonte}</Link>
          </p>
        </li>
      ))}
    </ul>
  );
}
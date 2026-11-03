// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaBase } from "@/lib/escola/textos";

/**
 * O primeiro item da entrada da Escola: o cartão que leva a "Quem foi Lúcia Maria". Sem foto e sem texto sobre ela
 * aqui: o texto é o que a coordenação mandar, e mora só na página dele.
 */
export function CartaoLuciaMaria({ lang, s }: { lang: Locale; s: TextosDaBase["cartao"] }) {
  return (
    <Link
      href={localePath(lang, "/escola/quem-foi-lucia-maria")}
      data-cartao-lucia-maria=""
      className="group mt-8 block border-2 border-ink bg-parchment-deep p-5 hover:border-oxblood sm:p-6"
    >
      <p className="rotulo">{s.olho}</p>
      <h2 className="mt-2 text-3xl font-semibold group-hover:text-oxblood">{s.titulo}</h2>
      <p className="mt-2 font-sans text-ink-soft">{s.texto}</p>
      <p className="mt-4 inline-flex min-h-11 items-center font-sans font-semibold text-oxblood">{s.ler} →</p>
    </Link>
  );
}

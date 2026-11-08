// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { TELAS_DA_ESCOLA } from "@/lib/escola/contratos";

export interface LinkDoMaterial {
  chave: "zine" | "biblioteca" | "retorno" | "kit" | "aberta";
  href: string;
}

/**
 * O material do caderno (prancha Caderno): a zine da aula de agora para imprimir, a leitura complementar na Biblioteca
 * (F6), o retorno por competência (a prova da trilha, sem nota, quando a trilha tem questões bastantes), o kit de núcleo
 * e a mesma trilha aberta em /trilhas. Só aparecem os links que existem.
 */
export function MaterialDoCaderno({ lang, links, t }: { lang: Locale; links: LinkDoMaterial[]; t: TextosDaFormacao["caderno"]["material"] }) {
  return (
    <section aria-labelledby="eff-material" className="eff-cartao eff-material">
      <h2 id="eff-material" className="ef-t">
        {t.titulo}
      </h2>
      <ul>
        {links.map((l) => (
          <li key={l.chave}>
            <Link href={localePath(lang, l.href)}>{t[l.chave]}</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os links de um caderno de trilha (a zine é a da aula de agora, ou da primeira pronta). */
export function linksDaTrilha(trilha: string, primeira: string | null, temProva: boolean): LinkDoMaterial[] {
  return [
    ...(primeira ? [{ chave: "zine" as const, href: `/trilhas/${primeira}/zine` }] : []),
    { chave: "biblioteca", href: TELAS_DA_ESCOLA.biblioteca },
    ...(temProva ? [{ chave: "retorno" as const, href: `/trilhas/${trilha}/prova` }] : []),
    { chave: "kit", href: `/trilhas/${trilha}/nucleo` },
    { chave: "aberta", href: `/trilhas/${trilha}` },
  ];
}

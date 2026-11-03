// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { type Locale, localePath } from "@/i18n/config";
import type { TextosDaOrganizacao } from "@/i18n/escola/organizacao";
import { territorios } from "@/lib/territorios";

type S = TextosDaOrganizacao["nucleo"];

const PASSOS = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;

/**
 * "Faça a assembleia no seu núcleo" (E4-12): seis passos, os links para o mapa de núcleos e para os Territórios e, para
 * cada trilha da pauta, os Territórios que a citam em `trilhas` (dado que já existe). Não pede nem guarda nome de núcleo,
 * cidade ou lista de participantes. Texto em revisão.
 */
export function RoteiroDoNucleo({ s, lang, trilhas }: { s: S; lang: Locale; trilhas: { slug: string; titulo: string }[] }) {
  return (
    <div data-roteiro-nucleo="">
      <p className="org-nota">{s.lead}</p>
      <ol className="org-roteiro">
        {PASSOS.map((p) => (
          <li key={p}>{s[p]}</li>
        ))}
      </ol>
      <p className="org-nota">{s.revisao}</p>
      <p className="org-nota">{s.nada}</p>
      <div className="org-botoes">
        <Link href={localePath(lang, "/nucleos")} className="botao">
          {s.mapa}
        </Link>
        <Link href={localePath(lang, "/territorios")} className="botao">
          {s.territorios}
        </Link>
      </div>
      {trilhas.length > 0 && (
        <ul className="org-territorios">
          {trilhas.map((t) => {
            const achados = territorios.filter((x) => x.trilhas.includes(t.slug));
            return (
              <li key={t.slug} data-roteiro-trilha={t.slug}>
                <p className="org-candidata-nome" lang="pt">
                  {t.titulo}
                </p>
                {achados.length ? (
                  <p className="org-nota">
                    {s.territoriosDaTrilha}{" "}
                    {achados.map((x, i) => (
                      <span key={x.slug}>
                        {i > 0 && ", "}
                        <Link href={localePath(lang, `/territorios/${x.slug}`)} className="underline hover:text-oxblood">
                          {x.nome}
                        </Link>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="org-nota">{s.semTerritorio}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

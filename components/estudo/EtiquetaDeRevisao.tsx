// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { fill, htmlLang, type Locale } from "@/i18n/config";
import type { Revisao } from "@/lib/modelo-de-aula";
import type { TextosDoEstudo } from "@/lib/textos-estudo";

type S = TextosDoEstudo["revisao"];

const dataDe = (lang: Locale, dia: string) => new Intl.DateTimeFormat(htmlLang[lang], { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${dia}T12:00:00Z`));
const quem = (r: Revisao) => (r.nome ? `${r.nome} (${r.funcao})` : r.funcao);

/**
 * A etiqueta de revisão da aula (recurso "revisoes"): "Em revisão" até alguém registrar a revisão no cabeçalho; depois,
 * "Revisada por [função] em [data]", com o histórico. Nada recebe "revisada" sozinho. Sem JavaScript no navegador.
 */
export function EtiquetaDeRevisao({ revisoes, aprovada, lang, s, corrigir, como }: { revisoes: Revisao[]; aprovada: boolean; lang: Locale; s: S; corrigir: string; como?: string }) {
  const ultima = revisoes[0];
  return (
    <div className="no-print mt-6 border-l-2 border-gold pl-4 font-sans text-sm text-ink-soft">
      {ultima ? (
        <p>
          <strong className="font-semibold text-ok">✓ {fill(s.revisadaPor, { quem: quem(ultima), data: dataDe(lang, ultima.data) })}</strong>
        </p>
      ) : aprovada ? (
        <p>
          <strong className="font-semibold text-ink">{s.aprovada}</strong> {s.aprovadaDetalhe}
        </p>
      ) : (
        <p>
          <strong className="font-semibold text-gold">{s.emRevisao}</strong> {s.emRevisaoDetalhe}
        </p>
      )}
      <p className="mt-1">
        <Link href={corrigir} className="underline hover:text-oxblood">
          {s.sugira}
        </Link>
        {como && (
          <>
            {" · "}
            <Link href={como} className="underline hover:text-oxblood">
              {s.como}
            </Link>
          </>
        )}
      </p>
      {revisoes.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer">{fill(s.historico, { n: revisoes.length })}</summary>
          <ol className="mt-2 space-y-1">
            {revisoes.map((r, i) => (
              <li key={`${r.data}-${i}`}>
                {dataDe(lang, r.data)} · {quem(r)}
                {r.nota && <span className="block pl-4 text-xs">{r.nota}</span>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/** Os créditos de revisão, para o rodapé da aula, ao lado de "Por [autores]". */
export function creditosDeRevisao(revisoes: Revisao[], s: S): string {
  if (!revisoes.length) return "";
  const nomes = [...new Set(revisoes.map(quem))];
  return fill(s.creditos, { lista: nomes.join(", ") });
}

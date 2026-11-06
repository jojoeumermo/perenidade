// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { Metadata } from "next";
import Link from "@/components/Link";
import { CabecaDoVale } from "@/components/vale-o-escrito/Cabeca";
import { localePath } from "@/i18n/config";
import { loadLang } from "@/i18n";
import { paginaMeta } from "@/lib/seo";
import { SITUACOES } from "@/lib/vale-o-escrito/tipos";
import { textosDoObservatorio } from "@/lib/vale-o-escrito/textos";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  return paginaMeta(lang, "/vale-o-escrito/sobre", s.sobre.titulo, s.sobre.lead);
}

/** Cada lei com o endereço do texto no planalto.gov.br (os artigos citados foram conferidos lá em 04/11/2026). */
const LEIS = [
  ["lgpd", "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm"],
  ["eca", "https://www.planalto.gov.br/ccivil_03/leis/l8069.htm"],
  ["direitoDeResposta", "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2015/lei/l13188.htm"],
  ["codigoPenal", "https://www.planalto.gov.br/ccivil_03/decreto-lei/del2848compilado.htm"],
  ["marcoCivil", "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2014/lei/l12965.htm"],
  ["lai", "https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2011/lei/l12527.htm"],
] as const;

/**
 * "Sobre o método": o que é e o que não é o observatório, as regras, a situação jurídica explicada, os dois níveis de
 * confiança, como corrigir, por que a curadoria é anônima e a base legal (LGPD arts. 4º, II, "a", 7º, 11 e 14; Lei 13.188/2015;
 * ECA arts. 17, 143 e 247; Código Penal arts. 138 a 140; Marco Civil; LAI). Só texto: não lê disco e não carrega nada pesado.
 */
export default async function SobreOValeOEscrito({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await loadLang(params);
  const s = textosDoObservatorio(lang);
  const o = s.sobre;
  const h2 = "mt-12 text-2xl font-semibold";
  return (
    <div className="ve-pagina ve-doc">
      <CabecaDoVale olho={o.olho} titulo={o.titulo} voltar={{ href: localePath(lang, "/vale-o-escrito"), texto: s.navegacao.inicio }}>
        {o.lead}
      </CabecaDoVale>

      <section aria-labelledby="metodo">
        <h2 id="metodo" className={h2}>{o.metodo.titulo}</h2>
        <p className="mt-3">{o.metodo.texto}</p>
        <p className="mt-3 border-l-4 border-ink pl-4">{s.entrada.linhaHonesta}</p>
      </section>

      <section aria-labelledby="regras">
        <h2 id="regras" className={h2}>{o.regras.titulo}</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-6">
          {(["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"] as const).map((r) => (
            <li key={r}>{o.regras[r]}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="situacao">
        <h2 id="situacao" className={h2}>{o.situacao.titulo}</h2>
        <p className="mt-3">{o.situacao.texto}</p>
        <dl className="mt-3 space-y-3">
          {SITUACOES.map((x) => (
            <div key={x}>
              <dt className="font-semibold">{s.situacao[x]}</dt>
              <dd>{o.situacao[x]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-ink-soft">{o.situacao.nota}</p>
        <p className="mt-3">{s.avisos.presuncao}</p>
      </section>

      <section aria-labelledby="confianca">
        <h2 id="confianca" className={h2}>{o.confianca.titulo}</h2>
        <p className="mt-3">{o.confianca.texto}</p>
        <ul className="mt-3 list-disc space-y-1 pl-6">
          <li><strong>{s.confianca.primaria}.</strong> {s.confianca.primariaExplica}</li>
          <li><strong>{s.confianca.reportado}.</strong> {s.confianca.reportadoExplica}</li>
        </ul>
      </section>

      <section aria-labelledby="corrigir">
        <h2 id="corrigir" className={h2}>{o.corrigir.titulo}</h2>
        <p className="mt-3">{o.corrigir.texto}</p>
        <p className="mt-3 flex flex-wrap gap-x-6 gap-y-2 font-sans">
          <Link className="underline" href={localePath(lang, "/vale-o-escrito/correcao")}>{s.navegacao.corrigir}</Link>
          <Link className="underline" href={localePath(lang, "/vale-o-escrito/enviar")}>{s.navegacao.enviar}</Link>
        </p>
      </section>

      <section aria-labelledby="anonima">
        <h2 id="anonima" className={h2}>{o.anonima.titulo}</h2>
        <p className="mt-3">{o.anonima.texto}</p>
        <p className="mt-3">{s.avisos.curadoriaAnonima}</p>
      </section>

      <section aria-labelledby="base">
        <h2 id="base" className={h2}>{o.base.titulo}</h2>
        <p className="mt-3 text-ink-soft">{o.base.intro}</p>
        <ul className="mt-3 space-y-3">
          {LEIS.map(([chave, href]) => (
            <li key={chave}>
              {o.base[chave]}{" "}
              <a className="underline" href={href} target="_blank" rel="noopener noreferrer" hrefLang="pt-BR">
                planalto.gov.br <span aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 border-l-4 border-ink pl-4">{o.base.aviso}</p>
      </section>

      <section aria-labelledby="fontes">
        <h2 id="fontes" className={h2}>{o.fontes.titulo}</h2>
        <p className="mt-3">{o.fontes.texto}</p>
        <p className="mt-3">{o.fontes.licencas}</p>
      </section>

      <section aria-labelledby="privacidade">
        <h2 id="privacidade" className={h2}>{o.privacidade.titulo}</h2>
        <p className="mt-3">{o.privacidade.texto}</p>
        <p className="mt-3 font-sans">
          <Link className="underline" href={localePath(lang, "/privacidade")}>{o.privacidade.titulo}</Link>
        </p>
      </section>
    </div>
  );
}

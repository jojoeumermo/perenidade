// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { PropsDaTelaDoPacote } from "../registro";
import { CabecaDaLei, CarregandoALei, NavDaLei, Rico } from "./base";
import { RelatarProblema } from "./RelatarProblema";
import { useTextosDaLei } from "./usarTextos";

/** A cor do ladrilho de cada grupo de perguntas (as cores da casa e das comunidades, só tokens). */
const CORES = ["var(--al-vermelho)", "var(--al-dourado)", "var(--al-com-1)", "var(--al-com-4)", "var(--al-com-2)"];

/**
 * A ajuda da Alumia (/alumia/ajuda): as perguntas que mais chegam, por assunto (entrar, segundo fator, como apareço, denunciar e
 * recorrer, sair e apagar), cada uma abrindo no próprio lugar. Abre sem conta. No fim (P5, A21): relatar um problema (só para quem está
 * dentro) e o pedido de não divulgar uma falha de segurança antes da correção, com o contato de /.well-known/security.txt.
 */
export default function TelaDaAjuda({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDaLei(lang);
  if (!t) return <CarregandoALei rotulo={s.estados.carregando} />;
  const a = t.ajuda;
  return (
    <article className="le-pagina">
      <CabecaDaLei lang={lang} t={t} titulo={a.titulo} chamada={a.chamada} />
      <NavDaLei lang={lang} t={t} aberta="ajuda" />
      <div className="le-faq">
        {a.grupos.map((grupo, i) => (
          <section key={grupo.titulo} className="le-faq-grupo" style={{ ["--cor" as string]: CORES[i % CORES.length] }} aria-labelledby={`le-faq-${i}`}>
            <h2 id={`le-faq-${i}`} className="al-cond">{grupo.titulo}</h2>
            {grupo.perguntas.map((q) => (
              <details key={q.p}>
                <summary>{q.p}</summary>
                <p><Rico lang={lang} texto={q.r} /></p>
              </details>
            ))}
          </section>
        ))}
      </div>
      <section className="le-faq-mais" aria-labelledby="le-faq-mais">
        <h2 id="le-faq-mais" className="al-cond">{a.mais}</h2>
        <p><Rico lang={lang} texto={t.comum.contato} /></p>
      </section>
      <RelatarProblema t={a.relatar} logado={situacao.logado && situacao.membro} />
      <section className="le-faq-mais" aria-labelledby="le-falhas">
        <h2 id="le-falhas" className="al-cond">{a.falhas.titulo}</h2>
        <p>{a.falhas.texto}</p>
        <p className="mt-2">
          <a href="/.well-known/security.txt" className="underline" rel="noopener">{a.falhas.link}</a>
        </p>
      </section>
    </article>
  );
}

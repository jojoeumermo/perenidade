// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post } from "@/lib/rede/tipos";
import { PostCompacto, useTextosAlumia3 } from "../../conversa/base3";
import { IconeVoltarAcervo } from "./base";
import { acervo } from "./cliente";
import { mesesPorAno, nomeDoMes } from "./regras";
import { erroDoAcervo, type TextosDoAcervo } from "./textos";
import type { MesDoArquivo } from "./tipos";

/**
 * O arquivo por mês da comunidade (L2-55): cada mês um ladrilho do ano, com o número de posts só a partir de 3 (abaixo, "poucos
 * posts", como a contagem da semana). Abrir um mês mostra os posts dele do primeiro ao último, em ordem de chegada.
 */
export function PorMes({ slug, lang, s, t, logado }: { slug: string; lang: string; s: TextosDaRede; t: TextosDoAcervo; logado: boolean }) {
  const t3 = useTextosAlumia3(lang);
  const [meses, setMeses] = useState<{ slug: string; itens: MesDoArquivo[] | null; erro: string } | null>(null);
  const [mes, setMes] = useState<string | null>(null);
  const [posts, setPosts] = useState<{ mes: string; itens: Post[]; proximo: string | null } | null>(null);
  const [erro, setErro] = useState("");
  const [buscando, setBuscando] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);
  const aoErro = useCallback((e: unknown) => setErro(erroDoAcervo(t, e)), [t]);

  useEffect(() => {
    let vivo = true;
    acervo
      .meses(slug)
      .then((r) => vivo && setMeses({ slug, itens: r.meses, erro: "" }))
      .catch((e) => vivo && setMeses({ slug, itens: null, erro: erroDoAcervo(t, e) }));
    return () => {
      vivo = false;
    };
  }, [slug, t]);

  const abrir = useCallback(
    async (m: string, cursor: string | null) => {
      setBuscando(true);
      setErro("");
      try {
        const r = await acervo.mes(slug, m, cursor);
        setPosts((antes) => ({ mes: m, itens: [...(cursor && antes?.mes === m ? antes.itens : []), ...r.itens], proximo: r.proximo }));
        if (!cursor) requestAnimationFrame(() => tituloRef.current?.focus());
      } catch (e) {
        aoErro(e);
      } finally {
        setBuscando(false);
      }
    },
    [slug, aoErro],
  );

  if (!meses || meses.slug !== slug) return <p role="status" className="acv-dica">{t.comum.carregando}</p>;
  if (!meses.itens) return <p role="alert" className="acv-aviso">{meses.erro}</p>;

  if (mes) {
    return (
      <section aria-busy={buscando}>
        <button type="button" className="acv-link acv-voltar" onClick={() => (setMes(null), setPosts(null))}>
          <IconeVoltarAcervo />
          {t.meses.voltar}
        </button>
        <h2 ref={tituloRef} tabIndex={-1} className="acv-cond" style={{ fontSize: "2rem" }}>{preencher(t.meses.doMes, { mes: nomeDoMes(mes, lang) })}</h2>
        {erro && <p role="alert" className="acv-aviso">{erro}</p>}
        {!posts || !t3 ? (
          <p role="status" className="acv-dica">{t.comum.carregando}</p>
        ) : posts.itens.length === 0 ? (
          <p className="acv-dica">{t.meses.vazio}</p>
        ) : (
          <ol className="acv-lista">
            {posts.itens.map((p) => (
              <li key={p.id} style={{ padding: "0.3rem 0" }}>
                <PostCompacto post={p} lang={lang} s={s} t={t3} logado={logado} aoErro={aoErro} />
              </li>
            ))}
          </ol>
        )}
        {posts?.proximo && (
          <div className="acv-botoes">
            <button type="button" className="acv-botao" disabled={buscando} onClick={() => void abrir(mes, posts.proximo)}>{t.meses.mais}</button>
          </div>
        )}
      </section>
    );
  }

  return (
    <section aria-labelledby="acv-meses">
      <h2 id="acv-meses" className="acv-cond" style={{ fontSize: "2rem" }}>{t.meses.titulo}</h2>
      <p className="acv-intro">{t.meses.intro}</p>
      {meses.itens.length === 0 ? (
        <p className="acv-dica">{t.meses.vazio}</p>
      ) : (
        <>
        {meses.itens.some((m) => m.posts !== null && m.posts >= 100) && (
          <p className="acv-dica acv-legenda"><span className="acv-legenda-cor" aria-hidden />{t.meses.legenda}</p>
        )}
        {
        mesesPorAno(meses.itens).map((ano) => (
          <div key={ano.ano} className="acv-ano">
            <h3 className="acv-cond">{ano.ano}</h3>
            <ul className="acv-meses">
              {ano.meses.map((m) => (
                <li key={m.mes}>
                  <button
                    type="button"
                    className="acv-mes"
                    data-cheio={m.posts !== null && m.posts >= 100 ? "sim" : undefined}
                    onClick={() => {
                      setMes(m.mes);
                      void abrir(m.mes, null);
                    }}
                  >
                    <span className="acv-cond">{nomeDoMes(m.mes, lang, false)}</span>
                    <small>{m.posts === null ? t.meses.poucos : preencher(t.meses.posts, { n: m.posts.toLocaleString(lang) })}</small>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        </>
      )}
    </section>
  );
}

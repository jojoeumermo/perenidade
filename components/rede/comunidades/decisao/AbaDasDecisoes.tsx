// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { decisao as cliente, type Decisao, type DecisoesDaComunidade } from "@/lib/rede/decisao/cliente";
import type { ContextoDoEncaixe } from "../../encaixes";
import { Botao } from "../../ui/Botao";
import { CartaoDaDecisao } from "./CartaoDaDecisao";
import { NovaDecisao } from "./NovaDecisao";
import { NumerosDaComunidade } from "./NumerosDaComunidade";
import { erroDaDecisao, useTextosDaDecisao } from "./textos";
import "./decisao.css";

/**
 * A aba "Decisões" da comunidade (onda 10, 10E; encaixe abasDaComunidade): as votações internas (abertas no alto, a que fecha antes
 * primeiro; depois as encerradas) e, só para quem modera, o botão de abrir votação e os números da comunidade. Quem não é da
 * comunidade vê só o convite para entrar (o banco devolve a lista vazia).
 */
export function AbaDasDecisoes({ lang, slug }: ContextoDoEncaixe & { slug: string }) {
  const td = useTextosDaDecisao(lang);
  const [estado, setEstado] = useState<{ slug: string; dado?: DecisoesDaComunidade; erro?: string } | null>(null);
  const [versao, setVersao] = useState(0);
  const [nova, setNova] = useState(false);
  const [aviso, setAviso] = useState("");
  const reler = useCallback(() => setVersao((n) => n + 1), []);

  useEffect(() => {
    if (!td) return;
    let vivo = true;
    cliente.lista(slug).then(
      (dado) => vivo && setEstado({ slug, dado }),
      (e) => vivo && setEstado({ slug, erro: erroDaDecisao(td, e) }),
    );
    return () => {
      vivo = false;
    };
  }, [slug, td, versao]);

  if (!td) return null;
  if (!estado || estado.slug !== slug) return <p className="d10 d10-nota d10-solto" role="status">{td.carregando}</p>;
  if (estado.erro || !estado.dado) {
    return (
      <div className="d10 d10-solto">
        <p className="d10-erro" role="alert">{estado.erro}</p>
        <Botao variante="contorno" tamanho="p" onClick={reler}>
          {td.tentar}
        </Botao>
      </div>
    );
  }
  const dado = estado.dado;
  const trocar = (d: Decisao) => setEstado((e) => (e?.dado ? { ...e, dado: { ...e.dado, decisoes: e.dado.decisoes.map((x) => (x.id === d.id ? d : x)) } } : e));
  const abertas = dado.decisoes.filter((d) => d.situacao === "aberta");
  const encerradas = dado.decisoes.filter((d) => d.situacao !== "aberta");
  const cartao = (d: Decisao) => <CartaoDaDecisao key={d.id} d={d} td={td} lang={lang} modero={dado.modero} aoMudar={trocar} aoReler={reler} />;

  return (
    <div className="d10">
      <header className="d10-cabeca">
        <div>
          <h2 className="d10-cond d10-titulo">{td.titulo}</h2>
          <p className="d10-lead">{td.lead}</p>
        </div>
        {dado.modero && !nova ? (
          <Botao onClick={() => (setNova(true), setAviso(""))} icone={<span className="d10-mais">+</span>}>
            {td.nova.botao}
          </Botao>
        ) : null}
      </header>
      {aviso ? (
        <p className="d10-ok" role="status">
          <span aria-hidden className="d10-ok-marca">✓</span> {aviso}
        </p>
      ) : null}

      <div className="d10-grade">
        <div className="d10-coluna">
          {nova ? (
            <NovaDecisao
              slug={slug}
              td={td}
              aoAbrir={(d) => {
                setNova(false);
                setAviso(td.nova.pronta);
                setEstado((e) => (e?.dado ? { ...e, dado: { ...e.dado, decisoes: [d, ...e.dado.decisoes] } } : e));
              }}
              aoDesistir={() => setNova(false)}
            />
          ) : null}
          {!dado.membro && !dado.modero ? (
            <p className="d10-vazio">{td.soMembros}</p>
          ) : dado.decisoes.length === 0 && !nova ? (
            <p className="d10-vazio">{dado.modero ? td.vazioMod : td.vazio}</p>
          ) : (
            <>
              {abertas.length > 0 ? (
                <section aria-label={td.abertas} className="d10-lista">
                  <h3 className="d10-cond d10-grupo-rotulo">{td.abertas}</h3>
                  {abertas.map(cartao)}
                </section>
              ) : null}
              {encerradas.length > 0 ? (
                <section aria-label={td.encerradas} className="d10-lista">
                  <h3 className="d10-cond d10-grupo-rotulo">{td.encerradas}</h3>
                  {encerradas.map(cartao)}
                </section>
              ) : null}
            </>
          )}
        </div>
        {dado.modero ? (
          <aside className="d10-coluna d10-coluna-lado">
            <NumerosDaComunidade slug={slug} td={td} lang={lang} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

export default AbaDasDecisoes;

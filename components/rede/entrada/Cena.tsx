// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { ReactNode } from "react";
import { Lampiao } from "@/components/rede/ui/Lampiao";
import type { FiguraDaEntrada } from "@/lib/rede/entrada/figuras";
import type { TextosDaEntrada } from "@/lib/rede/entrada/textos";
import { Parede } from "./Parede";
import { useParede } from "./useParede";

/**
 * A cena da entrada da Alumia, a mesma em todos os estados: a faixa tecida, a cabeça com o lampião (o logo da Alumia, como ele é)
 * e o "Voltar ao site", o chamado, a parede de ladrilhos com as silhuetas e o painel de quem chega, o cartão (o que muda: entrar,
 * pedir, em análise, segundo fator…), o "Como entrar" (só para quem ainda não tem sessão) e o pé com os créditos das imagens.
 * A parede gira (P5, A1: useParede.ts): os nomes embaixo dela e os créditos do pé são só das figuras que estão na tela agora.
 */
export function Cena({ t, figuras, site, organizacoes, comoEntrar = false, ocupado = false, children }: {
  t: TextosDaEntrada; figuras: FiguraDaEntrada[]; site: string; organizacoes?: string | null; comoEntrar?: boolean; ocupado?: boolean; children: ReactNode;
}) {
  const corte = t.p.tituloDestaque ? t.titulo.indexOf(t.p.tituloDestaque) : -1;
  const naTela = useParede(figuras);
  return (
    <div className="ale" data-alumia-entrada="">
      <div aria-hidden className="ale-faixa" />
      <div className="ale-moldura">
        <header className="ale-cabeca" aria-label={t.rotuloCabeca}>
          <span className="ale-marca">
            <Lampiao tamanho={42} />
            <span>
              <span className="ale-cond ale-marca-nome">Alumia</span>
              <span className="ale-marca-inst">{t.instituto}</span>
            </span>
          </span>
          <a className="ale-voltar" href={site}>
            {t.voltar}
          </a>
        </header>
        {/* O corpo da cena fica dentro do <main id="conteudo"> do site: um segundo <main> com o mesmo id confundia o leitor de tela. */}
        <div className="ale-corpo">
          <section className="ale-chamado" aria-labelledby="ale-titulo">
            <h1 id="ale-titulo" className="ale-cond ale-titulo">
              {corte < 0 ? (
                t.titulo
              ) : (
                <>
                  {t.titulo.slice(0, corte)}
                  <em>{t.p.tituloDestaque}</em>
                  {t.titulo.slice(corte + t.p.tituloDestaque.length)}
                </>
              )}
            </h1>
            <p className="ale-lema">
              {t.lema}
              <span>{t.texto}</span>
            </p>
          </section>
          <section className="ale-cartao" aria-label={t.abas} aria-busy={ocupado || undefined}>
            <div aria-hidden className="ale-faixa" />
            <div className="ale-cartao-corpo">{children}</div>
          </section>
          <Parede t={t} figuras={naTela} />
        </div>
        {comoEntrar && (
          <section className="ale-como" aria-labelledby="ale-como">
            <h2 id="ale-como" className="ale-cond">{t.comoEntrar}</h2>
            <ol className="ale-passos">
              {t.passos.map((p, i) => (
                <li key={p.titulo} className="ale-passo">
                  <strong>
                    {i + 1}. {p.titulo}
                  </strong>
                  <span>{p.texto}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        <footer className="ale-pe">
          <p>{t.sinais.join(" · ")}</p>
          {organizacoes ? (
            <a className="ale-link" href={organizacoes}>
              {t.p.organizacoes}
            </a>
          ) : null}
          <details className="ale-creditos">
            <summary>{t.creditos}</summary>
            <p>{t.creditosTexto}</p>
            <ul>
              {naTela.map((f) => (
                <li key={f.id}>
                  <strong>{f.nome}</strong> · {t.creditosAutor}: {f.credito.autor} · {t.creditosLicenca}:{" "}
                  {f.credito.licencaUrl ? (
                    <a href={f.credito.licencaUrl} rel="license noopener noreferrer" target="_blank">
                      {f.credito.licenca}
                    </a>
                  ) : (
                    f.credito.licenca
                  )}{" "}
                  · {t.creditosFonte}:{" "}
                  <a href={f.credito.fonte} rel="noopener noreferrer" target="_blank">
                    {f.credito.fonte.startsWith("https://commons.wikimedia.org/") ? "Wikimedia Commons" : f.credito.fonte.replace(/^https:\/\/([^/]+).*$/, "$1")}
                  </a>
                  {f.credito.licencaDerivada ? <span> · {t.creditosDerivada.replace("{licenca}", f.credito.licencaDerivada)}</span> : null}
                  {f.credito.cuidado ? <span> · {f.credito.cuidado}</span> : null}
                </li>
              ))}
            </ul>
          </details>
        </footer>
      </div>
    </div>
  );
}

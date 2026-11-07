// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { fill, localePath } from "@/i18n/config";
import { DOSSIES_DE_LEITURA } from "@/lib/vale-o-escrito/leituras";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import type { Entrada } from "@/lib/vale-o-escrito/tipos";
import { formatarReais, somaDocumentada } from "@/lib/vale-o-escrito/valores";
import { codigoDeArquivo, formatarData, listaComE, veiculosDaEntrada, type DossieVisual } from "@/lib/vale-o-escrito/visual";

/**
 * O papel de leitura de um dossiê temático (T31 3.4): o título, a apresentação e, caso a caso, o código de arquivo, a
 * situação jurídica (sempre escrita), data e lugar, o resumo com "segundo [fonte]", os valores em dinheiro escritos nas
 * fontes, o atalho para a ficha e o link para o caso completo. Fecha com os avisos de método.
 */
export function PapelDeLeitura({
  slug,
  entradas,
  indiceDe,
  dossies,
  s,
  lang,
  aoVerFicha,
  aoFechar,
}: {
  slug: string;
  entradas: Entrada[];
  indiceDe: Map<string, number>;
  dossies: DossieVisual[];
  s: TextosDoObservatorio;
  lang: string;
  aoVerFicha: (entradaId: string) => void;
  aoFechar: () => void;
}) {
  const t = s.leituras.itens[slug as keyof typeof s.leituras.itens];
  const n = DOSSIES_DE_LEITURA.findIndex((d) => d.slug === slug) + 1;
  const soma = somaDocumentada(entradas);
  const categoria = (d: string) => dossies.find((x) => x.slug === d)?.titulo ?? d;
  return (
    <article className="ve-papel ve-ficha-entra" aria-labelledby="ve-papel-titulo">
      <div className="ve-ficha-topo">
        <span className="ve-rotulo">
          {s.leituras.papel} / {String(n).padStart(2, "0")}
        </span>
        <button type="button" className="ve-fechar" onClick={aoFechar}>
          {s.leituras.fechar}
        </button>
      </div>
      <h2 className="ve-ficha-titulo" id="ve-papel-titulo">
        {t?.titulo ?? slug}
      </h2>
      {t?.descricao && <p className="ve-subtitulo">{t.descricao}</p>}
      <p className="ve-rotulo">
        {fill(s.leituras.nCasos, { n: entradas.length })}
        {soma.total > 0 && (
          <>
            {" · "}
            {s.visual.dinheiro.total}: <b className="ve-fluxo-valor">{formatarReais(soma.total, lang, true)}</b>
          </>
        )}
      </p>
      <ol className="ve-papel-casos">
        {entradas.map((e) => {
          const lugar = [e.lugar.nome, e.lugar.regiao].filter(Boolean).join(", ") || e.lugar.pais;
          return (
            <li key={e.id}>
              <div className="ve-papel-cabeca">
                <span className="ve-codigo">{codigoDeArquivo(indiceDe.get(e.id) ?? 0)}</span>
                <span className="ve-rotulo">{categoria(e.dossie)}</span>
              </div>
              <h3>{e.titulo}</h3>
              <p>
                <span className="ve-selo" data-situacao={e.situacao}>
                  {s.situacao[e.situacao]}
                </span>{" "}
                <span className="ve-rotulo">
                  {formatarData(e.dataDoFato, lang)} · {lugar}
                </span>
              </p>
              <p className="ve-resumo">{e.resumo}</p>
              {(e.valores ?? []).length > 0 && (
                <ul className="ve-papel-valores">
                  {[...(e.valores ?? [])]
                    .sort((a, b) => b.valor - a.valor)
                    .map((v) => (
                      <li key={v.id}>
                        <b className="ve-fluxo-valor">{formatarReais(v.valor, lang)}</b> <span className="ve-fluxo-tipo">{s.visual.dinheiro.tipos[v.tipo]}</span>
                      </li>
                    ))}
                </ul>
              )}
              <p className="ve-aviso-fixo">
                {fill(s.visual.ficha.segundo, { veiculos: listaComE(veiculosDaEntrada(e)) })}. {fill(s.leituras.fontes, { n: e.fontes.length })}. {s.ficha.atualizadoEm}:{" "}
                {formatarData(e.atualizadoEm, lang)}
              </p>
              <div className="ve-papel-acoes">
                <button type="button" className="ve-lista-no" onClick={() => aoVerFicha(e.id)}>
                  {s.leituras.verNaTeia}
                </button>
                <Link href={localePath(lang, `/vale-o-escrito/caso/${e.id}`)}>{s.leituras.casoCompleto} →</Link>
              </div>
            </li>
          );
        })}
      </ol>
      <ul className="ve-avisos">
        <li>{s.avisos.presuncao}</li>
        <li>{s.avisos.segundoFonte}</li>
        <li>{s.avisos.semVitimas}</li>
      </ul>
    </article>
  );
}

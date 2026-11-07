// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "@/components/Link";
import { fill, localePath } from "@/i18n/config";
import {
  ABAS_DO_ARSENAL,
  camposDoCaso,
  casaBusca,
  documentosDoArsenal,
  eventosDoArsenal,
  relacoesDoArsenal,
  type AbaDoArsenal,
  type EventoDoArsenal,
} from "@/lib/vale-o-escrito/arsenal";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import { SITUACOES, TIPOS_DE_FONTE, type Situacao, type TipoDeFonte } from "@/lib/vale-o-escrito/tipos";
import { corDaCategoria, formatarReais } from "@/lib/vale-o-escrito/valores";
import { codigoDeArquivo, dominioDe, formatarData, indicesDeArquivo, listaComE, veiculosDaEntrada, type DadosDoObservatorio } from "@/lib/vale-o-escrito/visual";

type S = TextosDoObservatorio;

/**
 * O catálogo "Arsenal" (T31 3.5 e 3.7): quatro abas (casos, eventos, documentos, relações) sobre a base publicada, com
 * busca e filtros por categoria, situação jurídica e tipo de fonte. Tudo no navegador, sobre o que o servidor já
 * entregou: nada é enviado, nada fica guardado (sem rastreio). Cada linha leva ao caso completo.
 */
export function Arsenal({ dados, s, lang }: { dados: DadosDoObservatorio; s: S; lang: string }) {
  const a = s.arsenal;
  const [aba, setAba] = useState<AbaDoArsenal>("casos");
  const [termo, setTermo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [situacao, setSituacao] = useState<Situacao | "">("");
  const [tipoFonte, setTipoFonte] = useState<TipoDeFonte | "">("");
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const indiceDe = useMemo(() => indicesDeArquivo(dados.entradas), [dados.entradas]);
  const nomeDaCategoria = (slug: string) => dados.dossies.find((d) => d.slug === slug)?.titulo ?? slug;
  const caminhoDoCaso = (id: string) => localePath(lang, `/vale-o-escrito/caso/${id}`);

  // Os filtros de categoria e situação valem para todas as abas (pelo caso); a busca olha os campos de cada aba.
  const casos = useMemo(
    () => dados.entradas.filter((e) => (!categoria || e.dossie === categoria) && (!situacao || e.situacao === situacao)),
    [dados.entradas, categoria, situacao],
  );
  const casosVisiveis = useMemo(() => casos.filter((e) => casaBusca(camposDoCaso(dados, e), termo)), [casos, dados, termo]);
  const eventos = useMemo(
    () => eventosDoArsenal(casos).filter((ev) => casaBusca([ev.entrada.titulo, ev.valor?.resumo, ev.fonte?.veiculo, ev.fonte?.titulo, ev.mudanca?.nota], termo)),
    [casos, termo],
  );
  const documentos = useMemo(
    () =>
      documentosDoArsenal(casos).filter(
        (d) => (!tipoFonte || d.fonte.tipo === tipoFonte) && casaBusca([d.fonte.veiculo, d.fonte.titulo, d.fonte.trecho, dominioDe(d.fonte.url), d.entrada.titulo], termo),
      ),
    [casos, termo, tipoFonte],
  );
  const relacoes = useMemo(() => {
    const ids = new Set(casos.map((e) => e.id));
    return relacoesDoArsenal({ ...dados, entradas: casos, ligacoes: dados.ligacoes.filter((l) => ids.has(l.entradaId)) })
      .filter((g) => g.relacoes.length > 0 || g.casos.length > 0)
      .filter((g) => casaBusca([g.ponta.nome, ...g.relacoes.map((r) => `${r.outro.nome} ${r.ligacao.rotulo ?? ""}`), ...g.casos.map((e) => e.titulo)], termo));
  }, [casos, dados, termo]);

  const total = { casos: casosVisiveis.length, eventos: eventos.length, documentos: documentos.length, relacoes: relacoes.length }[aba];
  const filtrando = termo || categoria || situacao || tipoFonte;
  const limpar = () => {
    setTermo("");
    setCategoria("");
    setSituacao("");
    setTipoFonte("");
  };

  const teclarAbas = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = ABAS_DO_ARSENAL.indexOf(aba);
    let j = i;
    if (e.key === "ArrowRight") j = (i + 1) % ABAS_DO_ARSENAL.length;
    else if (e.key === "ArrowLeft") j = (i - 1 + ABAS_DO_ARSENAL.length) % ABAS_DO_ARSENAL.length;
    else if (e.key === "Home") j = 0;
    else if (e.key === "End") j = ABAS_DO_ARSENAL.length - 1;
    else return;
    e.preventDefault();
    setAba(ABAS_DO_ARSENAL[j]);
    refs.current[j]?.focus();
  };

  const rotuloDoEvento = (ev: EventoDoArsenal) => {
    if (ev.tipo === "mudanca" && ev.mudanca) return `${a.evento.mudanca}: ${fill(s.ficha.mudouDePara, { de: s.situacao[ev.mudanca.de], para: s.situacao[ev.mudanca.para] })}`;
    if (ev.tipo === "valor" && ev.valor) return `${a.evento.valor}: ${formatarReais(ev.valor.valor, lang)} (${s.visual.dinheiro.tipos[ev.valor.tipo]})`;
    if (ev.tipo === "fonte" && ev.fonte) return `${a.evento.fonte}: ${ev.fonte.veiculo}`;
    return a.evento[ev.tipo];
  };

  return (
    <div className="ve-arsenal">
      <form className="ve-arsenal-filtros" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="ve-arsenal-busca">
          <span className="ve-rotulo">{a.buscar}</span>
          <input type="search" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder={a.buscarDica} autoComplete="off" />
        </label>
        <label>
          <span className="ve-rotulo">{a.categoria}</span>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="">{a.todas}</option>
            {dados.dossies.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.titulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="ve-rotulo">{a.situacao}</span>
          <select value={situacao} onChange={(e) => setSituacao(e.target.value as Situacao | "")}>
            <option value="">{a.todas}</option>
            {SITUACOES.map((k) => (
              <option key={k} value={k}>
                {s.situacao[k]}
              </option>
            ))}
          </select>
        </label>
        {aba === "documentos" && (
          <label>
            <span className="ve-rotulo">{a.tipoFonte}</span>
            <select value={tipoFonte} onChange={(e) => setTipoFonte(e.target.value as TipoDeFonte | "")}>
              <option value="">{a.todas}</option>
              {TIPOS_DE_FONTE.map((k) => (
                <option key={k} value={k}>
                  {a.tiposDeFonte[k]}
                </option>
              ))}
            </select>
          </label>
        )}
        {filtrando && (
          <button type="button" className="ve-fechar" onClick={limpar}>
            {a.limpar}
          </button>
        )}
      </form>

      <div role="tablist" aria-label={a.titulo} className="ve-visoes ve-arsenal-abas" onKeyDown={teclarAbas}>
        {ABAS_DO_ARSENAL.map((k, i) => (
          <button
            key={k}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`ve-arsenal-aba-${k}`}
            aria-selected={aba === k}
            aria-controls="ve-arsenal-painel"
            tabIndex={aba === k ? 0 : -1}
            className="ve-visao"
            onClick={() => setAba(k)}
          >
            <i aria-hidden="true">{aba === k ? "●" : "○"}</i>
            {a.abas[k]}
          </button>
        ))}
      </div>

      <section id="ve-arsenal-painel" role="tabpanel" aria-labelledby={`ve-arsenal-aba-${aba}`} className="ve-arsenal-painel">
        <p className="ve-rotulo" role="status" aria-live="polite">
          {fill(a.resultados, { n: total })}
        </p>
        {total === 0 && <p className="ve-ficha-vazia">{aba === "relacoes" ? a.relacoes.semRelacoes : a.nada}</p>}

        {aba === "casos" && (
          <ul className="ve-arsenal-lista">
            {casosVisiveis.map((e) => (
              <li key={e.id} style={{ borderLeftColor: corDaCategoria(e.dossie) }}>
                <div className="ve-papel-cabeca">
                  <span className="ve-codigo">{codigoDeArquivo(indiceDe.get(e.id) ?? 0)}</span>
                  <span className="ve-rotulo">{nomeDaCategoria(e.dossie)}</span>
                  <span className="ve-rotulo">
                    {formatarData(e.dataDoFato, lang)} · {[e.lugar.nome, e.lugar.regiao].filter(Boolean).join(", ") || e.lugar.pais}
                  </span>
                </div>
                <h2>
                  <Link href={caminhoDoCaso(e.id)}>{e.titulo}</Link>
                </h2>
                <p>
                  <span className="ve-selo" data-situacao={e.situacao}>
                    {s.situacao[e.situacao]}
                  </span>{" "}
                  <span className="ve-selo" data-confianca={e.confianca}>
                    {s.confianca[e.confianca]}
                  </span>
                </p>
                <p className="ve-aviso-fixo">
                  {fill(s.visual.ficha.segundo, { veiculos: listaComE(veiculosDaEntrada(e)) })}. {s.ficha.atualizadoEm}: {formatarData(e.atualizadoEm, lang)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {aba === "eventos" && (
          <ol className="ve-arsenal-lista ve-arsenal-eventos">
            {eventos.map((ev) => (
              <li key={ev.chave} data-evento={ev.tipo} style={{ borderLeftColor: corDaCategoria(ev.entrada.dossie) }}>
                <span className="ve-codigo">{formatarData(ev.data, lang)}</span>
                <span>{rotuloDoEvento(ev)}</span>
                <span className="ve-aviso-fixo">
                  <Link href={caminhoDoCaso(ev.entrada.id)}>{ev.entrada.titulo}</Link> · {s.situacao[ev.entrada.situacao]}
                </span>
                {ev.valor && <span className="ve-aviso-fixo">{ev.valor.resumo}</span>}
              </li>
            ))}
          </ol>
        )}

        {aba === "documentos" && (
          <ul className="ve-arsenal-lista">
            {documentos.map((d) => (
              <li key={d.chave} style={{ borderLeftColor: corDaCategoria(d.entrada.dossie) }}>
                <span className="ve-fonte-dominio">
                  {s.visual.ficha.fonte} {String(d.n).padStart(2, "0")}
                  {dominioDe(d.fonte.url) ? ` · ${dominioDe(d.fonte.url)}` : ""} · {a.tiposDeFonte[d.fonte.tipo]}
                </span>
                <span className="ve-fonte-titulo">
                  {d.fonte.veiculo}: {d.fonte.titulo}
                </span>
                <blockquote>“{d.fonte.trecho}”</blockquote>
                <span className="ve-fonte-meta">
                  <span>
                    {s.ficha.dataDaFonte}: {formatarData(d.fonte.data, lang)}
                  </span>
                  <a href={d.fonte.url} target="_blank" rel="noopener noreferrer nofollow">
                    {s.visual.ficha.abrirFonte} ↗
                  </a>
                  {d.fonte.arquivoUrl && (
                    <a href={d.fonte.arquivoUrl} target="_blank" rel="noopener noreferrer nofollow">
                      {a.copiaArquivada} ↗
                    </a>
                  )}
                  <Link href={caminhoDoCaso(d.entrada.id)}>
                    {a.caso}: {d.entrada.titulo}
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}

        {aba === "relacoes" && (
          <>
            <p className="ve-aviso-fixo">{a.relacoes.explica}</p>
            <ul className="ve-arsenal-lista">
              {relacoes.map((g) => (
                <li key={`${g.ponta.tipo}:${g.ponta.id}`}>
                  <span className="ve-rotulo">{s.visual.tipoNo[g.ponta.tipo]}</span>
                  <h2>
                    <Link href={localePath(lang, `/vale-o-escrito/${g.ponta.tipo === "pessoa" ? "pessoa" : "organizacao"}/${g.ponta.id}`)}>{g.ponta.nome}</Link>
                  </h2>
                  {g.relacoes.length > 0 && (
                    <ul className="ve-ligacoes">
                      {g.relacoes.map((r) => (
                        <li key={r.ligacao.id}>
                          <i className="ve-i-conf" data-confianca={r.confianca} aria-hidden="true" />
                          <span>
                            {r.ligacao.de.id === g.ponta.id ? g.ponta.nome : r.outro.nome} <span className="ve-ligacao-tipo">{s.visual.ligacao[r.ligacao.tipo]}</span>{" "}
                            {r.ligacao.de.id === g.ponta.id ? r.outro.nome : g.ponta.nome}
                            {r.ligacao.rotulo ? <span className="ve-aviso-fixo"> · {r.ligacao.rotulo}</span> : null}
                            <span className="ve-ligacao-meta">
                              {" "}
                              · {s.visual.lista[r.confianca]} · <Link href={caminhoDoCaso(r.entrada.id)}>{r.entrada.titulo}</Link>
                              {r.fontes.length > 0 && ` [${r.fontes.join("] [")}]`}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {g.casos.length > 0 && (
                    <p className="ve-aviso-fixo">
                      {a.relacoes.citados}:{" "}
                      {g.casos.map((e, i) => (
                        <span key={e.id}>
                          {i > 0 && "; "}
                          <Link href={caminhoDoCaso(e.id)}>{e.titulo}</Link> ({s.visual.ficha.situacaoDoCaso}: {s.situacao[e.situacao]})
                        </span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

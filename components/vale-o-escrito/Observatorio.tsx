// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "@/components/Link";
import { fill, localePath } from "@/i18n/config";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import { VISOES, type NivelDeZoom, type Visao } from "@/lib/vale-o-escrito/tipos";
import {
  acharEntrada,
  acharOrganizacao,
  acharPessoa,
  aplicarEntradaAoVivo,
  chaveDe,
  contarPorSituacao,
  indicesDeArquivo,
  listaTextual,
  lugarDoNo,
  montarGrafo,
  type DadosDoObservatorio,
  type PropsDoMapa,
} from "@/lib/vale-o-escrito/visual";
import { FichaDeAgente, FichaDoCaso } from "./Fichas";
import { useAoVivo } from "./useAoVivo";

type S = TextosDoObservatorio;
const CtxTextos = createContext<S | null>(null);

function Carregando() {
  const s = useContext(CtxTextos);
  return (
    <div className="ve-vazio" role="status">
      <p>{s?.visual.carregando ?? "…"}</p>
    </div>
  );
}

// O peso (D3, MapLibre) só sai do servidor quando a visão é aberta: nada disso entra no pacote da página inicial.
const Teia = dynamic(() => import("./Teia"), { ssr: false, loading: Carregando });
const Mapa = dynamic<PropsDoMapa>(() => import("./Mapa"), { ssr: false, loading: Carregando });
const Orbita = dynamic(() => import("./VisoesLeves").then((m) => m.Orbita), { ssr: false, loading: Carregando });
const Grupos = dynamic(() => import("./VisoesLeves").then((m) => m.Grupos), { ssr: false, loading: Carregando });
const Fluxo = dynamic(() => import("./VisoesLeves").then((m) => m.Fluxo), { ssr: false, loading: Carregando });
const LinhaDoTempo = dynamic(() => import("./VisoesLeves").then((m) => m.LinhaDoTempo), { ssr: false, loading: Carregando });

const dividir = (chave: string): [string, string] => {
  const i = chave.indexOf(":");
  return [chave.slice(0, i), chave.slice(i + 1)];
};

/** Roving tabindex das abas: setas, Home e End movem a escolha e o foco. */
function useTeclasDeAbas<T extends HTMLElement>(total: number, atual: number, escolher: (i: number) => void, vertical: boolean) {
  const refs = useRef<(T | null)[]>([]);
  const aoTeclar = (e: KeyboardEvent<HTMLElement>) => {
    const prox = vertical ? "ArrowDown" : "ArrowRight";
    const ant = vertical ? "ArrowUp" : "ArrowLeft";
    let i = atual;
    if (e.key === prox) i = (atual + 1) % total;
    else if (e.key === ant) i = (atual - 1 + total) % total;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = total - 1;
    else return;
    e.preventDefault();
    escolher(i);
    refs.current[i]?.focus();
  };
  return { refs, aoTeclar };
}

export function Observatorio({ dados: inicial, s, lang }: { dados: DadosDoObservatorio; s: S; lang: string }) {
  const [dados, setDados] = useState(inicial);
  const [dossie, setDossie] = useState<string | null>(null);
  const [visao, setVisao] = useState<Visao>("teia");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [zoomMapa, setZoomMapa] = useState<NivelDeZoom>("pais");
  const [listaAberta, setListaAberta] = useState(false);

  const { ligado, ultimo } = useAoVivo(dados, (id, entrada) => setDados((d) => aplicarEntradaAoVivo(d, id, entrada)));

  const grafo = useMemo(() => montarGrafo(dados, dossie), [dados, dossie]);
  const entradas = useMemo(() => (dossie ? dados.entradas.filter((e) => e.dossie === dossie) : dados.entradas), [dados, dossie]);
  const lista = useMemo(() => listaTextual(grafo), [grafo]);
  const contagens = useMemo(() => contarPorSituacao(entradas), [entradas]);
  // O número do arquivo (VE-0001...) é só um rótulo: a posição na ordem de publicação.
  const indiceDe = useMemo(() => indicesDeArquivo(dados.entradas), [dados.entradas]);
  const nDoDossie = useMemo(() => new Map(dados.dossies.map((d) => [d.slug, dados.entradas.filter((e) => e.dossie === d.slug).length])), [dados]);

  const abas = useMemo(() => [{ slug: null as string | null }, ...dados.dossies.map((d) => ({ slug: d.slug as string | null }))], [dados.dossies]);
  const abaAtual = Math.max(0, abas.findIndex((a) => a.slug === dossie));
  const teclasDasAbas = useTeclasDeAbas<HTMLButtonElement>(abas.length, abaAtual, (i) => escolherDossie(abas[i].slug), true);
  const visaoAtual = VISOES.indexOf(visao);
  const teclasDasVisoes = useTeclasDeAbas<HTMLButtonElement>(VISOES.length, visaoAtual, (i) => setVisao(VISOES[i]), false);

  function escolherDossie(slug: string | null) {
    setDossie(slug);
    // A seleção só continua se o nó ainda existe no dossiê escolhido.
    setSelecionado((atual) => (atual && montarGrafo(dados, slug).nos.some((n) => n.chave === atual) ? atual : null));
  }
  const escolherCaso = useCallback((id: string) => setSelecionado(chaveDe("entrada", id)), []);

  const dossieAtual = dados.dossies.find((d) => d.slug === dossie);
  const vazio = dados.entradas.length === 0;

  const mapaProps: PropsDoMapa = {
    entradas,
    dossies: dados.dossies,
    selecionadoId: selecionado?.startsWith("entrada:") ? selecionado.slice(8) : null,
    aoEscolher: escolherCaso,
    zoom: zoomMapa,
    aoMudarZoom: setZoomMapa,
    textos: {
      carregando: s.visual.carregando,
      mapaEmPreparacao: s.visual.mapa.emPreparacao,
      mapaTexto: s.visual.mapa.texto,
      semLugar: s.visual.mapa.semLugar,
      zoom: s.zoom as Record<NivelDeZoom, string>,
      situacao: s.situacao,
    },
  };

  const fichaDoSelecionado = () => {
    if (!selecionado) return <p className="ve-ficha-vazia">{s.visual.semSelecao}</p>;
    const [tipo, id] = dividir(selecionado);
    if (tipo === "entrada") {
      const e = acharEntrada(dados, id);
      if (e) return <FichaDoCaso entrada={e} dados={dados} s={s} lang={lang} indice={indiceDe.get(e.id) ?? 0} aoEscolher={setSelecionado} comLinkParaFicha />;
    }
    if (tipo === "pessoa") {
      const p = acharPessoa(dados, id);
      if (p) return <FichaDeAgente tipo="pessoa" agente={p} dados={dados} s={s} lang={lang} aoEscolherCaso={escolherCaso} />;
    }
    if (tipo === "organizacao") {
      const o = acharOrganizacao(dados, id);
      if (o) return <FichaDeAgente tipo="organizacao" agente={o} dados={dados} s={s} lang={lang} aoEscolherCaso={escolherCaso} />;
    }
    if (tipo === "lugar") {
      const doLugar = dados.entradas.filter((e) => lugarDoNo(e)?.id === id);
      return (
        <section className="ve-bloco" aria-label={s.visual.tipoNo.lugar}>
          <span className="ve-codigo">{s.visual.tipoNo.lugar}</span>
          <h2 className="ve-ficha-titulo">{grafo.nos.find((n) => n.chave === selecionado)?.rotulo ?? id}</h2>
          <ul className="ve-lista-de-casos">
            {doLugar.map((e) => (
              <li key={e.id}>
                <button type="button" className="ve-lista-no" onClick={() => escolherCaso(e.id)}>
                  {e.titulo}
                </button>
                <span className="ve-selo" data-situacao={e.situacao}>
                  {s.situacao[e.situacao]}
                </span>
              </li>
            ))}
          </ul>
        </section>
      );
    }
    return <p className="ve-ficha-vazia">{s.visual.semSelecao}</p>;
  };

  const painelId = "ve-palco-painel";

  return (
    <CtxTextos.Provider value={s}>
      <div className="ve" data-ve-pronto="">
        <a className="ve-pular" href="#ve-lista" onClick={() => setListaAberta(true)}>
          {s.visual.pularParaLista}
        </a>
        <header className="ve-topo">
          <span className="ve-rotulo">{s.entrada.olho}</span>
          <h1>
            {s.entrada.titulo}
            <span>_</span>
          </h1>
          <p className="ve-subtitulo">
            <strong>{s.entrada.subtitulo}.</strong> {s.entrada.linhaHonesta}
          </p>
          <ul className="ve-avisos">
            <li>{s.avisos.presuncao}</li>
            <li>{s.avisos.segundoFonte}</li>
            <li>{s.avisos.semVitimas}</li>
            <li>{s.avisos.curadoriaAnonima}</li>
          </ul>
          <span className="ve-vivo" data-ligado={ligado}>
            <i aria-hidden="true" />
            {ligado ? s.visual.aoVivo.ligado : s.visual.aoVivo.desligado}
          </span>
          <p className="ve-aviso-vivo" role="status" aria-live="polite">
            {ultimo ? fill(s.visual.aoVivo.atualizou, { titulo: ultimo }) : ""}
          </p>
        </header>

        <div className="ve-corpo">
          {/* Coluna esquerda: dossiês em abas numeradas. */}
          <aside className="ve-esq" aria-label={s.visual.aria.dossies}>
            <div role="tablist" aria-orientation="vertical" aria-label={s.visual.aria.dossies} className="ve-abas" onKeyDown={teclasDasAbas.aoTeclar}>
              {abas.map((a, i) => {
                const d = a.slug ? dados.dossies.find((x) => x.slug === a.slug) : null;
                const n = a.slug ? (nDoDossie.get(a.slug) ?? 0) : dados.entradas.length;
                const sel = a.slug === dossie;
                return (
                  <button
                    key={a.slug ?? "todos"}
                    ref={(el) => {
                      teclasDasAbas.refs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`ve-aba-${a.slug ?? "todos"}`}
                    aria-selected={sel}
                    aria-controls={painelId}
                    tabIndex={sel ? 0 : -1}
                    className="ve-aba"
                    data-cor={d?.cor ?? "amarelo"}
                    onClick={() => escolherDossie(a.slug)}
                  >
                    <span className="ve-aba-num">{String(i).padStart(2, "0")}</span>
                    <span className="ve-aba-nome">{d ? d.titulo : s.visual.abaTodos}</span>
                    <span className="ve-aba-n" aria-label={fill(s.visual.contagem, { n })}>
                      {n}
                    </span>
                  </button>
                );
              })}
            </div>
            {dossieAtual && <p className="ve-dossie-desc">{dossieAtual.descricao}</p>}
            <ul className="ve-contagens" aria-label={s.ficha.situacao}>
              {(Object.keys(contagens) as (keyof typeof contagens)[])
                .filter((k) => contagens[k] > 0)
                .map((k) => (
                  <li key={k}>
                    <span>{s.situacao[k]}</span>
                    <span>{contagens[k]}</span>
                  </li>
                ))}
            </ul>
            <div className="ve-esq-links">
              <Link href={localePath(lang, "/vale-o-escrito/enviar")}>{s.ficha.enviarFonte} →</Link>
            </div>
          </aside>

          {/* Palco: a visão escolhida e, embaixo, o seletor de visões. */}
          <section className="ve-palco" aria-label={s.entrada.titulo}>
            <div className="ve-viz" role="tabpanel" id={painelId} aria-labelledby={`ve-aba-${dossie ?? "todos"}`}>
              {vazio ? (
                <div className="ve-vazio">
                  <strong>{s.entrada.olho}</strong>
                  <p>{s.visual.vazio}</p>
                </div>
              ) : entradas.length === 0 ? (
                <div className="ve-vazio">
                  <p>{s.visual.vazioDossie}</p>
                </div>
              ) : (
                <>
                  {visao === "teia" && <Teia grafo={grafo} selecionado={selecionado} aoSelecionar={setSelecionado} s={s} />}
                  {visao === "orbita" && <Orbita grafo={grafo} selecionado={selecionado} aoSelecionar={setSelecionado} s={s} />}
                  {visao === "grupos" && <Grupos grafo={grafo} dossies={dados.dossies} selecionado={selecionado} aoSelecionar={setSelecionado} s={s} />}
                  {visao === "fluxo" && <Fluxo entradas={entradas} dossies={dados.dossies} aoSelecionarDossie={escolherDossie} s={s} />}
                  {visao === "mapa" && <Mapa {...mapaProps} />}
                  {visao === "linha" && (
                    <LinhaDoTempo entradas={entradas} dossies={dados.dossies} selecionadoId={mapaProps.selecionadoId} aoEscolher={escolherCaso} s={s} lang={lang} />
                  )}
                  {(visao === "teia" || visao === "orbita" || visao === "grupos") && (
                    <ul className="ve-legenda" aria-label={s.visual.legenda}>
                      {(["entrada", "pessoa", "organizacao", "lugar"] as const).map((t) => (
                        <li key={t}>
                          <i className={`ve-i-${t}`} aria-hidden="true" />
                          {s.visual.tipoNo[t]}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <details
              className="ve-lista"
              id="ve-lista"
              open={listaAberta}
              onToggle={(e) => setListaAberta((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>
                {s.visual.lista.titulo} · {fill(s.visual.contagem, { n: entradas.length })}
              </summary>
              <p className="ve-lista-explica">{s.visual.lista.explica}</p>
              <ul aria-label={s.visual.aria.lista}>
                {lista.map(({ no, ligacoes }) => (
                  <li key={no.chave}>
                    <div>
                      <span className="ve-rotulo">{s.visual.tipoNo[no.tipo]}: </span>
                      <button type="button" className="ve-lista-no" aria-pressed={selecionado === no.chave} onClick={() => setSelecionado(no.chave)}>
                        {no.rotulo}
                      </button>
                      {no.situacao && (
                        <>
                          {" "}
                          <span className="ve-selo" data-situacao={no.situacao}>
                            {s.situacao[no.situacao]}
                          </span>
                        </>
                      )}
                    </div>
                    {ligacoes.length > 0 ? (
                      <ul aria-label={s.visual.lista.ligadoA}>
                        {ligacoes.map(({ aresta, outro }) => (
                          <li key={aresta.id}>
                            {s.visual.ligacao[aresta.tipo]}: {outro.rotulo}
                            {aresta.situacao ? ` (${s.situacao[aresta.situacao]})` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="ve-aviso-fixo">{s.visual.lista.semLigacoes}</span>
                    )}
                  </li>
                ))}
              </ul>
            </details>

            <div role="tablist" aria-label={s.visual.aria.visoes} className="ve-visoes" onKeyDown={teclasDasVisoes.aoTeclar}>
              {VISOES.map((v, i) => (
                <button
                  key={v}
                  ref={(el) => {
                    teclasDasVisoes.refs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={visao === v}
                  tabIndex={visao === v ? 0 : -1}
                  className="ve-visao"
                  onClick={() => setVisao(v)}
                >
                  {s.visoes[v]}
                </button>
              ))}
            </div>
          </section>

          {/* Ficha à direita: situação jurídica, fontes numeradas, correção e direito de resposta. */}
          <aside className="ve-ficha" aria-label={s.visual.aria.ficha}>
            {selecionado && (
              <div className="ve-ficha-topo">
                <span className="ve-rotulo">{s.visual.aria.ficha}</span>
                <button type="button" className="ve-fechar" onClick={() => setSelecionado(null)}>
                  {s.visual.ficha.fechar}
                </button>
              </div>
            )}
            {fichaDoSelecionado()}
          </aside>
        </div>
      </div>
    </CtxTextos.Provider>
  );
}

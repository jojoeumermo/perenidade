// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "@/styles/vale-o-escrito.css";
import dynamic from "next/dynamic";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "@/components/Link";
import { fill, localePath } from "@/i18n/config";
import type { TextosDoObservatorio } from "@/lib/vale-o-escrito/textos";
import { SITUACOES, VISOES, type NivelDeZoom, type TipoDeNo, type Visao } from "@/lib/vale-o-escrito/tipos";
import {
  acharEntrada,
  acharOrganizacao,
  acharPessoa,
  aplicarEntradaAoVivo,
  chaveDe,
  contarPorSituacao,
  contarPorTipo,
  dataDaBase,
  formatarData,
  indicesDeArquivo,
  listaTextual,
  lugarDoNo,
  montarGrafo,
  ramosDoCaso,
  type DadosDoObservatorio,
  type PropsDoMapa,
} from "@/lib/vale-o-escrito/visual";
import { DOSSIES_DE_LEITURA, entradasDaLeitura } from "@/lib/vale-o-escrito/leituras";
import { corDaCategoria, formatarReais, somaDocumentada } from "@/lib/vale-o-escrito/valores";
import { medirQuadros, pausarForaDaTela } from "./desempenho";
import { FichaDeAgente, FichaDoCaso } from "./Fichas";
import { PapelDeLeitura } from "./Leituras";
import { tocar } from "./som";
import { useAoVivo } from "./useAoVivo";
import { Contador, Revelar } from "./Vivos";

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
  // Dossiê de leitura aberto (lib/vale-o-escrito/leituras.ts): filtra a base e põe o papel de leitura na coluna da direita.
  const [leitura, setLeitura] = useState<string | null>(null);
  // Destacar por tipo (legenda clicável): só o tipo escolhido fica aceso nas visões de grafo.
  const [destaque, setDestaque] = useState<TipoDeNo | null>(null);
  // Orçamento de desempenho: aparelho que não passa de ~30 quadros por segundo entra no modo leve (menos efeitos).
  const [qualidade, setQualidade] = useState<"alta" | "baixa">("alta");
  const viz = useRef<HTMLDivElement>(null);
  const ficha = useRef<HTMLElement>(null);
  useEffect(() => {
    if (qualidade === "baixa") return;
    // Mede depois que a visão abriu (o primeiro meio segundo é o carregamento do pedaço da visão).
    // Duas medidas seguidas abaixo de 30 (a primeira pega o carregamento da visão, sobretudo o WebGL do mapa, e
    // sozinha dava alarme falso). Aparelho com sinal de fraco (pouca memória, economia de dados) já responde 0.
    let cancelar = () => {};
    let baixas = 0;
    const medir = () => {
      cancelar = medirQuadros(2000, (fps) => {
        if (fps >= 30) return;
        baixas++;
        if (fps === 0 || baixas >= 2) setQualidade("baixa");
        else id = window.setTimeout(medir, 1500);
      });
    };
    let id = window.setTimeout(medir, 1200);
    return () => {
      window.clearTimeout(id);
      cancelar();
    };
  }, [visao, qualidade]);
  // Animações paradas quando o palco sai da tela ou a aba fica escondida.
  useEffect(() => (viz.current ? pausarForaDaTela(viz.current) : undefined), []);

  const { ligado, ultimo } = useAoVivo(dados, (id, entrada) => setDados((d) => aplicarEntradaAoVivo(d, id, entrada)));

  // Dossiê de leitura aberto: só os casos dele (e as ligações deles) entram nas visões.
  const visiveis = useMemo(() => {
    if (!leitura) return dados;
    const ids = new Set(entradasDaLeitura(leitura, dados.entradas).map((e) => e.id));
    return { ...dados, entradas: dados.entradas.filter((e) => ids.has(e.id)), ligacoes: dados.ligacoes.filter((l) => ids.has(l.entradaId)) };
  }, [dados, leitura]);
  const grafo = useMemo(() => montarGrafo(visiveis, dossie), [visiveis, dossie]);
  const entradas = useMemo(() => (dossie ? visiveis.entradas.filter((e) => e.dossie === dossie) : visiveis.entradas), [visiveis, dossie]);
  const lista = useMemo(() => listaTextual(grafo), [grafo]);
  const porTipo = useMemo(() => contarPorTipo(grafo), [grafo]);
  const construidoEm = useMemo(() => dataDaBase(dados.entradas), [dados.entradas]);
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
    setLeitura(null);
    setDossie(slug);
    // A seleção só continua se o nó ainda existe no dossiê escolhido.
    setSelecionado((atual) => (atual && montarGrafo(dados, slug).nos.some((n) => n.chave === atual) ? atual : null));
  }
  const escolherCaso = useCallback((id: string) => setSelecionado(chaveDe("entrada", id)), []);
  /**
   * Escolha feita pela lista textual (ou pelo atalho "ver a ficha"): além de escolher, leva a pessoa até a ficha. No
   * celular a ficha fica abaixo do palco e da lista; sem isso parecia que "a ficha não abriu" (NOVAS-TAREFAS, T31 3.2).
   */
  const irParaFicha = useCallback(() => {
    window.requestAnimationFrame(() => {
      const el = ficha.current;
      if (!el) return;
      const calmo = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: calmo ? "auto" : "smooth", block: "start" });
      el.focus({ preventScroll: true });
    });
  }, []);
  const escolherDaLista = (chave: string) => {
    setSelecionado(chave);
    irParaFicha();
  };
  /** Abre (ou fecha, com null) um dossiê de leitura: tira a categoria e a seleção e leva ao papel de leitura. */
  const abrirLeitura = (slug: string | null) => {
    setLeitura(slug);
    setDossie(null);
    setSelecionado(null);
    if (slug) irParaFicha();
  };

  const dossieAtual = dados.dossies.find((d) => d.slug === dossie);
  const vazio = dados.entradas.length === 0;

  // O banco em números (sempre o banco inteiro, como um painel de investigação): casos, pessoas, organizações, fontes
  // distintas (pelo link) e estados com caso.
  const numeros = useMemo(() => {
    const links = new Set<string>();
    const ufs = new Set<string>();
    for (const e of dados.entradas) {
      for (const f of e.fontes) links.add(f.url);
      if (e.lugar?.pais === "BR" && e.lugar.regiao) ufs.add(e.lugar.regiao);
    }
    return [
      { chave: "casos", n: dados.entradas.length },
      { chave: "pessoas", n: dados.pessoas.length },
      { chave: "organizacoes", n: dados.organizacoes.length },
      { chave: "fontes", n: links.size },
      { chave: "lugares", n: ufs.size },
    ] as const;
  }, [dados]);
  const totalDoRecorte = entradas.length || 1;
  // O número grande (T31 3.1): a soma dos valores escritos nas fontes, no banco inteiro (topo) e no recorte (painel).
  const somaDoBanco = useMemo(() => somaDocumentada(dados.entradas), [dados.entradas]);
  const somaDoRecorte = useMemo(() => somaDocumentada(entradas), [entradas]);
  const nomeDoDossie = (slug: string) => dados.dossies.find((d) => d.slug === slug)?.titulo ?? slug;

  // Som (só se a pessoa ligou, em som.ts): abrir a ficha faz o "papel", e um nó com ligações acende a teia.
  const temLigacao = useMemo(() => (selecionado ? grafo.arestas.some((a) => a.de === selecionado || a.para === selecionado) : false), [grafo, selecionado]);
  useEffect(() => {
    if (!selecionado) return;
    tocar("abrir");
    if (!temLigacao) return;
    const id = window.setTimeout(() => tocar("ligacao"), 140);
    return () => window.clearTimeout(id);
  }, [selecionado, temLigacao]);

  const mapaProps: PropsDoMapa = {
    entradas,
    dossies: dados.dossies,
    selecionadoId: selecionado?.startsWith("entrada:") ? selecionado.slice(8) : null,
    aoEscolher: escolherCaso,
    zoom: zoomMapa,
    aoMudarZoom: setZoomMapa,
    ramosDe: (id: string) => ramosDoCaso(dados, grafo, id),
    aoSelecionarNo: setSelecionado,
    destaque,
    qualidadeBaixa: qualidade === "baixa",
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
      <div className="ve-observatorio" data-ve-pronto="" data-modo={selecionado ? "ficha" : "geral"} data-qualidade={qualidade}>
        <a className="ve-pular" href="#ve-lista" onClick={() => setListaAberta(true)}>
          {s.visual.pularParaLista}
        </a>
        {/* Com uma ficha aberta, o título continua na página (para leitor de tela), escondido da vista. */}
        {(selecionado || leitura) && <h1 className="ve-so-leitor">{s.entrada.titulo}</h1>}
        <p className="ve-aviso-vivo" role="status" aria-live="polite">
          {ultimo ? fill(s.visual.aoVivo.atualizou, { titulo: ultimo }) : ""}
        </p>

        {/* Números de escala no topo (sempre o banco inteiro) e a data em que os dados foram construídos. */}
        <div className="ve-escala">
          <dl className="ve-escala-numeros" aria-label={s.casca.contadores.titulo}>
            {numeros.map((x) => (
              <div key={x.chave}>
                <dt>{s.casca.contadores[x.chave]}</dt>
                <dd>{x.n}</dd>
              </div>
            ))}
          </dl>
          {somaDoBanco.total > 0 && (
            <p className="ve-escala-dinheiro" title={fill(s.visual.dinheiro.explica, { n: somaDoBanco.casos })}>
              <b>{formatarReais(somaDoBanco.total, lang, true)}</b> {s.visual.dinheiro.total}
              <span className="ve-dinheiro-barra" aria-hidden="true">
                {somaDoBanco.porDossie.map((p) => (
                  <i key={p.dossie} style={{ flexGrow: p.total, background: corDaCategoria(p.dossie) }} />
                ))}
              </span>
            </p>
          )}
          {construidoEm && (
            <p className="ve-construido">
              <i aria-hidden="true" />
              {fill(s.visual.construidoEm, { data: formatarData(construidoEm, lang) })}
            </p>
          )}
          {qualidade === "baixa" && <p className="ve-modo-leve">{s.visual.modoLeve}</p>}
        </div>

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
            {/* Dossiês de leitura (T31 3.4): portas de entrada por tema, que cruzam as categorias acima. */}
            <nav className="ve-leituras" aria-labelledby="ve-leituras-titulo">
              <h2 className="ve-rotulo" id="ve-leituras-titulo">
                {s.leituras.titulo}
              </h2>
              <ul>
                {DOSSIES_DE_LEITURA.map((d, i) => {
                  const n = entradasDaLeitura(d.slug, dados.entradas).length;
                  if (n === 0) return null;
                  const t = s.leituras.itens[d.slug as keyof typeof s.leituras.itens];
                  return (
                    <li key={d.slug}>
                      <button type="button" className="ve-leitura" aria-pressed={leitura === d.slug} onClick={() => abrirLeitura(leitura === d.slug ? null : d.slug)}>
                        <span className="ve-leitura-n" aria-hidden="true">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="ve-leitura-nome">{t?.titulo ?? d.slug}</span>
                        <span className="ve-leitura-casos">{fill(s.leituras.nCasos, { n })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </nav>
            <div className="ve-esq-links">
              <Link href={localePath(lang, "/vale-o-escrito/enviar")}>{s.ficha.enviarFonte} →</Link>
            </div>
          </aside>

          {/* Palco: a visão escolhida e, embaixo, o seletor de visões. */}
          <section className="ve-palco" aria-label={s.entrada.titulo}>
            <div ref={viz} className="ve-viz" role="tabpanel" id={painelId} aria-labelledby={`ve-aba-${dossie ?? "todos"}`}>
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
                  {visao === "teia" && <Teia grafo={grafo} selecionado={selecionado} aoSelecionar={setSelecionado} destaque={destaque} s={s} />}
                  {visao === "orbita" && <Orbita grafo={grafo} selecionado={selecionado} aoSelecionar={setSelecionado} destaque={destaque} s={s} />}
                  {visao === "grupos" && (
                    <Grupos grafo={grafo} dossies={dados.dossies} selecionado={selecionado} aoSelecionar={setSelecionado} destaque={destaque} s={s} />
                  )}
                  {visao === "fluxo" && <Fluxo entradas={entradas} dossies={dados.dossies} aoSelecionarDossie={escolherDossie} s={s} />}
                  {visao === "mapa" && <Mapa {...mapaProps} textosMapa={s.mapa} />}
                  {visao === "linha" && (
                    <LinhaDoTempo entradas={entradas} dossies={dados.dossies} selecionadoId={mapaProps.selecionadoId} aoEscolher={escolherCaso} s={s} lang={lang} />
                  )}
                  {(visao === "teia" || visao === "orbita" || visao === "grupos") && (
                    // Legenda que é também o "destacar por tipo": cada tipo com a contagem; clicar acende só ele.
                    <div className="ve-legenda" role="group" aria-label={s.visual.destacar}>
                      <span className="ve-legenda-titulo" title={s.visual.destacarDica}>
                        {s.visual.destacar}
                      </span>
                      <ul aria-label={s.visual.legenda}>
                        {(["entrada", "pessoa", "organizacao", "lugar"] as const).map((t) => (
                          <li key={t}>
                            <button
                              type="button"
                              className="ve-legenda-botao"
                              aria-pressed={destaque === t}
                              data-apagado={destaque !== null && destaque !== t}
                              onClick={() => setDestaque((d) => (d === t ? null : t))}
                              title={s.visual.destacarDica}
                            >
                              <i className={`ve-i-${t}`} aria-hidden="true" />
                              <span>{s.visual.tipoNo[t]}</span>
                              <b>{porTipo[t]}</b>
                            </button>
                          </li>
                        ))}
                      </ul>
                      <ul className="ve-legenda-confianca" aria-label={s.visual.confiancaLigacao.titulo}>
                        <li>
                          <i className="ve-i-conf" data-confianca="primaria" aria-hidden="true" />
                          {s.visual.confiancaLigacao.primaria}
                        </li>
                        <li>
                          <i className="ve-i-conf" data-confianca="reportado" aria-hidden="true" />
                          {s.visual.confiancaLigacao.reportado}
                        </li>
                      </ul>
                    </div>
                  )}
                  {selecionado && (
                    <button type="button" className="ve-ir-ficha" onClick={irParaFicha}>
                      {s.visual.lista.abrir} ↓
                    </button>
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
                      <button type="button" className="ve-lista-no" aria-pressed={selecionado === no.chave} onClick={() => escolherDaLista(no.chave)}>
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
                            {aresta.confianca && (
                              <span className="ve-lista-conf" data-confianca={aresta.confianca}>
                                {" "}
                                · {s.visual.lista[aresta.confianca]}
                              </span>
                            )}
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
                  <i aria-hidden="true">{visao === v ? "●" : "○"}</i>
                  {s.visoes[v]}
                </button>
              ))}
            </div>
          </section>

          {/* Ficha à direita: situação jurídica, fontes numeradas, correção e direito de resposta. */}
          {/* Sem nada escolhido, a coluna da direita é a visão geral (o índice): título, o banco em números, a barra da
              situação jurídica e os avisos. Escolhido um nó, vira a ficha (key: a ficha entra de novo, com a animação). */}
          <aside
            ref={ficha}
            id="ve-ficha"
            tabIndex={-1}
            className="ve-ficha"
            aria-label={selecionado ? s.visual.aria.ficha : s.entrada.titulo}
            data-modo={selecionado ? "ficha" : "geral"}
          >
            {selecionado ? (
              <div className="ve-ficha-entra" key={selecionado}>
                <div className="ve-ficha-topo">
                  <span className="ve-rotulo">
                    {s.visual.aria.ficha} / {s.visual.tipoNo[dividir(selecionado)[0] as keyof typeof s.visual.tipoNo] ?? ""}
                  </span>
                  <button type="button" className="ve-fechar" onClick={() => setSelecionado(null)}>
                    {s.visual.ficha.fechar}
                  </button>
                </div>
                {fichaDoSelecionado()}
              </div>
            ) : leitura ? (
              <PapelDeLeitura
                key={leitura}
                slug={leitura}
                entradas={entradas}
                indiceDe={indiceDe}
                dossies={dados.dossies}
                s={s}
                lang={lang}
                aoVerFicha={(id) => {
                  escolherCaso(id);
                  irParaFicha();
                }}
                aoFechar={() => abrirLeitura(null)}
              />
            ) : (
              <div className="ve-geral">
                <span className="ve-rotulo ve-geral-rotulo">
                  <span>{s.entrada.olho}</span>
                  <span className="ve-vivo" data-ligado={ligado}>
                    <i aria-hidden="true" />
                    {ligado ? s.visual.aoVivo.ligado : s.visual.aoVivo.desligado}
                  </span>
                </span>
                <Revelar como="h1" className="ve-titulo-grande" texto={s.entrada.titulo} />
                <p className="ve-subtitulo-forte">{s.entrada.subtitulo}.</p>
                <p className="ve-subtitulo">{s.entrada.linhaHonesta}</p>
                <dl className="ve-contadores" aria-label={s.casca.contadores.titulo}>
                  {numeros.map((x) => (
                    <div key={x.chave}>
                      <dt>{s.casca.contadores[x.chave]}</dt>
                      <dd>
                        <Contador valor={x.n} />
                      </dd>
                    </div>
                  ))}
                </dl>
                {entradas.length > 0 && (
                  <div className="ve-barra-situacao">
                    <span className="ve-rotulo">{s.casca.barra}</span>
                    <div className="ve-barra-trilho" aria-hidden="true">
                      {SITUACOES.filter((k) => contagens[k] > 0).map((k) => (
                        <i key={k} data-situacao={k} style={{ flexGrow: contagens[k], flexBasis: `${(contagens[k] / totalDoRecorte) * 100}%` }} />
                      ))}
                    </div>
                    <ul className="ve-barra-legenda">
                      {SITUACOES.filter((k) => contagens[k] > 0).map((k) => (
                        <li key={k}>
                          <i data-situacao={k} aria-hidden="true" />
                          <span>{s.situacao[k]}</span>
                          <b>{contagens[k]}</b>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {somaDoRecorte.total > 0 && (
                  <div className="ve-barra-situacao ve-dinheiro">
                    <span className="ve-rotulo">{s.visual.dinheiro.titulo}</span>
                    <strong className="ve-dinheiro-n">{formatarReais(somaDoRecorte.total, lang)}</strong>
                    <div className="ve-barra-trilho" aria-hidden="true">
                      {somaDoRecorte.porDossie.map((p) => (
                        <i key={p.dossie} style={{ flexGrow: p.total, background: corDaCategoria(p.dossie) }} />
                      ))}
                    </div>
                    <ul className="ve-barra-legenda">
                      {somaDoRecorte.porDossie.map((p) => (
                        <li key={p.dossie}>
                          <i style={{ background: corDaCategoria(p.dossie) }} aria-hidden="true" />
                          <span>{nomeDoDossie(p.dossie)}</span>
                          <b>{formatarReais(p.total, lang, true)}</b>
                        </li>
                      ))}
                    </ul>
                    <small className="ve-aviso-fixo">{fill(s.visual.dinheiro.explica, { n: somaDoRecorte.casos })}</small>
                  </div>
                )}
                <ul className="ve-avisos">
                  <li>{s.avisos.presuncao}</li>
                  <li>{s.avisos.segundoFonte}</li>
                  <li>{s.avisos.semVitimas}</li>
                  <li>{s.avisos.curadoriaAnonima}</li>
                </ul>
                <p className="ve-ficha-vazia">{s.visual.semSelecao}</p>
                <p className="ve-geral-rodape">{s.casca.rodape}</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </CtxTextos.Provider>
  );
}
